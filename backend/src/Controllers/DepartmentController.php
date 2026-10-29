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
 * Manages departments within a faculty.
 * A department belongs to exactly one faculty and may own SROI plans.
 */
final class DepartmentController
{
    public function __construct(private App $app)
    {
    }

    /** Create a new department under a faculty. */
    public function store(Request $req): Response
    {
        $fac = $this->resolveFaculty($req, 'editor');
        $d = Validator::validate($req->body(), [
            'name'        => ['type' => 'string', 'required' => true, 'max' => 200],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ]);
        $id = $this->app->db->insert('departments', [
            'faculty_id'  => (int)$fac['id'],
            'name'        => $d['name'],
            'description' => $d['description'] ?? null,
            'created_by'  => $req->user['id'],
        ]);
        $row = $this->load($id);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $fac['organization_id']], 'department', $id, 'create', null, $d);
        return Response::json(['data' => $row], 201);
    }

    /** Get a single department. */
    public function show(Request $req): Response
    {
        $dept = $this->department($req);
        return Response::json(['data' => $dept]);
    }

    /** Rename or update a department. */
    public function update(Request $req): Response
    {
        $dept = $this->department($req, 'editor');
        $d = Validator::validate($req->body(), [
            'name'        => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ], true);
        [$old, $new] = Audit::diff($dept, $d);
        if ($new !== []) {
            $d['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->app->db->update('departments', (int)$dept['id'], $d);
            $fac = $this->app->db->one('SELECT organization_id FROM faculties WHERE id = ?', [(int)$dept['faculty_id']]);
            Audit::log($this->app, $req, ['id' => null, 'organization_id' => $fac['organization_id']], 'department', (int)$dept['id'], 'update', $old, $new);
        }
        return Response::json(['data' => $this->load((int)$dept['id'])]);
    }

    /**
     * Delete a department.
     * Guard: refuses if any project is owned by this department.
     */
    public function destroy(Request $req): Response
    {
        $dept = $this->department($req, 'owner');
        $did = (int)$dept['id'];
        $owned = (int)$this->app->db->val(
            'SELECT COUNT(*) FROM projects WHERE department_id = ? AND deleted_at IS NULL', [$did]
        );
        if ($owned > 0) {
            throw HttpException::conflict('Cannot delete department: it owns active plans. Archive or reassign them first.');
        }
        $fac = $this->app->db->one('SELECT organization_id FROM faculties WHERE id = ?', [(int)$dept['faculty_id']]);
        $this->app->db->run('DELETE FROM departments WHERE id = ?', [$did]);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $fac['organization_id']], 'department', $did, 'delete');
        return Response::noContent();
    }

    // ---- helpers ----

    /**
     * Resolve the faculty from {facultyId} param, authorize the user,
     * and return the faculty row including organization_id.
     */
    private function resolveFaculty(Request $req, string $minRole = 'viewer'): array
    {
        $fid = $req->intParam('facultyId');
        $fac = $this->app->db->one('SELECT * FROM faculties WHERE id = ?', [$fid]);
        if ($fac === null) {
            throw HttpException::notFound('Faculty');
        }
        Access::requireOrg($this->app, $req, (int)$fac['organization_id'], $minRole);
        return $fac;
    }

    /**
     * Resolve the department from {departmentId} param, traverse to its faculty
     * to authorize the user against the organization.
     */
    private function department(Request $req, string $minRole = 'viewer'): array
    {
        $did = $req->intParam('departmentId');
        $dept = $this->app->db->one('SELECT * FROM departments WHERE id = ?', [$did]);
        if ($dept === null) {
            throw HttpException::notFound('Department');
        }
        $fac = $this->app->db->one('SELECT organization_id FROM faculties WHERE id = ?', [(int)$dept['faculty_id']]);
        if ($fac === null) {
            throw HttpException::notFound('Faculty');
        }
        Access::requireOrg($this->app, $req, (int)$fac['organization_id'], $minRole);
        return $dept;
    }

    private function load(int $id): array
    {
        return $this->app->db->one('SELECT * FROM departments WHERE id = ?', [$id]) ?? [];
    }
}
