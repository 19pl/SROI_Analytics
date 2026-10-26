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

/** Evidence attachments: links, citations, survey references, or uploaded files stored outside the web root. */
final class EvidenceController
{
    /** extension => allowed MIME types */
    private const FILE_TYPES = [
        'pdf' => ['application/pdf'],
        'png' => ['image/png'],
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'csv' => ['text/csv', 'text/plain', 'application/csv'],
        'txt' => ['text/plain'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    ];

    private const COLUMNS = 'id, project_id, entity_type, entity_id, kind, title, reference, notes, file_name, mime_type, size_bytes, uploaded_by, created_at';

    public function __construct(private App $app)
    {
    }

    public function index(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $sql = 'SELECT ' . self::COLUMNS . ' FROM evidence_sources WHERE project_id = ?';
        $params = [$p['id']];
        if (($t = $req->queryString('entity_type')) !== null) {
            $sql .= ' AND entity_type = ?';
            $params[] = $t;
        }
        if (($e = $req->queryInt('entity_id')) !== null) {
            $sql .= ' AND entity_id = ?';
            $params[] = $e;
        }
        return Response::json(['data' => $this->app->db->all($sql . ' ORDER BY id', $params)]);
    }

    public function store(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $file = $req->files['file'] ?? null;
        $d = Validator::validate($req->body(), [
            'entity_type' => ['type' => 'enum', 'in' => ['project', 'cost', 'stakeholder', 'outcome', 'adjustment'], 'default' => 'project'],
            'entity_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
            'kind' => ['type' => 'enum', 'in' => ['url', 'document', 'citation', 'survey', 'internal', 'file'], 'default' => $file ? 'file' : 'citation'],
            'title' => ['type' => 'string', 'required' => true, 'max' => 300],
            'reference' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'notes' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ]);
        $this->checkEntity($d, (int)$p['id']);
        if ($d['kind'] === 'url' && !preg_match('#^https?://#i', (string)($d['reference'] ?? ''))) {
            throw HttpException::unprocessable('Validation failed', ['reference' => 'a url source needs an http(s) URL in reference']);
        }
        $row = $d + ['project_id' => $p['id'], 'uploaded_by' => $req->user['id']];
        if ($file !== null) {
            $row = $this->saveFile($file, (int)$p['id']) + $row;
            $row['kind'] = 'file';
        } elseif ($d['kind'] === 'file') {
            throw HttpException::unprocessable('Validation failed', ['file' => 'a multipart "file" upload is required for kind=file']);
        }
        $id = $this->app->db->insert('evidence_sources', $row);
        Audit::log($this->app, $req, $p, 'evidence', $id, 'create', null, ['title' => $d['title'], 'kind' => $row['kind'], 'entity_type' => $d['entity_type'], 'entity_id' => $d['entity_id'] ?? null]);
        return Response::json(['data' => $this->app->db->one('SELECT ' . self::COLUMNS . ' FROM evidence_sources WHERE id = ?', [$id])], 201);
    }

    public function download(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        $e = $this->find((int)$p['id'], $req->intParam('id'));
        if ($e['file_path'] === null || !is_file($this->app->cfg('storage_path') . '/' . $e['file_path'])) {
            throw HttpException::notFound('File');
        }
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string)$e['file_name']);
        return Response::raw((string)file_get_contents($this->app->cfg('storage_path') . '/' . $e['file_path']), (string)$e['mime_type'], [
            'Content-Disposition' => 'attachment; filename="' . $name . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function destroy(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $e = $this->find((int)$p['id'], $req->intParam('id'));
        $this->app->db->run('DELETE FROM evidence_sources WHERE id = ?', [$e['id']]);
        if ($e['file_path'] !== null) {
            @unlink($this->app->cfg('storage_path') . '/' . $e['file_path']);
        }
        Audit::log($this->app, $req, $p, 'evidence', (int)$e['id'], 'delete', ['title' => $e['title'], 'kind' => $e['kind']], null);
        return Response::noContent();
    }

    /** @return array<string,mixed> */
    private function find(int $projectId, int $id): array
    {
        $e = $this->app->db->one('SELECT * FROM evidence_sources WHERE id = ? AND project_id = ?', [$id, $projectId]);
        if ($e === null) {
            throw HttpException::notFound('Evidence');
        }
        return $e;
    }

    /** @param array<string,mixed> $d */
    private function checkEntity(array $d, int $projectId): void
    {
        $id = $d['entity_id'] ?? null;
        if ($d['entity_type'] === 'project') {
            if ($id !== null && $id !== $projectId) {
                throw HttpException::unprocessable('Validation failed', ['entity_id' => 'must be omitted (or the project id) for project evidence']);
            }
            return;
        }
        $table = ['cost' => 'project_costs', 'stakeholder' => 'stakeholders', 'outcome' => 'outcomes', 'adjustment' => 'outcomes'][$d['entity_type']];
        if ($id === null || $this->app->db->val("SELECT 1 FROM $table WHERE id = ? AND project_id = ?", [$id, $projectId]) === null) {
            throw HttpException::unprocessable('Validation failed', ['entity_id' => "must be the id of a {$d['entity_type']} in this project"]);
        }
    }

    /**
     * @param array<string,mixed> $f one $_FILES entry
     * @return array<string,mixed>
     */
    private function saveFile(array $f, int $projectId): array
    {
        if (!isset($f['error'], $f['tmp_name']) || is_array($f['error']) || $f['error'] !== UPLOAD_ERR_OK) {
            throw HttpException::unprocessable('Upload failed', ['file' => 'the file could not be uploaded']);
        }
        $size = (int)filesize($f['tmp_name']);
        if ($size === 0 || $size > $this->app->cfg('max_upload_bytes')) {
            throw new HttpException(413, 'File must be between 1 byte and ' . intdiv($this->app->cfg('max_upload_bytes'), 1048576) . ' MB', 'payload_too_large');
        }
        $ext = strtolower(pathinfo((string)($f['name'] ?? ''), PATHINFO_EXTENSION));
        if (!isset(self::FILE_TYPES[$ext])) {
            throw HttpException::unprocessable('Unsupported file type', ['file' => 'allowed types: ' . implode(', ', array_keys(self::FILE_TYPES))]);
        }
        $mime = (string)(new \finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!in_array($mime, self::FILE_TYPES[$ext], true)) {
            throw HttpException::unprocessable('File content does not match its extension', ['file' => "detected $mime"]);
        }
        $rel = "evidence/$projectId/" . bin2hex(random_bytes(16)) . ".$ext";
        $abs = $this->app->cfg('storage_path') . '/' . $rel;
        if (!is_dir(dirname($abs)) && !mkdir(dirname($abs), 0775, true) && !is_dir(dirname($abs))) {
            throw new \RuntimeException('Cannot create evidence directory');
        }
        $moved = is_uploaded_file($f['tmp_name']) ? move_uploaded_file($f['tmp_name'], $abs)
            : ($this->app->cfg('allow_non_uploaded_files') === true && copy($f['tmp_name'], $abs)); // copy path exists for tests only
        if (!$moved) {
            throw HttpException::unprocessable('Upload failed', ['file' => 'the file could not be stored']);
        }
        return ['file_path' => $rel, 'file_name' => mb_substr(basename((string)$f['name']), 0, 200), 'mime_type' => $mime, 'size_bytes' => $size];
    }
}
