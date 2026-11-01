<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;

/**
 * Shared behaviour for the sheet-mode tables (groups, input lines, outcome lines): the `custom` JSON values of the
 * user-defined columns are validated against the project's column definitions, and every formula cell is checked on write
 * so a typo is reported immediately instead of surfacing later as a blocked calculation.
 */
abstract class SheetResource extends ProjectResource
{
    /** which user-defined column band this table's rows belong to */
    abstract protected function band(): string;

    protected function order(): string
    {
        return 'sort_order ASC, id ASC';
    }

    /** `custom` stays a JSON string internally (so audit diffs compare like with like); decorate() turns it into an object. */
    protected function cast(array $row): array
    {
        $custom = $row['custom'] ?? null;
        $row = parent::cast($row);
        if ($custom !== null) {
            $row['custom'] = $custom;
        }
        foreach (['include_in_total'] as $b) {
            if (array_key_exists($b, $row) && $row[$b] !== null) {
                $row[$b] = (bool)$row[$b];
            }
        }
        return $row;
    }

    protected function decorate(array $rows, array $project): array
    {
        foreach ($rows as &$r) {
            $c = is_string($r['custom'] ?? null) ? json_decode($r['custom'], true) : ($r['custom'] ?? []);
            $r['custom'] = is_array($c) && $c !== [] ? $c : new \stdClass();
        }
        return $rows;
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $project @param array<string,mixed>|null $existing */
    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $this->requireSheetProject($project);
        if (array_key_exists('custom', $data)) {
            $data['custom'] = json_encode($this->cleanCustom($data['custom'], (int)$project['id']), JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT);
        }
        if ($existing === null && !isset($data['sort_order'])) {
            $data['sort_order'] = 1 + (int)$this->app->db->val('SELECT COALESCE(MAX(sort_order), 0) FROM ' . $this->table() . ' WHERE project_id = ?', [$project['id']]);
        }
        return $data;
    }

    protected function requireSheetProject(array $project): void
    {
        if (($project['calc_method'] ?? 'wizard') !== 'sheet') {
            throw HttpException::unprocessable('This project is not a sheet-mode project', ['calc_method' => 'must be "sheet" to use the sheet'], 'not_a_sheet_project');
        }
    }

    /**
     * @param array<string,mixed> $custom
     * @return array<string,mixed>
     */
    private function cleanCustom(array $custom, int $projectId): array
    {
        $defs = [];
        foreach ($this->app->db->all('SELECT * FROM sheet_columns WHERE project_id = ? AND band = ?', [$projectId, $this->band()]) as $c) {
            $defs[$c['key']] = $c;
        }
        $out = [];
        $errors = [];
        foreach ($custom as $key => $value) {
            $key = (string)$key;
            if (!isset($defs[$key])) {
                $errors["custom.$key"] = 'is not a column defined for this section';
                continue;
            }
            if ($value === null || (is_string($value) && trim($value) === '')) {
                continue; // an empty custom cell is simply absent
            }
            $d = $defs[$key];
            if (is_array($value)) {
                $errors["custom.$key"] = 'must be a single value';
                continue;
            }
            if (in_array($d['data_type'], ['number', 'percent'], true)) {
                $raw = is_string($value) ? trim($value) : (string)$value;
                $msg = \App\Domain\Calculation\Formula::check($raw);
                if ($msg !== null) {
                    $errors["custom.$key"] = $msg;
                    continue;
                }
                $out[$key] = $raw;
            } elseif ($d['data_type'] === 'date') {
                $dt = is_string($value) ? \DateTime::createFromFormat('!Y-m-d', $value) : false;
                if (!$dt || $dt->format('Y-m-d') !== $value) {
                    $errors["custom.$key"] = 'must be a date in YYYY-MM-DD format';
                    continue;
                }
                $out[$key] = $value;
            } elseif ($d['data_type'] === 'select') {
                $opts = json_decode((string)$d['options'], true) ?: [];
                if (!is_string($value) || !in_array($value, $opts, true)) {
                    $errors["custom.$key"] = 'must be one of the listed choices';
                    continue;
                }
                $out[$key] = $value;
            } else {
                $s = trim((string)$value);
                if (mb_strlen($s) > 2000) {
                    $errors["custom.$key"] = 'must be at most 2000 characters';
                    continue;
                }
                $out[$key] = $s;
            }
        }
        if ($errors) {
            throw HttpException::unprocessable('Validation failed', $errors);
        }
        return $out;
    }

    /** rule helper: a formula cell */
    protected static function formulaRule(): array
    {
        return ['type' => 'raw', 'max' => 500, 'nullable' => true, 'check' => fn($v) => \App\Domain\Calculation\Formula::check($v)];
    }

    /** the group must exist in the same project */
    protected function requireGroup(int $groupId, array $project): void
    {
        $ok = $this->app->db->val('SELECT 1 FROM sheet_groups WHERE id = ? AND project_id = ?', [$groupId, $project['id']]);
        if (!$ok) {
            throw HttpException::unprocessable('Validation failed', ['group_id' => 'must be a group in this project']);
        }
    }
}
