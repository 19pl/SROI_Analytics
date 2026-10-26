<?php
declare(strict_types=1);

// Usage: php bin/migrate.php
require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;
use App\Core\Migrator;

$app = App::fromEnv();
$applied = Migrator::run($app->db, dirname(__DIR__) . '/database/migrations');
echo $applied === [] ? "Database is up to date.\n" : 'Applied: ' . implode(', ', $applied) . "\n";
echo 'Database: ' . $app->cfg('db_path') . "\n";
