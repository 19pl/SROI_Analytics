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

final class ProjectController
{
    public function __construct(private App $app)
    {
    }

    /** @return array<string,array<string,mixed>> */
    private function rules(): array
    {
        $curCheck = fn($v) => preg_match('/^[A-Za-z]{3}$/', $v) ? null : 'must be a 3-letter currency code';
        return [
            'name' => ['type' => 'string', 'required' => true, 'max' => 200],
            'organization_name' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'description' => ['type' => 'string', 'max' => 5000, 'nullable' => true],
            'category' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'country' => ['type' => 'string', 'max' => 100, 'nullable' => true],
            'start_date' => ['type' => 'date', 'nullable' => true],
            'end_date' => ['type' => 'date', 'nullable' => true],
            'evaluation_type' => ['type' => 'enum', 'in' => ['forecast', 'evaluative'], 'default' => 'forecast'],
            'currency' => ['type' => 'string', 'required' => true, 'min' => 3, 'max' => 3, 'check' => $curCheck],
            'price_basis' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'analysis_period_years' => ['type' => 'int', 'min' => 1, 'max' => 100, 'nullable' => true],
            'discount_rate' => ['type' => 'fraction', 'nullable' => true],
            'discount_rate_basis' => ['type' => 'enum', 'in' => ['real', 'nominal'], 'nullable' => true],
            'discount_rate_source' => ['type' => 'string', 'max' => 1000, 'nullable' => true],
            'discount_base_year' => ['type' => 'int', 'min' => 0, 'max' => 100, 'default' => 0],
            'investment_basis' => ['type' => 'enum', 'in' => ['nominal', 'present_value'], 'nullable' => true],
            'include_in_kind' => ['type' => 'bool', 'default' => true],
            'wizard_step' => ['type' => 'int', 'min' => 1, 'max' => 6, 'default' => 1],
            'status' => ['type' => 'enum', 'in' => ['draft', 'ready', 'archived'], 'default' => 'draft'],
            'faculty_id'    => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'department_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'assessment_months' => ['type' => 'int', 'min' => 1, 'nullable' => true],
        ];
    }

    public function index(Request $req): Response
    {
        $orgId = $req->queryInt('organization_id');
        $deleted = $req->queryString('deleted') === '1';
        $sql = 'SELECT p.*, m.role FROM projects p JOIN memberships m ON m.organization_id = p.organization_id AND m.user_id = ?
                WHERE p.deleted_at IS ' . ($deleted ? 'NOT ' : '') . 'NULL';
        $params = [$req->user['id']];
        if ($orgId !== null) {
            $sql .= ' AND p.organization_id = ?';
            $params[] = $orgId;
        }
        $facultyId = $req->queryInt('faculty_id');
        $deptId    = $req->queryInt('department_id');
        if ($facultyId !== null) {
            $sql .= ' AND p.faculty_id = ?';
            $params[] = $facultyId;
        }
        if ($deptId !== null) {
            $sql .= ' AND p.department_id = ?';
            $params[] = $deptId;
        }
        $rows = $this->app->db->all($sql . ' ORDER BY p.updated_at DESC', $params);
        foreach ($rows as &$r) {
            $r = $this->present($r);
            $r['latest_run'] = $this->app->db->one(
                "SELECT id, sroi_ratio, present_value, investment, net_social_value, created_at FROM calculation_runs
                 WHERE project_id = ? AND scenario_id = (SELECT id FROM scenarios WHERE project_id = ? AND is_base = 1) ORDER BY id DESC LIMIT 1",
                [$r['id'], $r['id']]
            );
        }
        return Response::json(['data' => $rows]);
    }

