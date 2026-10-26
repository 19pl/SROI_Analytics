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
use App\Domain\Report\CsvExporter;
use App\Domain\Report\HtmlExporter;
use App\Domain\Report\PdfExporter;
use App\Domain\Report\ReportBuilder;
use App\Services\CalculationService;

final class ReportController
{
    private CalculationService $calc;

    public function __construct(private App $app)
    {
        $this->calc = new CalculationService($app);
    }

    public function index(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'));
        return Response::json(['data' => $this->app->db->all(
            "SELECT r.id, r.type, r.title, r.calculation_run_id, r.share_expires_at, (r.share_token_hash IS NOT NULL) AS shared, r.created_at
             FROM reports r WHERE r.project_id = ? ORDER BY r.id DESC",
            [$p['id']]
        )]);
    }

    /**
     * Creates a report from a FRESH saved calculation of the chosen scenario. Scenario comparison and sensitivity are computed
     * against the same data state, and the finished document is stored immutably.
     */
    public function store(Request $req): Response
    {
        $p = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $d = Validator::validate($req->body(), [
            'type' => ['type' => 'enum', 'in' => ['executive', 'detailed'], 'default' => 'detailed'],
            'title' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'scenario_id' => ['type' => 'int', 'min' => 1, 'nullable' => true],
        ]);
        $c = $this->calc->calculate($p, $d['scenario_id'] ?? null, $req, true);
        $scenarios = $d['type'] === 'detailed' ? $this->calc->compareScenarios($p) : [];
        $sens = $d['type'] === 'detailed' ? $this->calc->engine()->sensitivity($c['snapshot']) : null;
        $title = ($d['title'] ?? null) ?: ($p['name'] . ($d['type'] === 'detailed' ? ' — SROI analysis report' : ' — SROI executive summary'));
        $payload = (new ReportBuilder())->build($d['type'], $title, $c['run'], $c['snapshot'], $c['result'], $scenarios, $sens, gmdate('Y-m-d\TH:i:s\Z'));
        $id = $this->app->db->insert('reports', [
            'project_id' => $p['id'], 'calculation_run_id' => $c['run']['id'], 'type' => $d['type'], 'title' => $title,
            'payload' => $payload, 'created_by' => $req->user['id'],
        ]);
        Audit::log($this->app, $req, $p, 'report', $id, 'create', null, ['type' => $d['type'], 'calculation_run_id' => $c['run']['id']]);
        return Response::json(['data' => ['id' => $id, 'type' => $d['type'], 'title' => $title, 'calculation_run_id' => (int)$c['run']['id'], 'report' => $payload]], 201);
    }

    public function show(Request $req): Response
    {
        [$r] = $this->load($req, 'viewer');
        return Response::json(['data' => ['id' => (int)$r['id'], 'type' => $r['type'], 'title' => $r['title'], 'created_at' => $r['created_at'],
            'calculation_run_id' => (int)$r['calculation_run_id'], 'report' => json_decode($r['payload'], true)]]);
    }

    public function export(Request $req): Response
    {
        [$r] = $this->load($req, 'viewer');
        return $this->render($req, $r);
    }

    public function destroy(Request $req): Response
    {
        [$r, $p] = $this->load($req, 'editor');
        $this->app->db->run('DELETE FROM reports WHERE id = ?', [$r['id']]);
        Audit::log($this->app, $req, $p, 'report', (int)$r['id'], 'delete');
        return Response::noContent();
    }

