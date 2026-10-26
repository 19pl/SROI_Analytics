<?php
declare(strict_types=1);

namespace Tests;

/** Tiny dependency-free test harness (PHPUnit is not required). */
final class T
{
    public static int $pass = 0;
    public static int $fail = 0;
    /** @var list<string> */
    public static array $failures = [];
    public static string $current = '';

    public static function test(string $name, callable $fn): void
    {
        self::$current = $name;
        try {
            $fn();
        } catch (\Throwable $e) {
            self::$fail++;
            self::$failures[] = "[$name] threw " . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine();
        }
    }

    public static function eq(mixed $expected, mixed $actual, string $msg = ''): void
    {
        $ok = is_float($expected) || is_float($actual)
            ? (is_numeric($actual) && abs((float)$expected - (float)$actual) < 1e-9)
            : $expected === $actual;
        self::record($ok, $msg, 'expected ' . json_encode($expected) . ' got ' . json_encode($actual));
    }

    public static function true(mixed $v, string $msg = ''): void
    {
        self::record($v === true, $msg, 'expected true got ' . json_encode($v));
    }

    public static function throws(string $class, callable $fn, string $msg = ''): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            self::record($e instanceof $class, $msg, "expected $class got " . get_class($e) . ': ' . $e->getMessage());
            return;
        }
        self::record(false, $msg, "expected $class, nothing thrown");
    }

    private static function record(bool $ok, string $msg, string $detail): void
    {
        if ($ok) {
            self::$pass++;
        } else {
            self::$fail++;
            self::$failures[] = '[' . self::$current . '] ' . ($msg !== '' ? "$msg: " : '') . $detail;
        }
    }
}
