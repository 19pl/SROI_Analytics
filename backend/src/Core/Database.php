<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** Thin PDO wrapper. Column/table names only ever come from code, values are always bound. */
final class Database
{
    public readonly PDO $pdo;
    private int $depth = 0;

    public function __construct(string $path)
    {
        if ($path !== ':memory:') {
            $dir = dirname($path);
            if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new \RuntimeException("Cannot create database directory $dir");
            }
        }
        $this->pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        $this->pdo->exec('PRAGMA busy_timeout = 5000');
        if ($path !== ':memory:') {
            $this->pdo->exec('PRAGMA journal_mode = WAL');
        }
    }

    /** @param array<int|string,mixed> $params @return list<array<string,mixed>> */
    public function all(string $sql, array $params = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($this->bind($params));
        return $st->fetchAll();
    }

    /** @param array<int|string,mixed> $params @return array<string,mixed>|null */
    public function one(string $sql, array $params = []): ?array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($this->bind($params));
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<int|string,mixed> $params */
    public function val(string $sql, array $params = []): mixed
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($this->bind($params));
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    }

    /** @param array<int|string,mixed> $params */
    public function run(string $sql, array $params = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($this->bind($params));
        return $st->rowCount();
    }

    /** @param array<string,mixed> $data */
    public function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(',', $cols),
            implode(',', array_map(fn($c) => ':' . $c, $cols))
        );
        $this->run($sql, $data);
        return (int)$this->pdo->lastInsertId();
    }

    /** @param array<string,mixed> $data */
    public function update(string $table, int $id, array $data): void
    {
        if ($data === []) {
            return;
        }
        $set = implode(',', array_map(fn($c) => "$c = :$c", array_keys($data)));
        $data['__id'] = $id;
        $this->run("UPDATE $table SET $set WHERE id = :__id", $data);
    }

    public function transaction(callable $fn): mixed
    {
        if ($this->depth > 0) {
            return $fn();
        }
        $this->pdo->beginTransaction();
        $this->depth++;
        try {
            $r = $fn();
            $this->pdo->commit();
            return $r;
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        } finally {
            $this->depth--;
        }
    }

    /** @param array<int|string,mixed> $params @return array<int|string,mixed> */
    private function bind(array $params): array
    {
        $out = [];
        foreach ($params as $k => $v) {
            if (is_bool($v)) {
                $v = $v ? 1 : 0;
            } elseif (is_array($v)) {
                $v = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
            }
            $out[is_string($k) ? (str_starts_with($k, ':') ? $k : ':' . $k) : $k] = $v;
        }
        return $out;
    }
}
