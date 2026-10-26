<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Access;
use App\Core\Audit;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

/** Steps 3 & 4 — outcomes, financial proxies, impact adjustments and per-year projections. */
final class OutcomeController extends ProjectResource
{
    protected function table(): string
    {
        return 'outcomes';
    }

    protected function entity(): string
    {
        return 'outcome';
    }

    protected function rules(): array
    {
        return [
            'stakeholder_id' => ['type' => 'int', 'required' => true, 'min' => 1],
            'proxy_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'name' => ['type' => 'string', 'required' => true, 'max' => 300],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'category' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'activity' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'output_description' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'indicator' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'baseline' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'observed_result' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'quantity' => ['type' => 'number', 'min' => 0, 'max' => 1e12, 'default' => 0.0],
            'proxy_value' => ['type' => 'number', 'min' => 0, 'max' => 1e13, 'nullable' => true],
            'proxy_unit' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'proxy_source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'proxy_rationale' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'polarity' => ['type' => 'enum', 'in' => ['positive', 'negative'], 'default' => 'positive'],
            'projection_model' => ['type' => 'enum', 'in' => ['cohort', 'recurring_cohorts', 'independent'], 'default' => 'cohort'],
            'start_year' => ['type' => 'int', 'min' => 1, 'max' => 100, 'default' => 1],
            'duration_years' => ['type' => 'int', 'min' => 1, 'max' => 200, 'default' => 1],
            'entry_years' => ['type' => 'int', 'min' => 1, 'max' => 100, 'nullable' => true],
            'evidence_quality' => ['type' => 'enum', 'in' => ['measured', 'external', 'estimated', 'assumed'], 'required' => true],
            'overlap_group' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'include_in_total' => ['type' => 'bool', 'default' => true],
        ];
    }

    protected function prepare(array $data, array $project, ?array $existing): array
    {
        $pid = (int)$project['id'];
        if (isset($data['stakeholder_id'])
            && $this->app->db->val('SELECT 1 FROM stakeholders WHERE id = ? AND project_id = ?', [$data['stakeholder_id'], $pid]) === null) {
            throw HttpException::unprocessable('Validation failed', ['stakeholder_id' => 'must be a stakeholder of this project']);
        }
        if (isset($data['proxy_id']) && $this->app->db->val(
            'SELECT 1 FROM financial_proxies WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)',
            [$data['proxy_id'], $project['organization_id']]
        ) === null) {
            throw HttpException::unprocessable('Validation failed', ['proxy_id' => 'unknown financial proxy']);
        }
        $T = $this->periodYears($project);
        if (isset($data['start_year']) && $T !== null && $data['start_year'] > $T) {
            throw HttpException::unprocessable('Validation failed', ['start_year' => "must not exceed the analysis period ($T years)"]);
        }
        $model = $data['projection_model'] ?? $existing['projection_model'] ?? 'cohort';
        if ($model !== 'recurring_cohorts') {
            $data['entry_years'] = null;
        }
        return $data;
    }

    protected function conflictMessage(): string
    {
        return 'This outcome cannot be deleted right now';
    }

    protected function decorate(array $rows, array $project): array
    {
        if ($rows === []) {
            return $rows;
        }
        $adj = [];
        foreach ($this->app->db->all(
            'SELECT a.*, u.name AS updated_by_name FROM impact_adjustments a LEFT JOIN users u ON u.id = a.updated_by
             WHERE a.outcome_id IN (SELECT id FROM outcomes WHERE project_id = ?)',
            [$project['id']]
        ) as $a) {
            $adj[(int)$a['outcome_id']] = $a;
        }
        $ovs = [];
        foreach ($this->app->db->all(
            'SELECT outcome_id, year, quantity, drop_off, note FROM outcome_year_projections
             WHERE outcome_id IN (SELECT id FROM outcomes WHERE project_id = ?) ORDER BY year',
            [$project['id']]
        ) as $o) {
            $ovs[(int)$o['outcome_id']][] = ['year' => (int)$o['year'], 'quantity' => $o['quantity'], 'drop_off' => $o['drop_off'], 'note' => $o['note']];
        }
        foreach ($rows as &$r) {
            $id = (int)$r['id'];
            $r['monetized'] = $r['proxy_value'] !== null;
            $r['annual_gross_value'] = $r['proxy_value'] === null ? null : round((float)$r['quantity'] * (float)$r['proxy_value'], 2);
            $r['formula_preview'] = $r['proxy_value'] === null ? null
                : sprintf('Annual estimated outcome value = %s units x %s per unit = %s', (float)$r['quantity'], (float)$r['proxy_value'], $r['annual_gross_value']);
            $r['adjustment'] = isset($adj[$id]) ? $this->presentAdjustment($adj[$id], $r) : null;
            $r['year_overrides'] = $ovs[$id] ?? [];
        }
        return $rows;
    }

