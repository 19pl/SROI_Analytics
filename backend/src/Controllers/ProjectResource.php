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
 * Generic CRUD for a table owned by a project (project_id column).
 * Subclasses declare the table, audit name, and validation rules; every write is permission-checked,
 * validated against a whitelist, and recorded in the audit trail with old/new values and an optional reason.
 */
abstract class ProjectResource
{
    public function __construct(protected App $app)
    {
    }

    abstract protected function table(): string;

    abstract protected function entity(): string;

    /** @return array<string,array<string,mixed>> */
    abstract protected function rules(): array;

    protected function order(): string
    {
        return 'id ASC';
    }

    /**
     * Cross-field checks and normalisation. On update $data holds only the changed fields.
     * @param array<string,mixed> $data @param array<string,mixed> $project @param array<string,mixed>|null $existing
     * @return array<string,mixed>
     */
    protected function prepare(array $data, array $project, ?array $existing): array
    {
        return $data;
    }

    /** @param list<array<string,mixed>> $rows @param array<string,mixed> $project @return list<array<string,mixed>> */
    protected function decorate(array $rows, array $project): array
    {
        return $rows;
    }

    protected function conflictMessage(): string
    {
        return 'This record is referenced by other records and cannot be deleted';
    }

    public function index(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'));
        $rows = $this->app->db->all('SELECT * FROM ' . $this->table() . ' WHERE project_id = ? ORDER BY ' . $this->order(), [$project['id']]);
        $rows = $this->decorate(array_map([$this, 'cast'], $rows), $project);
        return Response::json(['data' => $rows]);
    }

    public function show(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'));
        $row = $this->find((int)$project['id'], $req->intParam('id'));
        return Response::json(['data' => $this->decorate([$this->cast($row)], $project)[0]]);
    }

    public function store(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $data = Validator::validate($req->body(), $this->rules());
        $data = $this->prepare($data, $project, null);
        $data['project_id'] = (int)$project['id'];
        $data['created_at'] = $data['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
        $id = $this->app->db->insert($this->table(), $data);
        $this->touch((int)$project['id']);
        $row = $this->find((int)$project['id'], $id);
        $this->afterWrite($req, $project, $row, true);
        Audit::log($this->app, $req, $project, $this->entity(), $id, 'create', null, $this->auditable($this->cast($row)));
        return Response::json(['data' => $this->decorate([$this->cast($row)], $project)[0]], 201);
    }

    public function update(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $existing = $this->find((int)$project['id'], $req->intParam('id'));
        $data = Validator::validate($req->body(), $this->rules(), true);
        $data = $this->prepare($data, $project, $this->cast($existing));
        [$old, $new] = Audit::diff($this->cast($existing), $data);
        if ($new !== []) {
            $data['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->app->db->update($this->table(), (int)$existing['id'], $data);
            $this->touch((int)$project['id']);
        }
        $row = $this->find((int)$project['id'], (int)$existing['id']);
        $this->afterWrite($req, $project, $row, false);
        if ($new !== []) {
            Audit::log($this->app, $req, $project, $this->entity(), (int)$existing['id'], 'update', $old, $new);
        }
        return Response::json(['data' => $this->decorate([$this->cast($row)], $project)[0]]);
    }

    public function destroy(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $row = $this->find((int)$project['id'], $req->intParam('id'));
        try {
            $this->app->db->run('DELETE FROM ' . $this->table() . ' WHERE id = ?', [$row['id']]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                throw HttpException::conflict($this->conflictMessage());
            }
            throw $e;
        }
        $this->touch((int)$project['id']);
        Audit::log($this->app, $req, $project, $this->entity(), (int)$row['id'], 'delete', $this->auditable($this->cast($row)), null);
        return Response::noContent();
    }

    /** Hook for nested writes (runs after the row is saved, before the response is built). */
    protected function afterWrite(Request $req, array $project, array $row, bool $created): void
    {
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    protected function auditable(array $row): array
    {
        unset($row['created_at'], $row['updated_at']);
        return $row;
    }

    /** @return array<string,mixed> */
    protected function find(int $projectId, int $id): array
    {
        $row = $this->app->db->one('SELECT * FROM ' . $this->table() . ' WHERE id = ? AND project_id = ?', [$id, $projectId]);
        if ($row === null) {
            throw HttpException::notFound(ucfirst(str_replace('_', ' ', $this->entity())));
        }
        return $row;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    protected function cast(array $row): array
    {
        foreach ($this->rules() as $field => $rule) {
            if (!array_key_exists($field, $row) || $row[$field] === null) {
                continue;
            }
            if (($rule['type'] ?? '') === 'bool') {
                $row[$field] = (bool)$row[$field];
            } elseif (($rule['type'] ?? '') === 'array') {
                $row[$field] = json_decode((string)$row[$field], true) ?? [];
            }
        }
        return $row;
    }

    protected function touch(int $projectId): void
    {
        $this->app->db->run('UPDATE projects SET updated_at = ? WHERE id = ?', [gmdate('Y-m-d\TH:i:s\Z'), $projectId]);
    }

    /** @param array<string,mixed> $project */
    protected function periodYears(array $project): ?int
    {
        return $project['analysis_period_years'] === null ? null : (int)$project['analysis_period_years'];
    }
}
