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

/**
 * Manages faculties within an organization.
 * A faculty belongs to one organization and may contain many departments.
 * A faculty may also own SROI plans (projects) directly, without a department.
 */
final class FacultyController
{
    public function __construct(private App $app)
    {
    }

    /** List all faculties in an organization. */
    public function index(Request $req): Response
    {
        $oid = $req->intParam('id');
        Access::requireOrg($this->app, $req, $oid, 'viewer');
        $rows = $this->app->db->all(
            'SELECT id, name, description, created_by, created_at, updated_at FROM faculties WHERE organization_id = ? ORDER BY name',
            [$oid]
        );
        return Response::json(['data' => $rows]);
    }

    /** Create a new faculty within an organization. */
    public function store(Request $req): Response
    {
        $oid = $req->intParam('id');
        Access::requireOrg($this->app, $req, $oid, 'editor');
        $d = Validator::validate($req->body(), [
            'name'        => ['type' => 'string', 'required' => true, 'max' => 200],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ]);
        $id = $this->app->db->insert('faculties', [
            'organization_id' => $oid,
            'name'            => $d['name'],
            'description'     => $d['description'] ?? null,
            'created_by'      => $req->user['id'],
        ]);
        $row = $this->load($id);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $oid], 'faculty', $id, 'create', null, $d);
        return Response::json(['data' => $row], 201);
    }

    /** Get a single faculty (must belong to an org the user can see). */
    public function show(Request $req): Response
    {
        $fac = $this->faculty($req);
        return Response::json(['data' => $fac]);
    }

    /** Rename or update a faculty. */
    public function update(Request $req): Response
    {
        $fac = $this->faculty($req, 'editor');
        $d = Validator::validate($req->body(), [
            'name'        => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ], true);
        [$old, $new] = Audit::diff($fac, $d);
        if ($new !== []) {
            $d['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->app->db->update('faculties', (int)$fac['id'], $d);
            Audit::log($this->app, $req, ['id' => null, 'organization_id' => $fac['organization_id']], 'faculty', (int)$fac['id'], 'update', $old, $new);
        }
        return Response::json(['data' => $this->load((int)$fac['id'])]);
    }

    /**
     * Delete a faculty.
     * Guard: refuses if any project is directly owned by this faculty,
     *        or if any department under this faculty owns a project.
     */
    public function destroy(Request $req): Response
    {
        $fac = $this->faculty($req, 'owner');
        $fid = (int)$fac['id'];
        // Check faculty-owned projects
        $direct = (int)$this->app->db->val(
            'SELECT COUNT(*) FROM projects WHERE faculty_id = ? AND deleted_at IS NULL', [$fid]
        );
        if ($direct > 0) {
            throw HttpException::conflict('Cannot delete faculty: it owns active plans. Archive or reassign them first.');
        }
        // Check department-owned projects under this faculty
        $indirect = (int)$this->app->db->val(
            'SELECT COUNT(*) FROM projects WHERE department_id IN (SELECT id FROM departments WHERE faculty_id = ?) AND deleted_at IS NULL',
            [$fid]
        );
        if ($indirect > 0) {
            throw HttpException::conflict('Cannot delete faculty: departments under it own active plans.');
        }
        $this->app->db->run('DELETE FROM faculties WHERE id = ?', [$fid]);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $fac['organization_id']], 'faculty', $fid, 'delete');
        return Response::noContent();
    }

    /** List departments belonging to this faculty. */
    public function departments(Request $req): Response
    {
        $fac = $this->faculty($req);
        $rows = $this->app->db->all(
            'SELECT id, faculty_id, name, description, created_at, updated_at FROM departments WHERE faculty_id = ? ORDER BY name',
            [(int)$fac['id']]
        );
        return Response::json(['data' => $rows]);
    }

    /**
     * Consolidated faculty report: list every plan owned by this faculty
     * (directly or via a department) with their latest calculation summary.
     * Plans are listed individually — never aggregated into a misleading single ratio.
     */
    public function report(Request $req): Response
    {
        $fac = $this->faculty($req);
        $fid = (int)$fac['id'];

        // Faculty-owned plans (no department)
        $facultyOwned = $this->app->db->all(
            'SELECT p.id, p.name, p.status, p.currency, p.evaluation_type, p.start_date, p.end_date,
                    NULL AS department_id, NULL AS department_name, 1 AS owned_by_faculty
             FROM projects p
             WHERE p.faculty_id = ? AND p.department_id IS NULL AND p.deleted_at IS NULL
             ORDER BY p.name',
            [$fid]
        );

        // Department-owned plans
        $deptOwned = $this->app->db->all(
            'SELECT p.id, p.name, p.status, p.currency, p.evaluation_type, p.start_date, p.end_date,
                    d.id AS department_id, d.name AS department_name, 0 AS owned_by_faculty
             FROM projects p
             JOIN departments d ON d.id = p.department_id
             WHERE d.faculty_id = ? AND p.deleted_at IS NULL
             ORDER BY d.name, p.name',
            [$fid]
        );

        $allPlans = array_merge($facultyOwned, $deptOwned);

        // Attach latest base-scenario calculation run to each plan
        foreach ($allPlans as &$plan) {
            $plan['latest_run'] = $this->app->db->one(
                'SELECT sroi_ratio, present_value, investment, net_social_value, created_at
                 FROM calculation_runs
                 WHERE project_id = ?
                   AND (scenario_id = (SELECT id FROM scenarios WHERE project_id = ? AND is_base = 1)
                        OR methodology_version LIKE \'sheet-%\')
                 ORDER BY id DESC LIMIT 1',
                [(int)$plan['id'], (int)$plan['id']]
            );
            $plan['owned_by_faculty'] = (bool)$plan['owned_by_faculty'];
        }
        unset($plan);

        return Response::json([
            'data' => [
                'faculty'  => $fac,
                'plans'    => $allPlans,
                'note'     => 'Plans are listed individually. Do not sum SROI ratios — use investment and present-value totals to build a consolidated ratio.',
            ],
        ]);
    }

    // ---- helpers ----

    /** Load and authorize a faculty row. Returns the row with organization_id. */
    private function faculty(Request $req, string $minRole = 'viewer'): array
    {
        $fid = $req->intParam('facultyId');
        $fac = $this->app->db->one(
            'SELECT id, organization_id, name, description, created_by, created_at, updated_at FROM faculties WHERE id = ?',
            [$fid]
        );
        if ($fac === null) {
            throw HttpException::notFound('Faculty');
        }
        Access::requireOrg($this->app, $req, (int)$fac['organization_id'], $minRole);
        return $fac;
    }

    private function load(int $id): array
    {
        return $this->app->db->one('SELECT * FROM faculties WHERE id = ?', [$id]) ?? [];
    }
}
