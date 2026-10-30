<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;

/** Sheet mode — stakeholder groups and sub-groups (S1, S1.1 ...). */
final class SheetGroupController extends SheetResource
{
    protected function table(): string
    {
        return 'sheet_groups';
    }

    protected function entity(): string
    {
        return 'sheet_group';
    }

    protected function band(): string
    {
        return 'stakeholder';
    }

    protected function conflictMessage(): string
    {
        return 'This group could not be deleted';
    }

    protected function rules(): array
    {
        return [
            'parent_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'code' => ['type' => 'string', 'max' => 30, 'nullable' => true],
            'group_type' => ['type' => 'enum', 'in' => ['primary_beneficiary', 'project_operator', 'project_supporter', 'other_agency'], 'nullable' => true],
            'name' => ['type' => 'string', 'required' => true, 'max' => 300],
            'population_raw' => self::formulaRule(),
            'unit' => ['type' => 'string', 'max' => 50, 'nullable' => true],
            'note' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'activity' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'activity_summary' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'actual_count_raw' => self::formulaRule(),
            'actual_count_method' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'sort_order' => ['type' => 'int', 'min' => 0, 'max' => 1000000],
            'custom' => ['type' => 'array'],
        ];
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $data = parent::prepare($data, $project, $existing);
        if (array_key_exists('parent_id', $data) && $data['parent_id'] !== null) {
            $pid = (int)$data['parent_id'];
            $parent = $this->app->db->one('SELECT id, parent_id FROM sheet_groups WHERE id = ? AND project_id = ?', [$pid, $project['id']]);
            if ($parent === null) {
                throw HttpException::unprocessable('Validation failed', ['parent_id' => 'must be a group in this project']);
            }
            if ($parent['parent_id'] !== null) {
                throw HttpException::unprocessable('Validation failed', ['parent_id' => 'sub-groups can only sit directly under a top-level group (S1..S4)']);
            }
            if ($existing !== null) {
                if ($pid === (int)$existing['id']) {
                    throw HttpException::unprocessable('Validation failed', ['parent_id' => 'a group cannot be its own parent']);
                }
                $hasChildren = $this->app->db->val('SELECT 1 FROM sheet_groups WHERE parent_id = ?', [$existing['id']]);
                if ($hasChildren) {
                    throw HttpException::unprocessable('Validation failed', ['parent_id' => 'a group that has sub-groups must stay top-level']);
                }
            }
        }
        return $data;
    }
}
