<?php
declare(strict_types=1);

namespace App\Controllers;

/** Sheet mode — input (resource / budget) lines. */
final class SheetInputController extends SheetResource
{
    protected function table(): string
    {
        return 'sheet_inputs';
    }

    protected function entity(): string
    {
        return 'sheet_input';
    }

    protected function band(): string
    {
        return 'input';
    }

    protected function order(): string
    {
        return 'group_id ASC, sort_order ASC, id ASC';
    }

    protected function rules(): array
    {
        return [
            'group_id' => ['type' => 'int', 'min' => 1, 'required' => true],
            'resource' => ['type' => 'string', 'required' => true, 'max' => 500],
            'y0_raw' => self::formulaRule(),
            'y1_raw' => self::formulaRule(),
            'basis' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'include_in_total' => ['type' => 'bool', 'default' => true],
            'sort_order' => ['type' => 'int', 'min' => 0, 'max' => 1000000],
            'custom' => ['type' => 'array'],
        ];
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $data = parent::prepare($data, $project, $existing);
        if (isset($data['group_id'])) {
            $this->requireGroup((int)$data['group_id'], $project);
        }
        return $data;
    }
}
