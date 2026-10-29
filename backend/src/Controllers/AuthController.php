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

    public function __construct(private App $app)
    {
    }

    public function register(Request $req): Response
    {
        $d = Validator::validate($req->body(), [
            'email' => ['type' => 'email', 'required' => true],
            'name' => ['type' => 'string', 'required' => true, 'max' => 120],
            'password' => ['type' => 'string', 'required' => true, 'min' => 10, 'max' => 200],
            'organization_name' => ['type' => 'string', 'max' => 200, 'nullable' => true],
        ]);
        $db = $this->app->db;
        if ($db->val('SELECT 1 FROM users WHERE email = ?', [$d['email']]) !== null) {
            throw HttpException::conflict('An account with this email already exists');
        }
        $result = $db->transaction(function () use ($db, $d) {
            $uid = $db->insert('users', ['email' => $d['email'], 'name' => $d['name'], 'password_hash' => password_hash($d['password'], PASSWORD_DEFAULT)]);
            $orgName = ($d['organization_name'] ?? null) ?: $d['name'] . "'s workspace";
            $oid = $db->insert('organizations', ['name' => $orgName, 'created_by' => $uid]);
            $db->insert('memberships', ['organization_id' => $oid, 'user_id' => $uid, 'role' => 'owner']);
            return [$uid, $oid, $orgName];
        });
        [$uid, $oid, $orgName] = $result;
        $tok = Auth::issueToken($this->app, $uid);
        return Response::json([
            'user' => ['id' => $uid, 'email' => $d['email'], 'name' => $d['name']],
            'organizations' => [['id' => $oid, 'name' => $orgName, 'role' => 'owner']],
            'token' => $tok['token'],
            'token_expires_at' => $tok['expires_at'],
        ], 201);
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
        $hash = $u['password_hash'] ?? '$2y$10$usesomesillystringforsaltzOq1Gm1Z7xYkXfM3Yp2eN6r5eFZ0hHy';
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
