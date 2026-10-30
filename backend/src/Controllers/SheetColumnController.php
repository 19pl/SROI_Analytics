<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Access;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

/**
 * Sheet mode — user-defined columns: "add a new cell for a new topic". The column definition lives here; the values
 * live in each row's `custom` JSON, keyed by the column's immutable `key`.
 */
final class SheetColumnController extends ProjectResource
{
    private const MAX_COLUMNS_PER_BAND = 30;

    protected function table(): string
    {
        return 'sheet_columns';
    }

    protected function entity(): string
    {
        return 'sheet_column';
    }

    protected function order(): string
    {
        return "CASE band WHEN 'stakeholder' THEN 1 WHEN 'input' THEN 2 ELSE 3 END, sort_order ASC, id ASC";
    }

    protected function rules(): array
    {
        return [
            'band' => ['type' => 'enum', 'in' => ['stakeholder', 'input', 'outcome'], 'required' => true],
            'key' => ['type' => 'string', 'max' => 40, 'check' => fn($v) => preg_match('/^[a-z][a-z0-9_]{0,39}$/', $v) ? null : 'must be lowercase letters, digits or _ and start with a letter'],
            'label' => ['type' => 'string', 'required' => true, 'max' => 100],
            'data_type' => ['type' => 'enum', 'in' => ['text', 'number', 'percent', 'date', 'select'], 'default' => 'text'],
            'options' => ['type' => 'array'],
            'counts_toward' => ['type' => 'enum', 'in' => ['none', 'input', 'outcome'], 'default' => 'none'],
            'count_in' => ['type' => 'enum', 'in' => ['y0', 'y1'], 'default' => 'y0'],
            'sort_order' => ['type' => 'int', 'min' => 0, 'max' => 1000000],
        ];
    }

    protected function decorate(array $rows, array $project): array
    {
        foreach ($rows as &$r) {
            $o = is_string($r['options'] ?? null) ? json_decode($r['options'], true) : ($r['options'] ?? []);
            $r['options'] = is_array($o) ? array_values($o) : [];
        }
        return $rows;
    }

    protected function cast(array $row): array
    {
        $opts = $row['options'] ?? null;
        $row = parent::cast($row);
        if ($opts !== null) {
            $row['options'] = $opts; // keep the JSON string for audit diffs; decorate() decodes it
        }
        return $row;
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        if (($project['calc_method'] ?? 'wizard') !== 'sheet') {
            throw HttpException::unprocessable('This project is not a sheet-mode project', ['calc_method' => 'must be "sheet" to use the sheet'], 'not_a_sheet_project');
        }
        $m = $data + ($existing ?? []);
        $band = (string)$m['band'];
        $errors = [];

        if ($existing === null) {
            $data['key'] ??= 'c_' . bin2hex(random_bytes(4));
            $count = (int)$this->app->db->val('SELECT COUNT(*) FROM sheet_columns WHERE project_id = ? AND band = ?', [$project['id'], $band]);
            if ($count >= self::MAX_COLUMNS_PER_BAND) {
                $errors['band'] = 'at most ' . self::MAX_COLUMNS_PER_BAND . ' custom columns per section';
            }
            $dup = $this->app->db->val('SELECT 1 FROM sheet_columns WHERE project_id = ? AND band = ? AND key = ?', [$project['id'], $band, $data['key']]);
            if ($dup) {
                $errors['key'] = 'already used in this section';
            }
            if (!isset($data['sort_order'])) {
                $data['sort_order'] = 1 + (int)$this->app->db->val('SELECT COALESCE(MAX(sort_order), 0) FROM sheet_columns WHERE project_id = ? AND band = ?', [$project['id'], $band]);
            }
        } else {
            // identity never changes: values in the rows are keyed by it
            if (isset($data['key']) && $data['key'] !== $existing['key']) {
                $errors['key'] = 'cannot be changed after the column is created';
            }
            if (isset($data['band']) && $data['band'] !== $existing['band']) {
                $errors['band'] = 'cannot be changed after the column is created';
            }
            unset($data['key'], $data['band']);
        }

        $type = (string)$m['data_type'];
        $counts = (string)($m['counts_toward'] ?? 'none');
        if ($counts !== 'none') {
            if (!in_array($type, ['number', 'percent'], true)) {
                $errors['counts_toward'] = 'only number or percent columns can count toward a total';
            } elseif ($counts === 'input' && $band !== 'input') {
                $errors['counts_toward'] = '"input" is only possible for columns in the input section';
            } elseif ($counts === 'outcome' && $band !== 'outcome') {
                $errors['counts_toward'] = '"outcome" is only possible for columns in the outcome section';
            }
        }
        if ($type === 'select') {
            $opts = $data['options'] ?? (isset($existing['options']) ? json_decode((string)$existing['options'], true) : []);
            $opts = is_array($opts) ? array_values(array_unique(array_filter(array_map(fn($o) => is_scalar($o) ? trim((string)$o) : '', $opts), fn($o) => $o !== ''))) : [];
            if ($opts === []) {
                $errors['options'] = 'a select column needs at least one choice';
            }
            $data['options'] = json_encode($opts, JSON_UNESCAPED_UNICODE);
        } elseif (array_key_exists('options', $data)) {
            $data['options'] = '[]';
        }
        if ($errors) {
            throw HttpException::unprocessable('Validation failed', $errors);
        }
        return $data;
    }

    /** Removing a column also removes its values from the rows, so a later column with the same key cannot inherit stale data. */
    public function destroy(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $col = $this->find((int)$project['id'], $req->intParam('id'));
        $res = parent::destroy($req);
        $table = ['stakeholder' => 'sheet_groups', 'input' => 'sheet_inputs', 'outcome' => 'sheet_outcomes'][$col['band']];
        foreach ($this->app->db->all("SELECT id, custom FROM $table WHERE project_id = ?", [$project['id']]) as $r) {
            $c = json_decode((string)$r['custom'], true);
            if (is_array($c) && array_key_exists($col['key'], $c)) {
                unset($c[$col['key']]);
                $this->app->db->update($table, (int)$r['id'], ['custom' => json_encode($c, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT)]);
            }
        }
        return $res;
    }
}