    protected function afterWrite(Request $req, array $project, array $row, bool $created): void
    {
        $adj = $req->body()['adjustment'] ?? null;
        if (is_array($adj)) {
            $this->saveAdjustment($req, $project, (int)$row['id'], $adj);
        }
    }

    // ---- adjustments ---------------------------------------------------------------------------

    public function getAdjustment(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'));
        $o = $this->cast($this->find((int)$project['id'], $req->intParam('id')));
        $a = $this->app->db->one(
            'SELECT a.*, u.name AS updated_by_name FROM impact_adjustments a LEFT JOIN users u ON u.id = a.updated_by WHERE a.outcome_id = ?',
            [$o['id']]
        );
        return Response::json(['data' => $a === null ? null : $this->presentAdjustment($a, $o)]);
    }

    public function putAdjustment(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $o = $this->cast($this->find((int)$project['id'], $req->intParam('id')));
        $this->saveAdjustment($req, $project, (int)$o['id'], $req->body());
        $a = $this->app->db->one(
            'SELECT a.*, u.name AS updated_by_name FROM impact_adjustments a LEFT JOIN users u ON u.id = a.updated_by WHERE a.outcome_id = ?',
            [$o['id']]
        );
        return Response::json(['data' => $this->presentAdjustment($a, $o)]);
    }

