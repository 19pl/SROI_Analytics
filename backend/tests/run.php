<?php
declare(strict_types=1);

// Usage: php tests/run.php [filter]
require __DIR__ . '/../bootstrap.php';
require __DIR__ . '/TestCase.php';

$filter = $argv[1] ?? '';
foreach (glob(__DIR__ . '/*Test.php') as $file) {
    if ($filter !== '' && !str_contains($file, $filter)) {
        continue;
    }
    require $file;
}

echo "\nPassed: " . Tests\T::$pass . "  Failed: " . Tests\T::$fail . "\n";
foreach (Tests\T::$failures as $f) {
    echo "  FAIL $f\n";
}
exit(Tests\T::$fail === 0 ? 0 : 1);
