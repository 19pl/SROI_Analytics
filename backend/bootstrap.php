<?php
declare(strict_types=1);

// PSR-4 autoloader for App\ => src/ (no Composer dependencies required).
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

\App\Core\Env::load(__DIR__ . '/.env');
