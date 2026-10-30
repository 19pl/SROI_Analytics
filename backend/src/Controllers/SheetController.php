<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Access;
use App\Core\App;
use App\Core\Audit;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Domain\Calculation\SheetEngine;

/** Sheet mode — the whole sheet in one response, the template starter, and saved calculation runs. */
final class SheetController
{
    private SheetEngine $engine;

    public function __construct(private App $app)
    {
        $this->engine = new SheetEngine();
    }

    /** GET /projects/{projectId}/sheet — everything the sheet screen needs, with the live (backend-authoritative) result. */
    public function show(Request $req): Response
    {
        $project = $this->project($req, 'viewer');
        $data = $this->load($project);
        return Response::json(['data' => $this->present($project, $data) + ['result' => $this->engine->calculate($this->snapshot($project, $data))]]);
    }

    /**
     * POST /projects/{projectId}/sheet/template — start from the workbook's four stakeholder groups (S1..S4).
     * Only when the sheet has no groups yet, so it can never overwrite anything.
     */
    public function template(Request $req): Response
    {
        $project = $this->project($req, 'editor');
        $db = $this->app->db;
        if ($db->val('SELECT 1 FROM sheet_groups WHERE project_id = ?', [$project['id']])) {
            throw HttpException::conflict('This sheet already has groups; the starter template is only for an empty sheet');
        }
        $starter = [
            ['S1', 'primary_beneficiary', 'S1. ผู้รับผลประโยชน์หลัก'],
            ['S2', 'project_operator', 'S2. ผู้ดำเนินโครงการ'],
            ['S3', 'project_supporter', 'S3. ผู้สนับสนุนโครงการ'],
            ['S4', 'other_agency', 'S4. หน่วยงานอื่นๆ'],
        ];
        $db->transaction(function () use ($db, $project, $starter) {
            foreach ($starter as $i => [$code, $type, $name]) {
                $db->insert('sheet_groups', ['project_id' => $project['id'], 'code' => $code, 'group_type' => $type, 'name' => $name, 'sort_order' => $i + 1]);
            }
        });
        Audit::log($this->app, $req, $project, 'sheet', null, 'template', null, ['groups' => array_column($starter, 0)]);
        return $this->show($req);
    }

    /**
     * POST /projects/{projectId}/sheet/calculate — calculate and keep the run (snapshot + result) in the project's history.
     * A sheet with a bad formula cannot be saved as a run.
     */
    public function calculate(Request $req): Response
    {
        $project = $this->project($req, 'editor');
        $data = $this->load($project);
        $snapshot = $this->snapshot($project, $data);
        $result = $this->engine->calculate($snapshot);
        if ($result['blocked']) {
            throw HttpException::unprocessable('The sheet has errors that must be fixed before it can be calculated', $result['errors'], 'calculation_inputs_invalid');
        }
        $snapJson = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $id = $this->app->db->insert('calculation_runs', [
            'project_id' => $project['id'],
            'scenario_id' => null,
            'scenario_name' => 'Sheet',
            'methodology_version' => $result['methodology_version'],
            'input_hash' => hash('sha256', $snapJson),
            'sroi_ratio' => $result['sroi'],
            'present_value' => $result['totals']['outcome_adjusted']['total'],
            'investment' => $result['totals']['input']['total'],
            'net_social_value' => $result['net_value'],
            'snapshot' => $snapJson,
            'result' => json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_by' => $req->user['id'] ?? null,
        ]);
        Audit::log($this->app, $req, $project, 'calculation_run', $id, 'create', null, ['method' => 'sheet', 'sroi' => $result['sroi']]);
        $run = $this->app->db->one(
            'SELECT id, project_id, scenario_name, methodology_version, input_hash, sroi_ratio, present_value, investment, net_social_value, created_by, created_at
             FROM calculation_runs WHERE id = ?',
            [$id]
        );
        return Response::json(['data' => ['run' => $run, 'result' => $result]], 201);
    }

    /** @return array<string,mixed> */
    private function project(Request $req, string $role): array
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), $role);
        if (($project['calc_method'] ?? 'wizard') !== 'sheet') {
            throw HttpException::unprocessable('This project is not a sheet-mode project', ['calc_method' => 'must be "sheet" to use the sheet'], 'not_a_sheet_project');
        }
        return $project;
    }

    /** @param array<string,mixed> $project @return array<string,list<array<string,mixed>>> */
    private function load(array $project): array
    {
        $db = $this->app->db;
        $pid = [$project['id']];
        $dec = function (array $rows): array {
            foreach ($rows as &$r) {
                $c = json_decode((string)($r['custom'] ?? '{}'), true);
                $r['custom'] = is_array($c) ? $c : [];
                if (array_key_exists('include_in_total', $r)) {
                    $r['include_in_total'] = (bool)$r['include_in_total'];
                }
            }
            return $rows;
        };
        $columns = $db->all("SELECT * FROM sheet_columns WHERE project_id = ? ORDER BY CASE band WHEN 'stakeholder' THEN 1 WHEN 'input' THEN 2 ELSE 3 END, sort_order, id", $pid);
        foreach ($columns as &$c) {
            $o = json_decode((string)$c['options'], true);
            $c['options'] = is_array($o) ? array_values($o) : [];
        }
        unset($c);
        return [
            'columns' => $columns,
            'groups' => $dec($db->all('SELECT * FROM sheet_groups WHERE project_id = ? ORDER BY sort_order, id', $pid)),
            'inputs' => $dec($db->all('SELECT * FROM sheet_inputs WHERE project_id = ? ORDER BY group_id, sort_order, id', $pid)),
            'outcomes' => $dec($db->all('SELECT * FROM sheet_outcomes WHERE project_id = ? ORDER BY group_id, sort_order, id', $pid)),
        ];
    }

    /** @param array<string,mixed> $project @param array<string,list<array<string,mixed>>> $data @return array<string,mixed> */
    private function snapshot(array $project, array $data): array
    {
        return [
            'project' => [
                'id' => (int)$project['id'], 'name' => $project['name'], 'currency' => $project['currency'],
                'y0_label' => $project['y0_label'], 'y1_label' => $project['y1_label'],
                'evaluation_type' => $project['evaluation_type'], 'assessment_months' => $project['assessment_months'],
                'adjustment_mode' => $project['sheet_adjustment_mode'] ?? 'deduct',
            ],
        ] + $data;
    }

    /** @param array<string,mixed> $project @param array<string,list<array<string,mixed>>> $data @return array<string,mixed> */
    private function present(array $project, array $data): array
    {
        foreach (['groups', 'inputs', 'outcomes'] as $k) {
            foreach ($data[$k] as &$r) {
                if ($r['custom'] === []) {
                    $r['custom'] = new \stdClass();
                }
            }
            unset($r);
        }
        return [
            'project' => [
                'id' => (int)$project['id'], 'name' => $project['name'], 'currency' => $project['currency'],
                'evaluation_type' => $project['evaluation_type'], 'assessment_months' => $project['assessment_months'] === null ? null : (int)$project['assessment_months'],
                'y0_label' => $project['y0_label'], 'y1_label' => $project['y1_label'],
                'adjustment_mode' => $project['sheet_adjustment_mode'] ?? 'deduct', 'role' => $project['role'],
            ],
        ] + $data;
    }
}
