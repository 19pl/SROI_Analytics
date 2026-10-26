<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Access;
use App\Core\App;
use App\Core\Audit;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Domain\Calculation\InvalidSnapshotException;
use App\Services\CalculationService;

/** Steps 4–6: review, calculation runs, scenario comparison, sensitivity, dashboard. */
final class CalculationController
{
    private CalculationService $calc;

    public function __construct(private App $app)
    {
        $this->calc = new CalculationService($app);
    }

    /** Step 1 live investment summary. */
    public function summary(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        return Response::json(['data' => $this->calc->investmentSummary($this->calc->builder()->build($p))]);
    }

    /** Step 5 review screen: blocking errors, warnings, completion per step. */
    public function review(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        return Response::json(['data' => $this->calc->review($p)]);
    }

    /** Live (unsaved) results for the dashboard. Incomplete inputs return status "incomplete" with reasons instead of an error. */
    public function dashboard(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $scenarioId = $req->queryInt('scenario_id');
        try {
            $c = $this->calc->calculate($p, $scenarioId, null, false);
        } catch (InvalidSnapshotException $e) {
            return Response::json(['data' => ['status' => 'incomplete', 'errors' => $e->errors]]);
        }
        return Response::json(['data' => [
            'status' => 'ready',
            'project' => ['id' => (int)$p['id'], 'name' => $p['name'], 'currency' => $p['currency'], 'analysis_period_years' => $p['analysis_period_years']],
            'input_hash' => $c['hash'],
            'result' => $c['result'],
            'scenarios' => $this->calc->compareScenarios($p),
            'latest_saved_run' => $this->app->db->one(
                'SELECT id, scenario_name, input_hash, created_at FROM calculation_runs WHERE project_id = ? ORDER BY id DESC LIMIT 1',
                [$p['id']]
            ),
        ]]);
    }

    /** Calculate and save an auditable, reproducible run. */
    public function calculate(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $d = Validator::validate($req->body(), ['scenario_id' => ['type' => 'int', 'min' => 1, 'nullable' => true]]);
        $c = $this->calc->calculate($p, $d['scenario_id'] ?? null, $req, true);
        Audit::log($this->app, $req, $p, 'calculation_run', (int)$c['run']['id'], 'create', null, [
            'scenario' => $c['run']['scenario_name'], 'sroi_ratio' => $c['run']['sroi_ratio'], 'input_hash' => $c['hash'],
        ]);
        return Response::json(['data' => ['run' => $c['run'], 'result' => $c['result']]], 201);
    }

    public function runs(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $limit = min(200, max(1, $req->queryInt('limit', 50)));
        return Response::json(['data' => $this->app->db->all(
            "SELECT r.id, r.scenario_id, r.scenario_name, r.methodology_version, r.input_hash, r.sroi_ratio, r.present_value, r.investment,
                    r.net_social_value, r.created_at, u.name AS created_by_name
             FROM calculation_runs r LEFT JOIN users u ON u.id = r.created_by WHERE r.project_id = ? ORDER BY r.id DESC LIMIT $limit",
            [$p['id']]
        )]);
    }

    public function run(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $row = $this->loadRun((int)$p['id'], $req->intParam('id'));
        return Response::json(['data' => $this->presentRun($row)]);
    }

    /** Version comparison: headline deltas plus every input that changed between two runs. */
    public function compareRuns(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $a = $this->loadRun((int)$p['id'], $req->queryInt('a') ?? 0);
        $b = $this->loadRun((int)$p['id'], $req->queryInt('b') ?? 0);
        $delta = fn($x, $y) => $x === null || $y === null ? null : round((float)$y - (float)$x, 4);
        return Response::json(['data' => [
            'a' => $this->runHeadline($a),
            'b' => $this->runHeadline($b),
            'delta' => [
                'sroi_ratio' => $delta($a['sroi_ratio'], $b['sroi_ratio']),
                'present_value' => $delta($a['present_value'], $b['present_value']),
                'investment' => $delta($a['investment'], $b['investment']),
                'net_social_value' => $delta($a['net_social_value'], $b['net_social_value']),
            ],
            'changed_inputs' => $this->calc->diffSnapshots(json_decode($a['snapshot'], true), json_decode($b['snapshot'], true)),
        ]]);
    }

    public function scenarioComparison(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        return Response::json(['data' => $this->calc->compareScenarios($p)]);
    }

    public function sensitivity(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $opts = [];
        foreach (['proxy_pct', 'quantity_pct', 'adjustment_pp', 'discount_pp'] as $k) {
            $v = $req->queryString($k);
            if ($v !== null) {
                if (!is_numeric($v) || (float)$v <= 0 || (float)$v > 1) {
                    throw HttpException::unprocessable('Validation failed', [$k => 'must be a fraction between 0 and 1']);
                }
                $opts[$k] = (float)$v;
            }
        }
        $snap = $this->calc->builder()->build($p, $req->queryInt('scenario_id'));
        return Response::json(['data' => $this->calc->engine()->sensitivity($snap, $opts)]);
    }

    /** Stateless calculator: send a full snapshot, get the engine result. Nothing is stored. */
    public function preview(Request $req): Response
    {
        $result = $this->calc->engine()->calculate($req->body());
        return Response::json(['data' => $result]);
    }

    // ----------------------------------------------------------------------------------------------

    /** @return array<string,mixed> */
    private function loadRun(int $projectId, int $id): array
    {
        $row = $this->app->db->one('SELECT * FROM calculation_runs WHERE id = ? AND project_id = ?', [$id, $projectId]);
        if ($row === null) {
            throw HttpException::notFound('Calculation run');
        }
        return $row;
    }

    /** @param array<string,mixed> $r @return array<string,mixed> */
    private function runHeadline(array $r): array
    {
        return ['id' => (int)$r['id'], 'scenario_name' => $r['scenario_name'], 'created_at' => $r['created_at'], 'input_hash' => $r['input_hash'],
            'sroi_ratio' => $r['sroi_ratio'], 'present_value' => $r['present_value'], 'investment' => $r['investment'], 'net_social_value' => $r['net_social_value']];
    }

    /** @param array<string,mixed> $r @return array<string,mixed> */
    private function presentRun(array $r): array
    {
        return $this->runHeadline($r) + [
            'methodology_version' => $r['methodology_version'],
            'snapshot' => json_decode($r['snapshot'], true),
            'result' => json_decode($r['result'], true),
        ];
    }
}
