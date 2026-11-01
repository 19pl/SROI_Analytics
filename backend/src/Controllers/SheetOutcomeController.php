<?php
declare(strict_types=1);

namespace App\Controllers;

/** Sheet mode — outcome, valuation and adjustment lines. */
final class SheetOutcomeController extends SheetResource
{
    protected function table(): string
    {
        return 'sheet_outcomes';
    }

    protected function entity(): string
    {
        return 'sheet_outcome';
    }

    protected function band(): string
    {
        return 'outcome';
    }

    protected function order(): string
    {
        return 'group_id ASC, sort_order ASC, id ASC';
    }

    protected function rules(): array
    {
        return [
            'group_id' => ['type' => 'int', 'min' => 1, 'required' => true],
            'dimension' => ['type' => 'enum', 'in' => ['economic', 'social', 'environmental', 'other'], 'nullable' => true],
            'beneficiary' => ['type' => 'string', 'max' => 300, 'nullable' => true],
            'outcome' => ['type' => 'string', 'required' => true, 'max' => 1000],
            'quantity_text' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'weight' => ['type' => 'fraction', 'nullable' => true],
            'indicator' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'valuation_method' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'y0_raw' => self::formulaRule(),
            'y1_raw' => self::formulaRule(),
            'source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            // adjustment: null = not assessed, waits for the customer's input (fractions: 0.25 = 25 %)
            'adj_y0' => ['type' => 'fraction', 'nullable' => true],
            'adj_y0_reason' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'adj_y1' => ['type' => 'fraction', 'nullable' => true],
            'adj_y1_reason' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'adj_source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
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
