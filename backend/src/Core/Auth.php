<?php
declare(strict_types=1);

namespace App\Core;

/** Bearer-token authentication. Only a SHA-256 hash of each token is stored. */
final class Auth
{
    public static function authenticate(App $app, Request $req): void
    {
        $token = $req->bearer();
        if ($token === null) {
            throw HttpException::unauthorized();
        }
        $row = $app->db->one(
            "SELECT u.id, u.email, u.name FROM api_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ? AND t.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')",
            [hash('sha256', $token)]
        );
        if ($row === null) {
            throw HttpException::unauthorized('Invalid or expired token');
        }
        $req->user = $row;
    }

    /** @return array{token:string,expires_at:string} */
    public static function issueToken(App $app, int $userId): array
    {
        $token = bin2hex(random_bytes(32));
        $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * (int)$app->cfg('token_ttl_days'));
        $app->db->insert('api_tokens', ['user_id' => $userId, 'token_hash' => hash('sha256', $token), 'expires_at' => $expires]);
        // opportunistic cleanup of expired tokens / old login attempts
        $app->db->run("DELETE FROM api_tokens WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')");
        $app->db->run("DELETE FROM login_attempts WHERE attempted_at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')");
        return ['token' => $token, 'expires_at' => $expires];
    }
}
