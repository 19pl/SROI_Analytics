<?php
declare(strict_types=1);

namespace App\Controllers;

/** Step 2 — who is affected. */
final class StakeholderController extends ProjectResource
{
    protected function table(): string
    {
        return 'stakeholders';
    }

    protected function entity(): string
    {
        return 'stakeholder';
    }

    protected function rules(): array
    {
        return [
            'name' => ['type' => 'string', 'required' => true, 'max' => 200],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'category' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'role_in_project' => ['type' => 'string', 'max' => 500, 'nullable' => true],
            'estimated_count' => ['type' => 'int', 'min' => 0, 'max' => 2000000000, 'nullable' => true],
            'expected_positive' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'expected_negative' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'evidence_source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'overlap_notes' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'stakeholder_group' => ['type' => 'enum', 'in' => ['primary_beneficiary', 'project_operator', 'project_supporter', 'other_agency'], 'nullable' => true],
            'group_code' => ['type' => 'string', 'max' => 50, 'nullable' => true],
            'count_unit' => ['type' => 'string', 'max' => 50, 'nullable' => true],
            // Dynamic fields for S1-S4
            'target_characteristics' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'needs_or_problems' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'operation_period' => ['type' => 'string', 'max' => 500, 'nullable' => true],
            'resources_used' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'support_type' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'support_value' => ['type' => 'number', 'min' => 0, 'nullable' => true],
            'support_amount_or_quantity' => ['type' => 'string', 'max' => 500, 'nullable' => true],
            'cooperation_type' => ['type' => 'string', 'max' => 500, 'nullable' => true],
            'resources_provided' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ];
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $m = $data + ($existing ?? []);
        $grp = $m['stakeholder_group'] ?? 'primary_beneficiary';

        // Isolate fields per S-group to prevent data cross-contamination
        if ($grp === 'primary_beneficiary') {
            $data['operation_period'] = null;
            $data['resources_used'] = null;
            $data['support_type'] = null;
            $data['support_value'] = null;
            $data['support_amount_or_quantity'] = null;
            $data['cooperation_type'] = null;
            $data['resources_provided'] = null;
        } elseif ($grp === 'project_operator') {
            $data['target_characteristics'] = null;
            $data['needs_or_problems'] = null;
            $data['support_type'] = null;
            $data['support_value'] = null;
            $data['support_amount_or_quantity'] = null;
            $data['cooperation_type'] = null;
            $data['resources_provided'] = null;
        } elseif ($grp === 'project_supporter') {
            $data['target_characteristics'] = null;
            $data['needs_or_problems'] = null;
            $data['operation_period'] = null;
            $data['resources_used'] = null;
            $data['cooperation_type'] = null;
            $data['resources_provided'] = null;
        } elseif ($grp === 'other_agency') {
            $data['target_characteristics'] = null;
            $data['needs_or_problems'] = null;
            $data['operation_period'] = null;
            $data['resources_used'] = null;
            $data['support_type'] = null;
            $data['support_value'] = null;
            $data['support_amount_or_quantity'] = null;
        }

        if (isset($data['support_value']) && $data['support_value'] !== null) {
            $data['support_value'] = round((float)$data['support_value'], 2);
        }

        return $data;
    }

    protected function cast(array $row): array
    {
        $row = parent::cast($row);
        if (isset($row['support_value']) && $row['support_value'] !== null) {
            $row['support_value'] = (float)$row['support_value'];
        }
        return $row;
    }

    protected function conflictMessage(): string
    {
        return 'This stakeholder still has outcomes. Reassign or delete those outcomes first.';
    }

    protected function decorate(array $rows, array $project): array
    {
        $counts = [];
        foreach ($this->app->db->all('SELECT stakeholder_id, COUNT(*) c FROM outcomes WHERE project_id = ? GROUP BY stakeholder_id', [$project['id']]) as $r) {
            $counts[(int)$r['stakeholder_id']] = (int)$r['c'];
        }
        foreach ($rows as &$r) {
            $r['outcome_count'] = $counts[(int)$r['id']] ?? 0;
        }
        return $rows;
    }
}