    public function store(Request $req): Response
    {
        $d = Validator::validate($req->body(), $this->rules() + ['organization_id' => ['type' => 'int', 'min' => 1]]);
        $this->checkDates($d);
        $orgId = $d['organization_id'] ?? $this->defaultOrg($req);
        unset($d['organization_id']);
        Access::requireOrg($this->app, $req, $orgId, 'editor');
        $d['currency'] = strtoupper($d['currency']);
        // Validate ownership: at most one of faculty_id / department_id may be set
        $this->validateOwnership($d);
        $db = $this->app->db;
        $id = $db->transaction(function () use ($db, $d, $orgId, $req) {
            $id = $db->insert('projects', $d + ['organization_id' => $orgId, 'created_by' => $req->user['id']]);
            // three standard scenarios; non-base ones start with NO overrides (nothing is pre-populated)
            foreach ([['Base case', 'base', 1, 'Best-supported central assumptions.'],
                      ['Conservative', 'conservative', 0, 'Lower plausible outcomes, higher deductions, shorter persistence where justified.'],
                      ['Optimistic', 'optimistic', 0, 'Higher plausible outcomes or longer persistence supported by credible evidence.']] as [$n, $k, $b, $desc]) {
                $db->insert('scenarios', ['project_id' => $id, 'name' => $n, 'kind' => $k, 'is_base' => $b, 'description' => $desc, 'assumptions' => '{}']);
            }
            return $id;
        });
        $p = $this->load($id);
        Audit::log($this->app, $req, $p, 'project', $id, 'create', null, $d);
        return Response::json(['data' => $this->present($p + ['role' => Access::orgRole($this->app, (int)$req->user['id'], $orgId)])], 201);
    }

    public function show(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        return Response::json(['data' => $this->present($p)]);
    }

    public function update(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $d = Validator::validate($req->body(), $this->rules(), true);
        $this->checkDates($d + $p);
        if (isset($d['currency'])) {
            $d['currency'] = strtoupper($d['currency']);
        }
        if (isset($d['faculty_id']) || isset($d['department_id'])) {
            $merged = array_merge(
                ['faculty_id' => $p['faculty_id'], 'department_id' => $p['department_id']],
                $d
            );
            $this->validateOwnership($merged);
        }
        if (isset($d['analysis_period_years'])) {
            $T = $d['analysis_period_years'];
            $db = $this->app->db;
            $maxCost = (int)$db->val('SELECT COALESCE(MAX(year),0) FROM project_costs WHERE project_id = ?', [$p['id']]);
            $maxStart = (int)$db->val('SELECT COALESCE(MAX(start_year),0) FROM outcomes WHERE project_id = ?', [$p['id']]);
            if ($maxCost > $T || $maxStart > $T) {
                throw HttpException::unprocessable('Validation failed', ['analysis_period_years' =>
                    "is shorter than existing data (latest cost year $maxCost, latest outcome start year $maxStart); edit those first"]);
            }
        }
        [$old, $new] = Audit::diff($p, $d);
        if ($new !== []) {
            $d['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->app->db->update('projects', (int)$p['id'], $d);
            Audit::log($this->app, $req, $p, 'project', (int)$p['id'], 'update', $old, $new);
        }
        return Response::json(['data' => $this->present(Access::project($this->app, $req, (int)$p['id']))]);
    }

    /** Soft delete; the owner can restore it, and bin/purge-deleted.php removes it for good after the retention period. */
    public function destroy(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'owner');
        $this->app->db->update('projects', (int)$p['id'], ['deleted_at' => gmdate('Y-m-d\TH:i:s\Z')]);
        Audit::log($this->app, $req, $p, 'project', (int)$p['id'], 'delete');
        return Response::noContent();
    }

