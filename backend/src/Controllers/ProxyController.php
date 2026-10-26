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
 * Financial proxy library. Entries are organisation-owned (global entries, organization_id NULL, are read-only and
 * loaded by an administrator via bin/). No proxy values are bundled: every entry must carry its own source and limitations.
 */
final class ProxyController
{
    public function __construct(private App $app)
    {
    }

    /** @return array<string,array<string,mixed>> */
    private function rules(): array
    {
        return [
            'name' => ['type' => 'string', 'required' => true, 'max' => 300],
            'definition' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'category' => ['type' => 'string', 'required' => true, 'max' => 100],
            'unit' => ['type' => 'string', 'required' => true, 'max' => 200],
            'currency' => ['type' => 'string', 'required' => true, 'min' => 3, 'max' => 3, 'check' => fn($v) => preg_match('/^[A-Za-z]{3}$/', $v) ? null : 'must be a 3-letter currency code'],
            'value' => ['type' => 'number', 'required' => true, 'min' => 0, 'max' => 1e13],
            'geography' => ['type' => 'string', 'max' => 200, 'nullable' => true],
            'reference_year' => ['type' => 'int', 'min' => 1900, 'max' => 2200, 'nullable' => true],
            'source' => ['type' => 'string', 'required' => true, 'max' => 1000],
            'source_url' => ['type' => 'string', 'max' => 1000, 'nullable' => true, 'check' => fn($v) => preg_match('#^https?://#i', $v) ? null : 'must be an http(s) URL'],
            'limitations' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
        ];
    }

    /** Searchable list: global entries plus entries of every organisation the user belongs to. */
    public function index(Request $req): Response
    {
        $sql = 'SELECT * FROM financial_proxies WHERE (organization_id IS NULL OR organization_id IN (SELECT organization_id FROM memberships WHERE user_id = ?))';
        $params = [$req->user['id']];
        if (($q = $req->queryString('q')) !== null) {
            $like = '%' . addcslashes(mb_substr($q, 0, 100), '%_\\') . '%';
            $sql .= " AND (name LIKE ? ESCAPE '\\' OR definition LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\')";
            array_push($params, $like, $like, $like);
        }
        foreach (['category', 'currency', 'geography'] as $f) {
            if (($v = $req->queryString($f)) !== null) {
                $sql .= " AND $f = ? COLLATE NOCASE";
                $params[] = $v;
            }
        }
        if (($oid = $req->queryInt('organization_id')) !== null) {
            Access::requireOrg($this->app, $req, $oid);
            $sql .= ' AND organization_id = ?';
            $params[] = $oid;
        }
        $limit = min(200, max(1, $req->queryInt('limit', 50)));
        $offset = max(0, $req->queryInt('offset', 0));
        return Response::json(['data' => $this->app->db->all($sql . " ORDER BY category, name LIMIT $limit OFFSET $offset", $params), 'limit' => $limit, 'offset' => $offset]);
    }

    public function show(Request $req): Response
    {
        return Response::json(['data' => $this->visible($req, $req->intParam('id'))]);
    }

    public function store(Request $req): Response
    {
        $oid = $req->intParam('id');
        Access::requireOrg($this->app, $req, $oid, 'editor');
        $d = Validator::validate($req->body(), $this->rules());
        $d['currency'] = strtoupper($d['currency']);
        $id = $this->app->db->insert('financial_proxies', $d + ['organization_id' => $oid, 'created_by' => $req->user['id']]);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $oid], 'financial_proxy', $id, 'create', null, $d);
        return Response::json(['data' => $this->visible($req, $id)], 201);
    }

    public function update(Request $req): Response
    {
        $p = $this->writable($req, $req->intParam('id'));
        $d = Validator::validate($req->body(), $this->rules(), true);
        if (isset($d['currency'])) {
            $d['currency'] = strtoupper($d['currency']);
        }
        [$old, $new] = Audit::diff($p, $d);
        if ($new !== []) {
            $d['updated_at'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->app->db->update('financial_proxies', (int)$p['id'], $d);
            Audit::log($this->app, $req, ['id' => null, 'organization_id' => $p['organization_id']], 'financial_proxy', (int)$p['id'], 'update', $old, $new);
        }
        return Response::json(['data' => $this->visible($req, (int)$p['id'])]);
    }

    public function destroy(Request $req): Response
    {
        $p = $this->writable($req, $req->intParam('id'));
        $this->app->db->run('DELETE FROM financial_proxies WHERE id = ?', [$p['id']]); // outcomes keep their copied value (proxy_id -> NULL)
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $p['organization_id']], 'financial_proxy', (int)$p['id'], 'delete', $p, null);
        return Response::noContent();
    }

    /** @return array<string,mixed> */
    private function visible(Request $req, int $id): array
    {
        $p = $this->app->db->one('SELECT * FROM financial_proxies WHERE id = ?', [$id]);
        if ($p === null || ($p['organization_id'] !== null && Access::orgRole($this->app, (int)$req->user['id'], (int)$p['organization_id']) === null)) {
            throw HttpException::notFound('Financial proxy');
        }
        return $p;
    }

    /** @return array<string,mixed> */
    private function writable(Request $req, int $id): array
    {
        $p = $this->visible($req, $id);
        if ($p['organization_id'] === null) {
            throw HttpException::forbidden('Global library entries are read-only');
        }
        Access::requireOrg($this->app, $req, (int)$p['organization_id'], 'editor');
        return $p;
    }
}
