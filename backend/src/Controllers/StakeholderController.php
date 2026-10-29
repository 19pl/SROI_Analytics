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
        ];
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