    /** Create (or rotate) a read-only share link. The token is shown once; only its hash is stored. */
    public function share(Request $req): Response
    {
        [$r, $p] = $this->load($req, 'editor');
        $d = Validator::validate($req->body(), ['expires_in_days' => ['type' => 'int', 'min' => 1, 'max' => 365, 'default' => 30]]);
        $token = bin2hex(random_bytes(24));
        $expires = gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * $d['expires_in_days']);
        $this->app->db->update('reports', (int)$r['id'], ['share_token_hash' => hash('sha256', $token), 'share_expires_at' => $expires]);
        Audit::log($this->app, $req, $p, 'report', (int)$r['id'], 'share', null, ['expires_at' => $expires]);
        $base = $this->app->cfg('public_report_base_url');
        return Response::json(['data' => [
            'token' => $token, 'expires_at' => $expires,
            'path' => "/api/v1/shared/$token",
            'url' => $base !== '' ? "$base/$token" : null,
        ]], 201);
    }

    public function unshare(Request $req): Response
    {
        [$r, $p] = $this->load($req, 'editor');
        $this->app->db->update('reports', (int)$r['id'], ['share_token_hash' => null, 'share_expires_at' => null]);
        Audit::log($this->app, $req, $p, 'report', (int)$r['id'], 'unshare');
        return Response::noContent();
    }

    /** Public, read-only access through a share token (no sign-in). */
    public function shared(Request $req): Response
    {
        $r = $this->bySharedToken($req->params['token'] ?? '');
        if ($req->queryString('format') !== null) {
            return $this->render($req, $r);
        }
        return Response::json(['data' => ['title' => $r['title'], 'type' => $r['type'], 'report' => json_decode($r['payload'], true)]],
            200, ['Cache-Control' => 'private, no-store']);
    }

    // ----------------------------------------------------------------------------------------------

    /** @return array{0:array<string,mixed>,1:array<string,mixed>} */
    private function load(Request $req, string $min): array
    {
        $r = $this->app->db->one('SELECT * FROM reports WHERE id = ?', [$req->intParam('id')]);
        if ($r === null) {
            throw HttpException::notFound('Report');
        }
        $p = Access::project($this->app, $req, (int)$r['project_id'], $min);
        return [$r, $p];
    }

    /** @return array<string,mixed> */
    private function bySharedToken(string $token): array
    {
        $r = preg_match('/^[0-9a-f]{48}$/', $token)
            ? $this->app->db->one('SELECT r.* FROM reports r JOIN projects p ON p.id = r.project_id
                                   WHERE r.share_token_hash = ? AND p.deleted_at IS NULL', [hash('sha256', $token)])
            : null;
        if ($r === null || $r['share_expires_at'] === null || $r['share_expires_at'] < gmdate('Y-m-d\TH:i:s\Z')) {
            throw HttpException::notFound('Report'); // same answer for unknown, revoked and expired links
        }
        return $r;
    }

    /** @param array<string,mixed> $r */
    private function render(Request $req, array $r): Response
    {
        $doc = json_decode($r['payload'], true);
        $format = $req->queryString('format', 'json');
        $slug = trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower($this->ascii((string)$doc['project']['name']))), '-') ?: 'report';
        $name = $slug . '-' . $r['type'] . '-' . substr((string)$doc['meta']['input_hash'], 0, 8);
        $dl = fn(string $ext) => ['Content-Disposition' => "attachment; filename=\"$name.$ext\"", 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'];
        switch ($format) {
            case 'json':
                return Response::json($doc, 200, $dl('json'));
            case 'csv':
                $set = $req->queryString('dataset', 'outcomes');
                if (!in_array($set, CsvExporter::DATASETS, true)) {
                    throw HttpException::unprocessable('Validation failed', ['dataset' => 'must be one of: ' . implode(', ', CsvExporter::DATASETS)]);
                }
                return Response::raw((new CsvExporter())->export($doc, $set), 'text/csv; charset=utf-8', $dl("$set.csv"));
            case 'html':
                return Response::raw((new HtmlExporter())->export($doc), 'text/html; charset=utf-8', [
                    'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'", 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
            case 'pdf':
                return Response::raw((new PdfExporter())->export($doc), 'application/pdf', $dl('pdf'));
            default:
                throw HttpException::unprocessable('Validation failed', ['format' => 'must be one of: json, csv, html, pdf']);
        }
    }

    private function ascii(string $s): string
    {
        return (string)iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    }
}
