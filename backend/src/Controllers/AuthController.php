<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

final class AuthController
{
    private const MAX_FAILED_LOGINS = 10; // per email+ip per 15 minutes
    /** A well-formed bcrypt hash (of a throw-away string) so unknown emails cost the same time as known ones. */
    private const DUMMY_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    public function __construct(private App $app)
    {
    }

    public function login(Request $req): Response
    {
        $d = Validator::validate($req->body(), [
            'email' => ['type' => 'email', 'required' => true],
            'password' => ['type' => 'string', 'required' => true, 'max' => 200],
        ]);
        $db = $this->app->db;
        $failed = (int)$db->val(
            "SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ip = ? AND attempted_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')",
            [$d['email'], $req->ip]
        );
        if ($failed >= self::MAX_FAILED_LOGINS) {
            throw new HttpException(429, 'Too many failed sign-in attempts. Try again in 15 minutes.', 'rate_limited');
        }
        $u = $db->one('SELECT * FROM users WHERE email = ?', [$d['email']]);
        // always run a hash verification so timing does not reveal whether the account exists
        $hash = $u['password_hash'] ?? self::DUMMY_HASH;
        $ok = password_verify($d['password'], $hash) && $u !== null;
        if (!$ok) {
            $db->insert('login_attempts', ['email' => $d['email'], 'ip' => $req->ip]);
            throw HttpException::unauthorized('Incorrect email or password');
        }
        $db->run('DELETE FROM login_attempts WHERE email = ?', [$d['email']]);
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
            $db->update('users', (int)$u['id'], ['password_hash' => password_hash($d['password'], PASSWORD_DEFAULT)]);
        }
        $tok = Auth::issueToken($this->app, (int)$u['id']);
        return Response::json([
            'user' => ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name']],
            'organizations' => $this->orgs((int)$u['id']),
            'token' => $tok['token'],
            'token_expires_at' => $tok['expires_at'],
        ]);
    }

    public function logout(Request $req): Response
    {
        $this->app->db->run('DELETE FROM api_tokens WHERE token_hash = ?', [hash('sha256', (string)$req->bearer())]);
        return Response::noContent();
    }

    public function me(Request $req): Response
    {
        return Response::json(['user' => $req->user, 'organizations' => $this->orgs((int)$req->user['id'])]);
    }

    /** @return list<array<string,mixed>> */
    private function orgs(int $uid): array
    {
        return $this->app->db->all(
            'SELECT o.id, o.name, m.role FROM memberships m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ? ORDER BY o.id',
            [$uid]
        );
    }
}
