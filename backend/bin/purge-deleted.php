<?php
declare(strict_types=1);

// Data-retention job: permanently removes projects soft-deleted more than N days ago (default 30), with their evidence files.
// Usage: php bin/purge-deleted.php [--days=30] [--dry-run]
require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;

$days = 30;
$dry = false;
foreach (array_slice($argv, 1) as $a) {
    if (preg_match('/^--days=(\d+)$/', $a, $m)) {
        $days = (int)$m[1];
    } elseif ($a === '--dry-run') {
        $dry = true;
    }
}
$app = App::fromEnv();
$cut = gmdate('Y-m-d\TH:i:s\Z', time() - 86400 * $days);
$rows = $app->db->all('SELECT id, name FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?', [$cut]);
foreach ($rows as $p) {
    echo ($dry ? '[dry-run] would purge' : 'Purging') . " project #{$p['id']} ({$p['name']})\n";
    if ($dry) {
        continue;
    }
    foreach ($app->db->all('SELECT file_path FROM evidence_sources WHERE project_id = ? AND file_path IS NOT NULL', [$p['id']]) as $f) {
        @unlink($app->cfg('storage_path') . '/' . $f['file_path']);
    }
    $app->db->run('DELETE FROM audit_events WHERE project_id = ?', [$p['id']]);
    $app->db->run('DELETE FROM projects WHERE id = ?', [$p['id']]);
}
echo count($rows) . " project(s) " . ($dry ? 'eligible' : 'purged') . ".\n";
