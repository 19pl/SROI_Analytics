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
            'stakeholder_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'calculation_mode' => ['type' => 'enum', 'in' => ['manual', 'quantity'], 'default' => 'manual'],
            'quantity' => ['type' => 'number', 'nullable' => true, 'min' => 0],
            'unit' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'unit_price' => ['type' => 'number', 'nullable' => true, 'min' => 0],
            'line_items' => ['type' => 'array', 'nullable' => true],
        ];
    }

    protected function cast(array $row): array
    {
        $row = parent::cast($row);
        if (isset($row['amount'])) {
            $row['amount'] = (float)$row['amount'];
        }
        if (isset($row['quantity']) && $row['quantity'] !== null) {
            $row['quantity'] = (float)$row['quantity'];
        }
        if (isset($row['unit_price']) && $row['unit_price'] !== null) {
            $row['unit_price'] = (float)$row['unit_price'];
        }
        return $row;
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
        if (isset($data['stakeholder_id'])) {
            $own = $this->app->db->one('SELECT id FROM stakeholders WHERE id = ? AND project_id = ?', [$data['stakeholder_id'], $project['id']]);
            if ($own === null) {
                throw HttpException::unprocessable('Validation failed', ['stakeholder_id' => 'must be a stakeholder of this project']);
            }
        }
        $T = $this->periodYears($project);
        if (isset($data['year']) && $T !== null && $data['year'] > $T) {
            throw HttpException::unprocessable('Validation failed', ['year' => "must not exceed the analysis period ($T years)"]);
        }

        // Line items: amount is the sum of unit_price x quantity (x optional quantity2) over the lines.
        if (array_key_exists('line_items', $data)) {
            $raw = $data['line_items'];
            if ($raw === null || $raw === []) {
                $data['line_items'] = null;
            } else {
                if (!array_is_list($raw) || count($raw) > 100) {
                    throw HttpException::unprocessable('Validation failed', ['line_items' => 'must be a list of at most 100 lines']);
                }
                $lines = [];
                $sum = 0.0;
                foreach ($raw as $i => $l) {
                    $qty = is_array($l) ? ($l['quantity'] ?? null) : null;
                    $price = is_array($l) ? ($l['unit_price'] ?? null) : null;
                    $unit = is_array($l) ? trim((string)($l['unit'] ?? '')) : '';
                    if (!is_numeric($qty) || (float)$qty <= 0) {
                        throw HttpException::unprocessable('Validation failed', ["line_items.$i.quantity" => 'must be greater than 0']);
                    }
                    if (!is_numeric($price) || (float)$price < 0) {
                        throw HttpException::unprocessable('Validation failed', ["line_items.$i.unit_price" => 'must not be negative']);
                    }
                    if ($unit === '' || mb_strlen($unit) > 100) {
                        throw HttpException::unprocessable('Validation failed', ["line_items.$i.unit" => 'must be 1-100 characters']);
                    }
                    $line = ['unit_price' => (float)$price, 'quantity' => (float)$qty, 'unit' => $unit];
                    $factor = (float)$qty * (float)$price;
                    // Optional second multiplier, e.g. 2 people x 3 days. Both parts or neither.
                    $qty2 = $l['quantity2'] ?? null;
                    $unit2 = trim((string)($l['unit2'] ?? ''));
                    if ($qty2 !== null && $qty2 !== '' || $unit2 !== '') {
                        if (!is_numeric($qty2) || (float)$qty2 <= 0) {
                            throw HttpException::unprocessable('Validation failed', ["line_items.$i.quantity2" => 'must be greater than 0']);
                        }
                        if ($unit2 === '' || mb_strlen($unit2) > 100) {
                            throw HttpException::unprocessable('Validation failed', ["line_items.$i.unit2" => 'must be 1-100 characters']);
                        }
                        $line['quantity2'] = (float)$qty2;
                        $line['unit2'] = $unit2;
                        $factor *= (float)$qty2;
                    }
                    $lines[] = $line;
                    $sum += $factor;
                }
                $expected = round($sum, 2);
                if (isset($data['amount']) && is_numeric($data['amount']) && abs((float)$data['amount'] - $expected) > 0.02) {
                    throw HttpException::unprocessable('Validation failed', ['amount' => "must equal the sum of the line items ($expected)"]);
                }
                $data['line_items'] = $lines;
                $data['amount'] = $expected;
                $data['calculation_mode'] = 'quantity';
                // Keep the legacy single-line columns in sync when there is exactly one plain line
                // (lines with a second multiplier cannot be described by quantity x unit_price alone).
                $one = count($lines) === 1 && !isset($lines[0]['quantity2']) ? $lines[0] : null;
                $data['quantity'] = $one['quantity'] ?? null;
                $data['unit'] = $one['unit'] ?? null;
                $data['unit_price'] = $one['unit_price'] ?? null;
                return $data;
            }
        }

        // Existing multi-line item updated without sending lines (e.g. a bulk edit that only sends amount).
        if (is_array($existing['line_items'] ?? null) && $existing['line_items'] !== []
            && !array_key_exists('line_items', $data)
            && array_intersect_key($data, array_flip(['quantity', 'unit', 'unit_price', 'calculation_mode'])) === []) {
            if (!isset($data['amount']) || abs((float)$data['amount'] - (float)$existing['amount']) <= 0.02) {
                unset($data['amount']); // unchanged: keep the lines
                return $data;
            }
            // A different total was typed explicitly: the lines no longer explain it, so fall back to a plain total.
            $data['amount'] = round((float)$data['amount'], 2);
            $data['line_items'] = null;
            $data['calculation_mode'] = 'manual';
            $data['quantity'] = null;
            $data['unit'] = null;
            $data['unit_price'] = null;
            return $data;
        }

        $mode = $m['calculation_mode'] ?? 'manual';
        if ($mode === 'quantity') {
            if (!array_key_exists('quantity', $m) || $m['quantity'] === null || !is_numeric($m['quantity']) || (float)$m['quantity'] <= 0) {
                throw HttpException::unprocessable('Validation failed', ['quantity' => 'must be greater than 0 in quantity mode']);
            }
            $unit = trim((string)($m['unit'] ?? ''));
            if ($unit === '') {
                throw HttpException::unprocessable('Validation failed', ['unit' => 'must not be empty in quantity mode']);
            }
            if (!array_key_exists('unit_price', $m) || $m['unit_price'] === null || !is_numeric($m['unit_price']) || (float)$m['unit_price'] < 0) {
                throw HttpException::unprocessable('Validation failed', ['unit_price' => 'must not be negative in quantity mode']);
            }
            $qty = (float)$m['quantity'];
            $price = (float)$m['unit_price'];
            $expectedAmount = round($qty * $price, 2);

            if (isset($m['amount']) && is_numeric($m['amount'])) {
                if (abs((float)$m['amount'] - $expectedAmount) > 0.02) {
                    throw HttpException::unprocessable('Validation failed', ['amount' => "must match quantity × unit_price ($expectedAmount)"]);
                }
            }
            $data['calculation_mode'] = 'quantity';
            $data['quantity'] = $qty;
            $data['unit'] = $unit;
            $data['unit_price'] = $price;
            $data['amount'] = $expectedAmount;
        } else {
            // manual mode
            if (array_key_exists('calculation_mode', $data) || array_key_exists('quantity', $data) || array_key_exists('unit', $data) || array_key_exists('unit_price', $data)) {
                $data['calculation_mode'] = 'manual';
                $data['quantity'] = null;
                $data['unit'] = null;
                $data['unit_price'] = null;
            }
            if (isset($data['amount'])) {
                $data['amount'] = round((float)$data['amount'], 2);
            }
        }

        return $data;
    }
}