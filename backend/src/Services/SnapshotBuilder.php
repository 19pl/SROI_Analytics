<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\HttpException;

/** Loads a project from the database into the immutable snapshot the calculation engine (and reports) consume. */
final class SnapshotBuilder
{
    public function __construct(private App $app)
    {
    }

    /** @param array<string,mixed> $project @return array<string,mixed> */
    public function build(array $project, ?int $scenarioId = null): array
    {
        $db = $this->app->db;
        $pid = (int)$project['id'];

        $scenario = $scenarioId === null
            ? $db->one('SELECT * FROM scenarios WHERE project_id = ? AND is_base = 1', [$pid])
            : $db->one('SELECT * FROM scenarios WHERE project_id = ? AND id = ?', [$pid, $scenarioId]);
        if ($scenario === null) {
            throw HttpException::notFound('Scenario');
        }

        $adj = [];
        foreach ($db->all('SELECT a.*, u.name AS updated_by_name FROM impact_adjustments a LEFT JOIN users u ON u.id = a.updated_by
                           WHERE a.outcome_id IN (SELECT id FROM outcomes WHERE project_id = ?)', [$pid]) as $a) {
            $adj[(int)$a['outcome_id']] = [
                'deadweight' => $a['deadweight'], 'attribution' => $a['attribution'], 'displacement' => $a['displacement'],
                'drop_off' => $a['drop_off'], 'justification' => $a['justification'], 'source' => $a['source'],
                'updated_by' => $a['updated_by_name'], 'updated_at' => $a['updated_at'],
            ];
        }
        $ovs = [];
        foreach ($db->all('SELECT outcome_id, year, quantity, drop_off FROM outcome_year_projections
                           WHERE outcome_id IN (SELECT id FROM outcomes WHERE project_id = ?) ORDER BY year', [$pid]) as $o) {
            $ovs[(int)$o['outcome_id']][] = ['year' => (int)$o['year'], 'quantity' => $o['quantity'], 'drop_off' => $o['drop_off']];
        }

        $outcomes = [];
        foreach ($db->all('SELECT * FROM outcomes WHERE project_id = ? ORDER BY id', [$pid]) as $o) {
            $id = (int)$o['id'];
            $outcomes[] = [
                'id' => $id, 'stakeholder_id' => (int)$o['stakeholder_id'], 'name' => $o['name'], 'description' => $o['description'],
                'activity' => $o['activity'], 'output_description' => $o['output_description'], 'indicator' => $o['indicator'],
                'baseline' => $o['baseline'], 'observed_result' => $o['observed_result'],
                'quantity' => $o['quantity'], 'proxy_value' => $o['proxy_value'], 'proxy_unit' => $o['proxy_unit'],
                'proxy_source' => $o['proxy_source'], 'proxy_rationale' => $o['proxy_rationale'],
                'polarity' => $o['polarity'], 'projection_model' => $o['projection_model'],
                'start_year' => (int)$o['start_year'], 'duration_years' => (int)$o['duration_years'],
                'entry_years' => $o['entry_years'] === null ? null : (int)$o['entry_years'],
                'evidence_quality' => $o['evidence_quality'], 'overlap_group' => $o['overlap_group'],
                'include_in_total' => (bool)$o['include_in_total'],
                'adjustment' => $adj[$id] ?? null,
                'year_overrides' => $ovs[$id] ?? [],
            ];
        }

        // Faculty and department names for audit/report context
        $facultyName = null;
        $deptName    = null;
        if (!empty($project['faculty_id'])) {
            $fac = $db->one('SELECT name FROM faculties WHERE id = ?', [(int)$project['faculty_id']]);
            $facultyName = $fac['name'] ?? null;
        }
        if (!empty($project['department_id'])) {
            $dept = $db->one(
                'SELECT d.name AS dept_name, f.name AS faculty_name FROM departments d JOIN faculties f ON f.id = d.faculty_id WHERE d.id = ?',
                [(int)$project['department_id']]
            );
            $deptName    = $dept['dept_name'] ?? null;
            if ($facultyName === null) {
                $facultyName = $dept['faculty_name'] ?? null;
            }
        }

        $assumptions = json_decode((string)$scenario['assumptions'], true) ?: [];
        return [
            'project' => [
                'currency' => $project['currency'], 'price_basis' => $project['price_basis'],
                'analysis_period_years' => $project['analysis_period_years'] === null ? null : (int)$project['analysis_period_years'],
                'discount_rate' => $project['discount_rate'], 'discount_rate_basis' => $project['discount_rate_basis'],
                'discount_rate_source' => $project['discount_rate_source'], 'discount_base_year' => (int)$project['discount_base_year'],
                'investment_basis' => $project['investment_basis'], 'include_in_kind' => (bool)$project['include_in_kind'],
                'assessment_months' => $project['assessment_months'] === null ? null : (int)$project['assessment_months'],
            ],
            'meta' => [
                'project_id' => $pid, 'name' => $project['name'], 'organization_name' => $project['organization_name'],
                'description' => $project['description'], 'category' => $project['category'], 'country' => $project['country'],
                'start_date' => $project['start_date'], 'end_date' => $project['end_date'], 'evaluation_type' => $project['evaluation_type'],
                'faculty_name' => $facultyName, 'department_name' => $deptName,
            ],
            'costs' => array_map(fn($c) => [
                'id' => (int)$c['id'], 'category' => $c['category'], 'description' => $c['description'], 'amount' => $c['amount'],
                'currency' => $c['currency'], 'exchange_rate' => $c['exchange_rate'], 'year' => (int)$c['year'],
                'is_cash' => (bool)$c['is_cash'], 'include_in_calculation' => (bool)$c['include_in_calculation'],
                'evidence_source' => $c['evidence_source'],
                'period_label' => $c['period_label'] ?? null,
            ], $db->all('SELECT * FROM project_costs WHERE project_id = ? ORDER BY year, id', [$pid])),
            'stakeholders' => array_map(fn($s) => [
                'id' => (int)$s['id'], 'name' => $s['name'], 'description' => $s['description'], 'category' => $s['category'],
                'role_in_project' => $s['role_in_project'], 'estimated_count' => $s['estimated_count'],
                'expected_positive' => $s['expected_positive'], 'expected_negative' => $s['expected_negative'],
                'stakeholder_group' => $s['stakeholder_group'] ?? null,
                'group_code' => $s['group_code'] ?? null,
            ], $db->all('SELECT * FROM stakeholders WHERE project_id = ? ORDER BY id', [$pid])),
            'outcomes' => $outcomes,
            'evidence' => $db->all('SELECT entity_type, entity_id, kind, title, reference FROM evidence_sources WHERE project_id = ? ORDER BY id', [$pid]),
            'scenario' => [
                'id' => (int)$scenario['id'], 'name' => $scenario['name'], 'kind' => $scenario['kind'],
                'assumptions' => $assumptions,
            ],
        ];
    }

    /** Stable fingerprint of the calculation inputs. */
    public static function hash(array $snapshot): string
    {
        return hash('sha256', json_encode(self::sortKeys($snapshot), JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
    }

    private static function sortKeys(mixed $v): mixed
    {
        if (!is_array($v)) {
            return $v;
        }
        $v = array_map([self::class, 'sortKeys'], $v);
        if (!array_is_list($v)) {
            ksort($v);
        }
        return $v;
    }
}
