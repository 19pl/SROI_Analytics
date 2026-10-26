<?php
declare(strict_types=1);

namespace App\Core;

final class Migrator
{
    /** @return list<string> versions applied now */
    public static function run(Database $db, string $dir): array
    {
        $db->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
        $done = array_column($db->all('SELECT version FROM schema_migrations'), 'version');
        $applied = [];
        $files = glob(rtrim($dir, '/') . '/*.sql') ?: [];
        sort($files);
        foreach ($files as $file) {
            $version = basename($file, '.sql');
            if (in_array($version, $done, true)) {
                continue;
            }
            $db->transaction(function () use ($db, $file, $version) {
                $db->pdo->exec((string)file_get_contents($file));
                $db->run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))", [$version]);
            });
            $applied[] = $version;
        }
        return $applied;
    }
}