    /** @param array<string,mixed> $input */
    private function saveAdjustment(Request $req, array $project, int $outcomeId, array $input): void
    {
        $data = Validator::validate($input, [
            'deadweight' => ['type' => 'fraction', 'nullable' => true],
            'attribution' => ['type' => 'fraction', 'nullable' => true],
            'displacement' => ['type' => 'fraction', 'nullable' => true],
            'drop_off' => ['type' => 'fraction', 'nullable' => true],
            'justification' => ['type' => 'string', 'max' => 3000, 'nullable' => true],
            'source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
        ], true);
        $db = $this->app->db;
        $existing = $db->one('SELECT * FROM impact_adjustments WHERE outcome_id = ?', [$outcomeId]);
        $data['updated_by'] = $req->user['id'];
        $data['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
        if ($existing === null) {
            $db->insert('impact_adjustments', $data + ['outcome_id' => $outcomeId]);
            [$old, $new] = [null, $this->auditable($data)];
            $action = 'create';
        } else {
            [$old, $new] = Audit::diff($existing, array_diff_key($data, ['updated_by' => 1, 'updated_at' => 1]));
            if ($new === [] ) {
                return;
            }
            $db->update('impact_adjustments', (int)$existing['id'], $data);
            $action = 'update';
        }
        $this->touch((int)$project['id']);
        Audit::log($this->app, $req, $project, 'impact_adjustment', $outcomeId, $action, $old, $new);
    }

    /** @param array<string,mixed> $a @param array<string,mixed> $o @return array<string,mixed> */
    private function presentAdjustment(array $a, array $o): array
    {
        $out = [
            'deadweight' => $a['deadweight'], 'attribution' => $a['attribution'], 'displacement' => $a['displacement'],
            'drop_off' => $a['drop_off'], 'justification' => $a['justification'], 'source' => $a['source'],
            'assessed' => $a['deadweight'] !== null || $a['attribution'] !== null || $a['displacement'] !== null,
            'updated_by' => $a['updated_by_name'] ?? null,
            'updated_at' => $a['updated_at'],
        ];
        if ($o['proxy_value'] !== null) {
            // step-by-step effect of each deduction on a single year's value (before drop-off and discounting)
            $g = (float)$o['quantity'] * (float)$o['proxy_value'];
            $s1 = $g * (1 - (float)($a['deadweight'] ?? 0));
            $s2 = $s1 * (1 - (float)($a['attribution'] ?? 0));
            $s3 = $s2 * (1 - (float)($a['displacement'] ?? 0));
            $out['preview'] = [
                'gross_annual_value' => round($g, 2),
                'after_deadweight' => round($s1, 2),
                'after_attribution' => round($s2, 2),
                'after_displacement' => round($s3, 2),
                'note' => 'Deductions are multiplicative. Drop-off and discounting are applied later, per year.',
            ];
        }
        return $out;
    }

    // ---- per-year projection overrides ------------------------------------------------------------

    public function getYears(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'));
        $o = $this->find((int)$project['id'], $req->intParam('id'));
        return Response::json(['data' => $this->app->db->all(
            'SELECT year, quantity, drop_off, note FROM outcome_year_projections WHERE outcome_id = ? ORDER BY year',
            [$o['id']]
        )]);
    }

    /**
     * Replace all per-year overrides. `year` means:
     *  - quantity: year since the outcome started (new entrants for recurring_cohorts; measured quantity for independent)
     *  - drop_off: year of persistence since a cohort entered (ignored by the independent model)
     */
    public function putYears(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $o = $this->find((int)$project['id'], $req->intParam('id'));
        $items = $req->body()['overrides'] ?? null;
        if (!is_array($items) || ($items !== [] && !array_is_list($items)) || count($items) > 200) {
            throw HttpException::unprocessable('Validation failed', ['overrides' => 'must be a list of at most 200 items']);
        }
        $clean = [];
        $errors = [];
        $seen = [];
        foreach ($items as $i => $it) {
            try {
                $d = Validator::validate(is_array($it) ? $it : [], [
                    'year' => ['type' => 'int', 'required' => true, 'min' => 1, 'max' => 200],
                    'quantity' => ['type' => 'number', 'min' => 0, 'max' => 1e12, 'nullable' => true],
                    'drop_off' => ['type' => 'fraction', 'nullable' => true],
                    'note' => ['type' => 'string', 'max' => 500, 'nullable' => true],
                ]);
            } catch (HttpException $e) {
                $errors["overrides.$i"] = $e->details;
                continue;
            }
            if (isset($seen[$d['year']])) {
                $errors["overrides.$i.year"] = 'duplicate year';
                continue;
            }
            $seen[$d['year']] = true;
            if (($d['quantity'] ?? null) !== null && $o['projection_model'] === 'cohort') {
                $errors["overrides.$i.quantity"] = 'a single cohort has one quantity; switch the outcome to recurring_cohorts or independent for per-year quantities';
                continue;
            }
            $clean[] = $d + ['quantity' => null, 'drop_off' => null, 'note' => null];
        }
        if ($errors) {
            throw HttpException::unprocessable('Validation failed', $errors);
        }
        $db = $this->app->db;
        $old = $db->all('SELECT year, quantity, drop_off, note FROM outcome_year_projections WHERE outcome_id = ? ORDER BY year', [$o['id']]);
        $db->transaction(function () use ($db, $o, $clean) {
            $db->run('DELETE FROM outcome_year_projections WHERE outcome_id = ?', [$o['id']]);
            foreach ($clean as $c) {
                $db->insert('outcome_year_projections', $c + ['outcome_id' => $o['id']]);
            }
        });
        usort($clean, fn($a, $b) => $a['year'] <=> $b['year']);
        $this->touch((int)$project['id']);
        Audit::log($this->app, $req, $project, 'outcome_year_projections', (int)$o['id'], 'replace', ['overrides' => $old], ['overrides' => $clean]);
        return Response::json(['data' => $clean]);
    }
}
