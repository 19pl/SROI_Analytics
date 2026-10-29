<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;

/** Step 1 — investment items. */
final class CostController extends ProjectResource
{
    protected function table(): string
    {
        return 'project_costs';
    }

    protected function entity(): string
    {
        return 'cost';
    }

    protected function order(): string
    {
        return 'year ASC, id ASC';
    }

    protected function rules(): array
    {
        return [
            'category' => ['type' => 'enum', 'in' => ['capex', 'opex', 'delivery', 'administration', 'in_kind', 'other'], 'required' => true],
            'description' => ['type' => 'string', 'required' => true, 'max' => 500],
            'amount' => ['type' => 'number', 'required' => true, 'min' => 0, 'max' => 1e13],
            'currency' => ['type' => 'string', 'min' => 3, 'max' => 3, 'check' => fn($v) => preg_match('/^[A-Za-z]{3}$/', $v) ? null : 'must be a 3-letter currency code'],
            'exchange_rate' => ['type' => 'number', 'min' => 0.0000001, 'max' => 1e9, 'default' => 1.0],
            'year' => ['type' => 'int', 'required' => true, 'min' => 0, 'max' => 100],
            'incurred_on' => ['type' => 'date', 'nullable' => true],
            'is_cash' => ['type' => 'bool', 'default' => true],
            'include_in_calculation' => ['type' => 'bool', 'default' => true],
            'evidence_source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'notes' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'period_label' => ['type' => 'string', 'max' => 100, 'nullable' => true],
        ];
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $m = $data + ($existing ?? []);
        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        } elseif ($existing === null) {
            $data['currency'] = $project['currency'];
        }
        $cur = $data['currency'] ?? $existing['currency'] ?? $project['currency'];
        if ($cur === $project['currency']) {
            $data['exchange_rate'] = 1.0;
        }
        if (($m['category'] ?? null) === 'in_kind') {
            $data['is_cash'] = false; // contributed resources are never cash expenditure
        }
        $T = $this->periodYears($project);
        if (isset($data['year']) && $T !== null && $data['year'] > $T) {
            throw HttpException::unprocessable('Validation failed', ['year' => "must not exceed the analysis period ($T years)"]);
        }
        return $data;
    }
}
