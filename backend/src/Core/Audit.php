<?php
declare(strict_types=1);

namespace App\Core;

/** Append-only audit trail: who changed what, from which value to which, and why. */
final class Audit
{
    /**
     * @param array<string,mixed>|null $old
     * @param array<string,mixed>|null $new
     */
    public static function log(
        App $app,
        Request $req,
        ?array $project,
        string $entityType,
        ?int $entityId,
        string $action,
        ?array $old = null,
        ?array $new = null,
    ): void {
        $app->db->insert('audit_events', [
            'organization_id' => $project['organization_id'] ?? null,
            'project_id' => $project['id'] ?? null,
            'user_id' => $req->user['id'] ?? null,
            'user_name' => $req->user['name'] ?? null,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'old_values' => $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE),
            'new_values' => $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE),
            'reason' => $req->changeReason(),
        ]);
    }

    /**
     * Keep only fields that actually changed.
     * @param array<string,mixed> $old @param array<string,mixed> $new
     * @return array{0:array<string,mixed>,1:array<string,mixed>}
     */
    public static function diff(array $old, array $new): array
    {
        $o = [];
        $n = [];
        foreach ($new as $k => $v) {
            $ov = $old[$k] ?? null;
            if ($ov != $v || ($ov === null) !== ($v === null)) {
                $o[$k] = $ov;
                $n[$k] = $v;
            }
        }
        return [$o, $n];
    }
}
