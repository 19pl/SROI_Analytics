<?php
declare(strict_types=1);

/**
 * Front controller.
 *   Dev:  php -S localhost:8000 -t public public/index.php        (from backend/)
 *   Prod: point the web server's document root at backend/public and rewrite everything to index.php.
 */
require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;
use App\Core\HttpException;
use App\Core\Kernel;
use App\Core\Request;
use App\Core\Response;

// Let the PHP built-in server serve real static files (none are expected; the API is JSON only).
if (PHP_SAPI === 'cli-server') {
    $f = __DIR__ . parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (is_file($f) && basename($f) !== 'index.php') {
        return false;
    }
}

ini_set('display_errors', '0');
try {
    $app = App::fromEnv();
    $kernel = new Kernel($app);
    $kernel->handle(Request::fromGlobals((int)$app->cfg('max_body_bytes')))->send();
} catch (HttpException $e) {
    Response::json(['error' => ['code' => $e->errorCode, 'message' => $e->getMessage()]], $e->status)->send();
} catch (\Throwable $e) {
    error_log('Boot failure: ' . $e->getMessage());
    Response::json(['error' => ['code' => 'server_error', 'message' => 'Server failed to start. Has the database been migrated (php bin/migrate.php)?']], 500)->send();
}
