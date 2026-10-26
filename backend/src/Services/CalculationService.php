<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Request;
use App\Domain\Calculation\CalculationEngine;
use App\Domain\Calculation\InvalidSnapshotException;

final class CalculationService
{
    private CalculationEngine $engine;
    private SnapshotBuilder $builder;

    public function __construct(private App $app)
    {
        $this->engine = new CalculationEngine();
        $this->builder = new SnapshotBuilder($app);
    }

    public function engine(): CalculationEngine
    {
        return $this->engine;
    }

    public function builder(): SnapshotBuilder
    {
        return $this->builder;
    }

    /**
     * Calculate (and optionally persist) a run for one scenario.
     * @param array<string,mixed> $project
     * @return array{snapshot:array<string,mixed>,result:array<string,mixed>,hash:string,run:?array<string,mixed>}
     * @throws InvalidSnapshotException
     */
    public function calculate(array $project, ?int $scenarioId, ?Request $req, bool $save): array
    {
        $snapshot = $this->builder->build($project, $scenarioId);
        $result = $this->engine->calculate($snapshot);
        $hash = SnapshotBuilder::hash($snapshot);
        $run = null;
        if ($save) {
            $s = $result['summary'];
            $id = $this->app->db->insert('calculation_runs', [
                'project_id' => $project['id'],
                'scenario_id' => $snapshot['scenario']['id'],
                'scenario_name' => $snapshot['scenario']['name'],
                'methodology_version' => $result['methodology_version'],
                'input_hash' => $hash,
                'sroi_ratio' => $s['sroi_ratio'],
                'present_value' => $s['present_value_of_impact'],
                'investment' => $s['investment_used'],
                'net_social_value' => $s['net_social_value'],
                'snapshot' => $snapshot,
                'result' => $result,
                'created_by' => $req?->user['id'] ?? null,
            ]);
            $run = $this->runMeta($id);
        }
        return ['snapshot' => $snapshot, 'result' => $result, 'hash' => $hash, 'run' => $run];
    }

    /** @return array<string,mixed>|null */
    public function runMeta(int $id): ?array
    {
        return $this->app->db->one(
            'SELECT id, project_id, scenario_id, scenario_name, methodology_version, input_hash, sroi_ratio, present_value, investment,
                    net_social_value, created_by, created_at FROM calculation_runs WHERE id = ?',
            [$id]
        );
    }

    /**
     * All scenarios for the project, calculated against the current data. Scenarios that cannot be calculated are reported, not hidden.
     * @param array<string,mixed> $project
     * @return list<array<string,mixed>>
     */
    public function compareScenarios(array $project): array
    {
        $out = [];
        foreach ($this->app->db->all('SELECT id, name, kind, is_base, assumptions FROM scenarios WHERE project_id = ? ORDER BY is_base DESC, id', [$project['id']]) as $sc) {
            $row = ['scenario_id' => (int)$sc['id'], 'name' => $sc['name'], 'kind' => $sc['kind'], 'is_base' => (bool)$sc['is_base'],
                'assumptions' => json_decode((string)$sc['assumptions'], true) ?: new \stdClass()];
            try {
                $c = $this->calculate($project, (int)$sc['id'], null, false);
                $s = $c['result']['summary'];
                $row += ['status' => 'ok', 'sroi_ratio' => $s['sroi_ratio'], 'present_value_of_impact' => $s['present_value_of_impact'],
                    'total_investment' => $s['investment_used'], 'net_social_value' => $s['net_social_value'], 'net_return_pct' => $s['net_return_pct']];
            } catch (InvalidSnapshotException $e) {
                $row += ['status' => 'invalid', 'errors' => $e->errors];
            }
            $out[] = $row;
        }
        return $out;
    }

