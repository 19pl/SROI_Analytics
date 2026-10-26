<?php
declare(strict_types=1);

namespace App\Core;

/** Service container: configuration + database. */
final class App
{
    public readonly Database $db;

    /** @param array<string,mixed> $config */
    public function __construct(public readonly array $config, ?Database $db = null)
    {
        $this->db = $db ?? new Database($config['db_path']);
    }

    public static function fromEnv(): self
    {
        $root = dirname(__DIR__, 2);
        $origins = array_values(array_filter(array_map('trim', explode(',', Env::get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000') ?? ''))));
        return new self([
            'root' => $root,
            'debug' => filter_var(Env::get('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN),
            'db_path' => self::abs(Env::get('DB_PATH', 'storage/sroi.sqlite') ?? '', $root),
            'storage_path' => self::abs(Env::get('STORAGE_PATH', 'storage') ?? '', $root),
            'token_ttl_days' => max(1, (int)Env::get('TOKEN_TTL_DAYS', '30')),
            'cors_origins' => $origins,
            'max_body_bytes' => 2 * 1024 * 1024,
            'max_upload_bytes' => max(1, (int)Env::get('MAX_UPLOAD_MB', '10')) * 1024 * 1024,
            'public_report_base_url' => rtrim(Env::get('PUBLIC_REPORT_BASE_URL', '') ?? '', '/'),
        ]);
    }

    public function cfg(string $key): mixed
    {
        return $this->config[$key] ?? null;
    }

    private static function abs(string $path, string $root): string
    {
        if ($path === ':memory:' || str_starts_with($path, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $path)) {
            return $path;
        }
        return $root . '/' . $path;
    }
}