    public function restore(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'owner', true);
        if ($p['deleted_at'] === null) {
            throw HttpException::conflict('Project is not deleted');
        }
        $this->app->db->update('projects', (int)$p['id'], ['deleted_at' => null]);
        Audit::log($this->app, $req, $p, 'project', (int)$p['id'], 'restore');
        return Response::json(['data' => $this->present(Access::project($this->app, $req, (int)$p['id']))]);
    }

    /** Pagination-free audit trail for a project (assumption provenance). */
    public function audit(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $sql = 'SELECT id, user_id, user_name, entity_type, entity_id, action, old_values, new_values, reason, created_at FROM audit_events WHERE project_id = ?';
        $params = [$p['id']];
        if (($t = $req->queryString('entity_type')) !== null) {
            $sql .= ' AND entity_type = ?';
            $params[] = $t;
        }
        if (($e = $req->queryInt('entity_id')) !== null) {
            $sql .= ' AND entity_id = ?';
            $params[] = $e;
        }
        $limit = min(500, max(1, $req->queryInt('limit', 100)));
        $offset = max(0, $req->queryInt('offset', 0));
        $rows = $this->app->db->all($sql . " ORDER BY id DESC LIMIT $limit OFFSET $offset", $params);
        foreach ($rows as &$r) {
            $r['old_values'] = $r['old_values'] === null ? null : json_decode($r['old_values'], true);
            $r['new_values'] = $r['new_values'] === null ? null : json_decode($r['new_values'], true);
        }
        return Response::json(['data' => $rows, 'limit' => $limit, 'offset' => $offset]);
    }

    /**
     * Enforce the ownership rule: a project must not be simultaneously assigned
     * to both a faculty (directly) and a department.
     * @param array<string,mixed> $d
     */
    private function validateOwnership(array $d): void
    {
        $hasFaculty = isset($d['faculty_id']) && $d['faculty_id'] !== null;
        $hasDept    = isset($d['department_id']) && $d['department_id'] !== null;
        if ($hasFaculty && $hasDept) {
            throw HttpException::unprocessable('Validation failed', [
                'ownership' => 'A plan may be owned by a faculty or a department, not both simultaneously.',
            ]);
        }
        // Verify faculty exists and user has access (will be checked by existing org check, but verify FK)
        if ($hasFaculty) {
            $fac = $this->app->db->one('SELECT organization_id FROM faculties WHERE id = ?', [(int)$d['faculty_id']]);
            if ($fac === null) {
                throw HttpException::unprocessable('Validation failed', ['faculty_id' => 'Faculty not found.']);
            }
        }
        // Verify department exists
        if ($hasDept) {
            $dept = $this->app->db->one(
                'SELECT d.id, f.organization_id FROM departments d JOIN faculties f ON f.id = d.faculty_id WHERE d.id = ?',
                [(int)$d['department_id']]
            );
            if ($dept === null) {
                throw HttpException::unprocessable('Validation failed', ['department_id' => 'Department not found.']);
            }
        }
    }

    /** @param array<string,mixed> $d */
    private function checkDates(array $d): void
    {
        if (!empty($d['start_date']) && !empty($d['end_date']) && $d['end_date'] < $d['start_date']) {
            throw HttpException::unprocessable('Validation failed', ['end_date' => 'must not be before start_date']);
        }
    }

    private function defaultOrg(Request $req): int
    {
        $id = $this->app->db->val("SELECT organization_id FROM memberships WHERE user_id = ? AND role IN ('owner','editor') ORDER BY organization_id LIMIT 1", [$req->user['id']]);
        if ($id === null) {
            throw HttpException::forbidden('You do not have an organization where you can create projects');
        }
        return (int)$id;
    }

    /** @return array<string,mixed> */
    private function load(int $id): array
    {
        return $this->app->db->one('SELECT * FROM projects WHERE id = ?', [$id]) ?? [];
    }

    /** @param array<string,mixed> $p @return array<string,mixed> */
    private function present(array $p): array
    {
        $p['include_in_kind'] = (bool)$p['include_in_kind'];
        $p['faculty_id']      = $p['faculty_id'] !== null ? (int)$p['faculty_id'] : null;
        $p['department_id']   = $p['department_id'] !== null ? (int)$p['department_id'] : null;
        $p['assessment_months'] = $p['assessment_months'] !== null ? (int)$p['assessment_months'] : null;
        return $p;
    }
}