    /**
     * Step 5: readiness, warnings, and per-step completion for the guided workflow.
     * @param array<string,mixed> $project
     * @return array<string,mixed>
     */
    public function review(array $project): array
    {
        $snapshot = $this->builder->build($project, null);
        $errors = $this->engine->validate($snapshot);
        $warnings = [];
        $summary = null;
        if ($errors === []) {
            $result = $this->engine->calculate($snapshot);
            $warnings = $result['warnings'];
            $summary = $result['summary'];
        }
        $hash = SnapshotBuilder::hash($snapshot);
        $lastRun = $this->app->db->one('SELECT id, input_hash, created_at FROM calculation_runs WHERE project_id = ? AND scenario_id = ? ORDER BY id DESC LIMIT 1', [$project['id'], $snapshot['scenario']['id']]);

        $p = $snapshot['project'];
        $issues = [1 => [], 2 => [], 3 => [], 4 => [], 5 => [], 6 => []];
        if ($snapshot['costs'] === []) {
            $issues[1][] = 'Add at least one investment item.';
        }
        if ($p['analysis_period_years'] === null) {
            $issues[1][] = 'Set the analysis period.';
        }
        if ($p['investment_basis'] === null) {
            $issues[1][] = 'Choose how investment is compared with present-value outcomes.';
        }
        if ($snapshot['stakeholders'] === []) {
            $issues[2][] = 'Identify at least one stakeholder group.';
        }
        if ($snapshot['outcomes'] === []) {
            $issues[3][] = 'Add at least one outcome.';
        }
        foreach ($snapshot['outcomes'] as $o) {
            if ($o['proxy_value'] === null) {
                continue; // unmonetised outcomes are allowed; they are reported qualitatively
            }
            if ((float)$o['quantity'] <= 0) {
                $issues[3][] = "Outcome \"{$o['name']}\" needs a quantity greater than zero.";
            }
            if (trim((string)$o['proxy_source']) === '' && trim((string)$o['proxy_rationale']) === '') {
                $issues[3][] = "Outcome \"{$o['name']}\" needs a proxy source or a stated assumption.";
            }
            $a = $o['adjustment'];
            if ($a === null || ($a['deadweight'] === null && $a['attribution'] === null && $a['displacement'] === null)) {
                $issues[4][] = "Outcome \"{$o['name']}\": assess deadweight, attribution and displacement (0% is a valid answer).";
            } elseif (trim((string)$a['justification']) === '' && trim((string)$a['source']) === '') {
                $issues[4][] = "Outcome \"{$o['name']}\": document the basis for the adjustments.";
            }
        }
        if ($p['discount_rate'] === null) {
            $issues[4][] = 'Choose a discount rate (0% is allowed) and record why.';
        }
        foreach ($errors as $e) {
            $issues[5][] = $e['message'];
        }
        if ($lastRun === null || $lastRun['input_hash'] !== $hash) {
            $issues[6][] = $lastRun === null ? 'Run a calculation.' : 'Inputs changed since the last saved calculation.';
        }
        $steps = [];
        foreach ($issues as $n => $list) {
            $steps[$n] = ['complete' => $list === [], 'issues' => $list];
        }

        return [
            'ready_to_calculate' => $errors === [],
            'errors' => $errors,
            'warnings' => $warnings,
            'steps' => $steps,
            'preview_summary' => $summary,
            'investment' => $this->investmentSummary($snapshot),
            'counts' => ['costs' => count($snapshot['costs']), 'stakeholders' => count($snapshot['stakeholders']), 'outcomes' => count($snapshot['outcomes'])],
            'latest_saved_run' => $lastRun === null ? null : ['id' => (int)$lastRun['id'], 'created_at' => $lastRun['created_at'], 'up_to_date' => $lastRun['input_hash'] === $hash],
            'input_hash' => $hash,
        ];
    }

    /**
     * Live investment summary (works on drafts). Uses the same counting rule as the engine.
     * @param array<string,mixed> $snapshot
     * @return array<string,mixed>
     */
    public function investmentSummary(array $snapshot): array
    {
        $inKindOk = (bool)$snapshot['project']['include_in_kind'];
        $initial = $recurring = $inKind = $total = 0.0;
        $byYear = [];
        $flags = [];
        $seen = [];
        foreach ($snapshot['costs'] as $c) {
            $amt = round((float)$c['amount'] * (float)$c['exchange_rate'], 2);
            if (!$c['include_in_calculation'] || (!$c['is_cash'] && !$inKindOk)) {
                continue;
            }
            $total += $amt;
            $byYear[$c['year']] = ($byYear[$c['year']] ?? 0.0) + $amt;
            if (!$c['is_cash']) {
                $inKind += $amt;
            } elseif ($c['category'] === 'capex') {
                $initial += $amt;
            } else {
                $recurring += $amt;
            }
            $k = strtolower($c['category'] . '|' . trim($c['description']) . '|' . $c['amount'] . '|' . $c['year']);
            if (isset($seen[$k])) {
                $flags[] = ['code' => 'DUPLICATE_COST', 'message' => "\"{$c['description']}\" appears more than once with the same amount and year — check for double counting.", 'cost_id' => $c['id']];
            }
            $seen[$k] = true;
        }
        ksort($byYear);
        return [
            'currency' => $snapshot['project']['currency'],
            'initial_investment' => round($initial, 2),
            'recurring_expenditure' => round($recurring, 2),
            'in_kind_resources' => round($inKind, 2),
            'total_investment' => round($total, 2),
            'by_year' => array_map(fn($y, $v) => ['year' => $y, 'amount' => round($v, 2)], array_keys($byYear), $byYear),
            'analysis_period_years' => $snapshot['project']['analysis_period_years'],
            'flags' => $flags,
        ];
    }

    /**
     * What changed between two stored snapshots (inputs only).
     * @param array<string,mixed> $a @param array<string,mixed> $b @return list<array<string,mixed>>
     */
    public function diffSnapshots(array $a, array $b): array
    {
        $changes = [];
        $flat = function (array $arr, string $prefix = '') use (&$flat): array {
            $out = [];
            foreach ($arr as $k => $v) {
                $key = $prefix === '' ? (string)$k : "$prefix.$k";
                if (is_array($v)) {
                    $out += $flat($v, $key);
                } else {
                    $out[$key] = $v;
                }
            }
            return $out;
        };
        $index = function (array $snap): array {
            $x = ['project' => $snap['project'], 'scenario' => $snap['scenario']['assumptions'] ?? []];
            foreach ($snap['costs'] as $c) {
                $x['cost'][$c['id']] = $c;
            }
            foreach ($snap['outcomes'] as $o) {
                $x['outcome'][$o['id']] = $o;
            }
            return $x;
        };
        $fa = $flat($index($a));
        $fb = $flat($index($b));
        foreach (array_unique(array_merge(array_keys($fa), array_keys($fb))) as $k) {
            if (str_contains($k, 'updated_at') || str_contains($k, 'updated_by')) {
                continue;
            }
            $va = $fa[$k] ?? null;
            $vb = $fb[$k] ?? null;
            if ($va !== $vb && !(is_numeric($va) && is_numeric($vb) && (float)$va == (float)$vb)) {
                $changes[] = ['path' => $k, 'before' => $va, 'after' => $vb];
            }
        }
        return $changes;
    }
}
