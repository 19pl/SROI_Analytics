<?php
declare(strict_types=1);

namespace App\Core;

/** Organisation-level role-based access control. Non-members get 404 so project existence never leaks. */
final class Access
{
    private const RANK = ['viewer' => 1, 'editor' => 2, 'owner' => 3];

    public static function orgRole(App $app, int $userId, int $orgId): ?string
    {
        $r = $app->db->val('SELECT role FROM memberships WHERE organization_id = ? AND user_id = ?', [$orgId, $userId]);
        return $r === null ? null : (string)$r;
    }

    public static function requireOrg(App $app, Request $req, int $orgId, string $min = 'viewer'): string
    {
        $role = self::orgRole($app, (int)$req->user['id'], $orgId);
        if ($role === null) {
            throw HttpException::notFound('Organization');
        }
        if (self::RANK[$role] < self::RANK[$min]) {
            throw HttpException::forbidden("This action requires the '$min' role");
        }
        return $role;
    }

    /** @return array<string,mixed> project row plus 'role' */
    public static function project(App $app, Request $req, int $projectId, string $min = 'viewer', bool $withDeleted = false): array
    {
        $sql = 'SELECT * FROM projects WHERE id = ?' . ($withDeleted ? '' : ' AND deleted_at IS NULL');
        $p = $app->db->one($sql, [$projectId]);
        if ($p === null) {
            throw HttpException::notFound('Project');
        }
        $p['role'] = self::requireOrg($app, $req, (int)$p['organization_id'], $min);
        return $p;
    }
}
