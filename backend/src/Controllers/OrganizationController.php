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

final class OrganizationController
{
    public function __construct(private App $app)
    {
    }

    public function index(Request $req): Response
    {
        return Response::json(['data' => $this->app->db->all(
            'SELECT o.id, o.name, m.role, o.created_at FROM memberships m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ? ORDER BY o.id',
            [$req->user['id']]
        )]);
    }

    public function store(Request $req): Response
    {
        $d = Validator::validate($req->body(), ['name' => ['type' => 'string', 'required' => true, 'max' => 200]]);
        $db = $this->app->db;
        $id = $db->transaction(function () use ($db, $d, $req) {
            $id = $db->insert('organizations', ['name' => $d['name'], 'created_by' => $req->user['id']]);
            $db->insert('memberships', ['organization_id' => $id, 'user_id' => $req->user['id'], 'role' => 'owner']);
            return $id;
        });
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $id], 'organization', $id, 'create', null, $d);
        return Response::json(['data' => ['id' => $id, 'name' => $d['name'], 'role' => 'owner']], 201);
    }

    public function members(Request $req): Response
    {
        $oid = $req->intParam('id');
        Access::requireOrg($this->app, $req, $oid, 'viewer');
        return Response::json(['data' => $this->app->db->all(
            'SELECT u.id AS user_id, u.name, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? ORDER BY u.name',
            [$oid]
        )]);
    }

    /** Add an existing user (by email) to the organisation. */
    public function addMember(Request $req): Response
    {
        $oid = $req->intParam('id');
        Access::requireOrg($this->app, $req, $oid, 'owner');
        $d = Validator::validate($req->body(), [
            'email' => ['type' => 'email', 'required' => true],
            'role' => ['type' => 'enum', 'in' => ['owner', 'editor', 'viewer'], 'default' => 'viewer'],
        ]);
        $u = $this->app->db->one('SELECT id, name, email FROM users WHERE email = ?', [$d['email']]);
        if ($u === null) {
            throw HttpException::unprocessable('No registered user has that email address', ['email' => 'unknown user'], 'unknown_user');
        }
        if (Access::orgRole($this->app, (int)$u['id'], $oid) !== null) {
            throw HttpException::conflict('That user is already a member');
        }
        $this->app->db->insert('memberships', ['organization_id' => $oid, 'user_id' => $u['id'], 'role' => $d['role']]);
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $oid], 'membership', (int)$u['id'], 'create', null, ['email' => $u['email'], 'role' => $d['role']]);
        return Response::json(['data' => ['user_id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $d['role']]], 201);
    }

    public function updateMember(Request $req): Response
    {
        $oid = $req->intParam('id');
        $uid = $req->intParam('userId');
        Access::requireOrg($this->app, $req, $oid, 'owner');
        $d = Validator::validate($req->body(), ['role' => ['type' => 'enum', 'in' => ['owner', 'editor', 'viewer'], 'required' => true]]);
        $this->guardLastOwner($oid, $uid);
        $n = $this->app->db->run('UPDATE memberships SET role = ? WHERE organization_id = ? AND user_id = ?', [$d['role'], $oid, $uid]);
        if ($n === 0) {
            throw HttpException::notFound('Member');
        }
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $oid], 'membership', $uid, 'update', null, ['role' => $d['role']]);
        return Response::json(['data' => ['user_id' => $uid, 'role' => $d['role']]]);
    }

    public function removeMember(Request $req): Response
    {
        $oid = $req->intParam('id');
        $uid = $req->intParam('userId');
        // members may remove themselves; otherwise owner required
        if ($uid !== (int)$req->user['id']) {
            Access::requireOrg($this->app, $req, $oid, 'owner');
        } else {
            Access::requireOrg($this->app, $req, $oid, 'viewer');
        }
        $this->guardLastOwner($oid, $uid);
        $n = $this->app->db->run('DELETE FROM memberships WHERE organization_id = ? AND user_id = ?', [$oid, $uid]);
        if ($n === 0) {
            throw HttpException::notFound('Member');
        }
        Audit::log($this->app, $req, ['id' => null, 'organization_id' => $oid], 'membership', $uid, 'delete');
        return Response::noContent();
    }

    private function guardLastOwner(int $oid, int $uid): void
    {
        $isOwner = Access::orgRole($this->app, $uid, $oid) === 'owner';
        $owners = (int)$this->app->db->val("SELECT COUNT(*) FROM memberships WHERE organization_id = ? AND role = 'owner'", [$oid]);
        if ($isOwner && $owners <= 1) {
            throw HttpException::conflict('An organization must keep at least one owner');
        }
    }
}
