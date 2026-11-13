<?php
declare(strict_types=1);

use App\Core\App;
use App\Core\Kernel;
use App\Core\Migrator;
use App\Core\Request;
use Tests\T;

$tmp = sys_get_temp_dir() . '/sroi-test-' . bin2hex(random_bytes(4));
mkdir($tmp, 0775, true);
$app = new App([
    'db_path' => ':memory:', 'storage_path' => $tmp, 'debug' => true, 'token_ttl_days' => 1, 'cors_origins' => ['http://localhost:3000'],
    'max_body_bytes' => 2097152, 'max_upload_bytes' => 1048576, 'public_report_base_url' => 'https://app.example/r', 'allow_non_uploaded_files' => true,
]);
Migrator::run($app->db, dirname(__DIR__) . '/database/migrations');
$kernel = new Kernel($app);

/** @return array{0:int,1:mixed,2:\App\Core\Response} */
$call = function (string $method, string $path, ?array $body = null, ?string $token = null, array $query = [], array $files = [], array $headers = []) use ($kernel): array {
    $h = array_change_key_case($headers);
    if ($token) {
        $h['authorization'] = "Bearer $token";
    }
    $res = $kernel->handle(new Request($method, '/api/v1' . $path, $query, $h, $body === null ? null : json_encode($body), $files, '127.0.0.1', $files ? ($body ?? []) : null));
    $json = str_contains($res->headers['Content-Type'] ?? '', 'json') ? json_decode($res->body, true) : $res->body;
    return [$res->status, $json, $res];
};

/**
 * Test fixture: there is no registration endpoint any more, so create a user (+ their own organization as owner)
 * straight in the database, then sign in through the real /auth/login endpoint.
 * Returns [status, json] shaped like the old register response: token, user, organizations.
 * @return array{0:int,1:mixed}
 */
$register = function (array $d) use ($app, $call): array {
    $db = $app->db;
    $uid = $db->insert('users', ['email' => $d['email'], 'name' => $d['name'], 'password_hash' => password_hash($d['password'], PASSWORD_DEFAULT)]);
    $orgName = $d['organization_name'] ?? ($d['name'] . "'s workspace");
    $oid = $db->insert('organizations', ['name' => $orgName, 'created_by' => $uid]);
    $db->insert('memberships', ['organization_id' => $oid, 'user_id' => $uid, 'role' => 'owner']);
    [$s, $j] = $call('POST', '/auth/login', ['email' => $d['email'], 'password' => $d['password']]);
    return [$s === 200 ? 201 : $s, $j];
};

// ---- auth ----------------------------------------------------------------------------------------
T::test('api: login, me, bad credentials, logout (no self-registration)', function () use ($call, $register) {
    [$s] = $call('POST', '/auth/register', ['email' => 'x@x.org', 'name' => 'X', 'password' => 'correct-horse-9']);
    T::eq(404, $s, 'registration endpoint is gone');
    $register(['email' => 'a@x.org', 'name' => 'Alice', 'password' => 'correct-horse-9']);
    [$s] = $call('POST', '/auth/login', ['email' => 'a@x.org', 'password' => 'wrong-password']);
    T::eq(401, $s);
    [$s] = $call('POST', '/auth/login', ['email' => 'nobody@x.org', 'password' => 'whatever-123']);
    T::eq(401, $s, 'unknown email gets the same answer as a wrong password');
    [$s, $j] = $call('POST', '/auth/login', ['email' => 'A@x.org', 'password' => 'correct-horse-9']);
    T::eq(200, $s, 'email is case-insensitive');
    [$s, $me] = $call('GET', '/auth/me', null, $j['token']);
    T::eq(200, $s);
    T::eq('Alice', $me['user']['name']);
    T::eq('owner', $me['organizations'][0]['role']);
    [$s] = $call('GET', '/auth/me');
    T::eq(401, $s);
    [$s] = $call('GET', '/auth/me', null, 'deadbeef');
    T::eq(401, $s);
    [$s] = $call('POST', '/auth/logout', null, $j['token']);
    T::eq(204, $s);
    [$s] = $call('GET', '/auth/me', null, $j['token']);
    T::eq(401, $s, 'token is dead after logout');
});

T::test('api: guests (no token) get 401 on every data route but can reach health/meta', function () use ($call) {
    foreach (['/projects', '/organizations', '/proxies', '/projects/1', '/faculties/1', '/departments/1', '/reports/1'] as $path) {
        [$s] = $call('GET', $path);
        T::eq(401, $s, "GET $path without a token");
    }
    [$s] = $call('GET', '/health');
    T::eq(200, $s);
    [$s] = $call('GET', '/meta');
    T::eq(200, $s);
});

T::test('api: login is rate limited after repeated failures', function () use ($call) {
    for ($i = 0; $i < 10; $i++) {
        $call('POST', '/auth/login', ['email' => 'a@x.org', 'password' => 'nope-nope-nope']);
    }
    [$s] = $call('POST', '/auth/login', ['email' => 'a@x.org', 'password' => 'correct-horse-9']);
    T::eq(429, $s);
});

// ---- full workflow ---------------------------------------------------------------------------------
T::test('api: full SROI workflow reproduces the spec example and exports', function () use ($call, $app, $tmp, $register) {
    [, $reg] = $register(['email' => 'owner@x.org', 'name' => 'Owner', 'password' => 'correct-horse-9', 'organization_name' => 'Uni']);
    $tok = $reg['token'];

    [$s, $p] = $call('POST', '/projects', ['name' => 'Tutoring', 'currency' => 'thb', 'analysis_period_years' => 1, 'discount_rate' => 0.03,
        'discount_rate_basis' => 'real', 'discount_rate_source' => 'test', 'investment_basis' => 'nominal', 'start_date' => '2026-01-01', 'end_date' => '2026-12-31'], $tok);
    T::eq(201, $s);
    $pid = $p['data']['id'];
    T::eq('THB', $p['data']['currency']);
    [$s, $bad] = $call('POST', '/projects', ['name' => 'x', 'currency' => 'THB', 'start_date' => '2026-05-01', 'end_date' => '2026-01-01'], $tok);
    T::eq(422, $s, 'end before start rejected');

    [, $sc] = $call('GET', "/projects/$pid/scenarios", null, $tok);
    T::eq(['base', 'conservative', 'optimistic'], array_column($sc['data'], 'kind'));

    // investment: 20k + 50k + 10k + 10k = 90k (+ 10k of in-kind to total 100k)
    foreach ([['capex', 'Initial equipment', 20000, true], ['opex', 'Staff and tutoring', 50000, true], ['delivery', 'Learning materials', 10000, true],
              ['administration', 'Administration', 10000, true], ['in_kind', 'Volunteer time', 10000, true]] as [$cat, $desc, $amt]) {
        [$s, $c] = $call('POST', "/projects/$pid/costs", ['category' => $cat, 'description' => $desc, 'amount' => $amt, 'year' => 0], $tok);
        T::eq(201, $s);
    }
    T::eq(false, $c['data']['is_cash'], 'in-kind forced to non-cash');
    [$s] = $call('POST', "/projects/$pid/costs", ['category' => 'opex', 'description' => 'late', 'amount' => 1, 'year' => 5], $tok);
    T::eq(422, $s, 'cost year beyond analysis period');
    [$s] = $call('POST', "/projects/$pid/costs", ['category' => 'opex', 'description' => 'neg', 'amount' => -1, 'year' => 0], $tok);
    T::eq(422, $s, 'negative cost');

    [, $sum] = $call('GET', "/projects/$pid/summary", null, $tok);
    T::eq(20000.0, $sum['data']['initial_investment']);
    T::eq(100000.0, $sum['data']['total_investment']);
    T::eq(10000.0, $sum['data']['in_kind_resources']);

    [, $st] = $call('POST', "/projects/$pid/stakeholders", ['name' => 'Families', 'estimated_count' => 40], $tok);
    $sid = $st['data']['id'];

    [$s, $o] = $call('POST', "/projects/$pid/outcomes", ['stakeholder_id' => $sid, 'name' => 'Reduced tutoring costs', 'quantity' => 40, 'proxy_value' => 80000,
        'proxy_source' => 'household survey', 'evidence_quality' => 'measured', 'duration_years' => 1], $tok);
    T::eq(201, $s);
    $oid = $o['data']['id'];
    T::eq(80000.0, $o['data']['annual_gross_value']);
    T::eq(null, $o['data']['adjustment']);

    // review: adjustments not yet assessed => step 4 incomplete, but calculable
    [, $rev] = $call('GET', "/projects/$pid/review", null, $tok);
    T::true($rev['data']['ready_to_calculate']);
    T::eq(false, $rev['data']['steps'][4]['complete']);

    [$s, $a] = $call('PUT', "/projects/$pid/outcomes/$oid/adjustment", ['deadweight' => 0.15, 'attribution' => 0.20, 'displacement' => 0,
        'justification' => 'Comparison group', 'source' => 'Survey 2026', 'change_reason' => 'initial assessment'], $tok);
    T::eq(200, $s);
    T::eq(54400.0, $a['data']['preview']['after_displacement']);
    [$s] = $call('PUT', "/projects/$pid/outcomes/$oid/adjustment", ['deadweight' => 1.5], $tok);
    T::eq(422, $s, 'deadweight 150% rejected');

    // dashboard (live) then saved run
    [, $dash] = $call('GET', "/projects/$pid/dashboard", null, $tok);
    T::eq('ready', $dash['data']['status']);
    $r = $dash['data']['result']['summary'];
    T::eq(52815.53, $r['present_value_of_impact']);
    T::eq(100000.0, $r['investment_used']);
    T::eq(0.5282, $r['sroi_ratio']);
    T::eq(3, count($dash['data']['scenarios']));

    [$s, $run] = $call('POST', "/projects/$pid/calculate", [], $tok);
    T::eq(201, $s);
    $run1 = $run['data']['run']['id'];

    // change an input; compare runs
    $call('PATCH', "/projects/$pid/outcomes/$oid", ['proxy_value' => 90000, 'change_reason' => 'new survey'], $tok);
    [, $run2] = $call('POST', "/projects/$pid/calculate", [], $tok);
    [$s, $cmp] = $call('GET', "/projects/$pid/run-comparison", null, $tok, ['a' => (string)$run1, 'b' => (string)$run2['data']['run']['id']]);
    T::eq(200, $s);
    T::true($cmp['data']['delta']['present_value'] > 0);
    T::true(count(array_filter($cmp['data']['changed_inputs'], fn($c) => str_ends_with($c['path'], 'proxy_value'))) === 1);

    // audit trail captured old/new and reason
    [, $aud] = $call('GET', "/projects/$pid/audit", null, $tok, ['entity_type' => 'outcome']);
    $upd = array_values(array_filter($aud['data'], fn($e) => $e['action'] === 'update'))[0];
    T::eq(80000.0, $upd['old_values']['proxy_value']);
    T::eq(90000.0, $upd['new_values']['proxy_value']);
    T::eq('new survey', $upd['reason']);

    // scenario overrides + comparison
    $cons = $sc['data'][1]['id'];
    [$s] = $call('PATCH', "/projects/$pid/scenarios/$cons", ['assumptions' => ['global' => ['quantity_multiplier' => 0.5]]], $tok);
    T::eq(200, $s);
    [$s] = $call('PATCH', "/projects/$pid/scenarios/$cons", ['assumptions' => ['global' => ['deadweight_delta' => 9]]], $tok);
    T::eq(422, $s);
    [$s] = $call('PATCH', "/projects/$pid/scenarios/$cons", ['assumptions' => ['outcomes' => ['9999' => ['quantity' => 1]]]], $tok);
    T::eq(422, $s, 'override for foreign outcome');
    [, $cmpS] = $call('GET', "/projects/$pid/scenario-comparison", null, $tok);
    T::true($cmpS['data'][1]['present_value_of_impact'] < $cmpS['data'][0]['present_value_of_impact']);
    [$s] = $call('DELETE', "/projects/$pid/scenarios/" . $sc['data'][0]['id'], null, $tok);
    T::eq(409, $s, 'base scenario protected');

    // sensitivity
    [$s, $sens] = $call('GET', "/projects/$pid/sensitivity", null, $tok);
    T::eq(200, $s);
    T::true(count($sens['data']['rows']) >= 5);

    // evidence: url + file
    [$s] = $call('POST', "/projects/$pid/evidence", ['entity_type' => 'outcome', 'entity_id' => $oid, 'kind' => 'url', 'title' => 'Survey', 'reference' => 'javascript:alert(1)'], $tok);
    T::eq(422, $s, 'non-http url rejected');
    [$s, $ev] = $call('POST', "/projects/$pid/evidence", ['entity_type' => 'outcome', 'entity_id' => $oid, 'kind' => 'url', 'title' => 'Survey', 'reference' => 'https://example.org/s'], $tok);
    T::eq(201, $s);
    $csv = "$tmp/in.csv";
    file_put_contents($csv, "a,b\n1,2\n");
    [$s, $ev] = $call('POST', "/projects/$pid/evidence", ['title' => 'Data'], $tok, [], ['file' => ['name' => 'data.csv', 'tmp_name' => $csv, 'error' => 0, 'size' => 8]]);
    T::eq(201, $s);
    [$s, , $dl] = $call('GET', "/projects/$pid/evidence/{$ev['data']['id']}/download", null, $tok);
    T::eq(200, $s);
    T::eq("a,b\n1,2\n", $dl->body);
    file_put_contents("$tmp/evil.csv", "<?php echo 1;");
    [$s] = $call('POST', "/projects/$pid/evidence", ['title' => 'x'], $tok, [], ['file' => ['name' => 'evil.php', 'tmp_name' => "$tmp/evil.csv", 'error' => 0, 'size' => 13]]);
    T::eq(422, $s, 'php upload rejected');

    // reports
    [$s, $rep] = $call('POST', "/projects/$pid/reports", ['type' => 'detailed'], $tok);
    T::eq(201, $s);
    $rid = $rep['data']['id'];
    T::eq(1, count($rep['data']['report']['sources']) >= 1 ? 1 : 0);
    [, $latest] = $call('GET', "/projects/$pid/runs/{$rep['data']['calculation_run_id']}", null, $tok);
    T::eq($latest['data']['result']['summary'], $rep['data']['report']['headline'], 'report headline == stored run result');
    foreach (['pdf' => 'application/pdf', 'html' => 'text/html; charset=utf-8', 'csv' => 'text/csv; charset=utf-8', 'json' => 'application/json; charset=utf-8'] as $f => $ct) {
        [$s, , $ex] = $call('GET', "/reports/$rid/export", null, $tok, ['format' => $f]);
        T::eq(200, $s, "export $f");
        T::eq($ct, $ex->headers['Content-Type']);
        if ($f === 'pdf') {
            T::true(str_starts_with($ex->body, '%PDF-1.4') && str_ends_with($ex->body, '%%EOF'));
            file_put_contents("$tmp/out.pdf", $ex->body);
            @copy("$tmp/out.pdf", sys_get_temp_dir() . '/sroi-last.pdf');
        }
        if ($f === 'html') {
            T::true(str_contains($ex->body, 'Reduced tutoring costs') && !str_contains($ex->body, '<script'));
        }
    }
    [$s, , $ex] = $call('GET', "/reports/$rid/export", null, $tok, ['format' => 'csv', 'dataset' => 'annual']);
    T::eq(200, $s);
    [$s] = $call('GET', "/reports/$rid/export", null, $tok, ['format' => 'csv', 'dataset' => 'nope']);
    T::eq(422, $s);
    [$s, $ex] = $call('POST', "/projects/$pid/reports", ['type' => 'executive'], $tok);
    T::eq(201, $s);
    T::true(!isset($ex['data']['report']['outcome_calculations']), 'executive report is summary only');

    // sharing: token works unauthenticated, revocation and expiry both 404
    [$s, $sh] = $call('POST', "/reports/$rid/share", ['expires_in_days' => 7], $tok);
    T::eq(201, $s);
    [$s, $pub] = $call('GET', '/shared/' . $sh['data']['token']);
    T::eq(200, $s);
    T::eq('Tutoring', $pub['data']['report']['project']['name']);
    [$s] = $call('GET', '/shared/' . str_repeat('a', 48));
    T::eq(404, $s);
    $app->db->run("UPDATE reports SET share_expires_at = '2000-01-01T00:00:00Z' WHERE id = ?", [$rid]);
    [$s] = $call('GET', '/shared/' . $sh['data']['token']);
    T::eq(404, $s, 'expired link');
    $call('POST', "/reports/$rid/share", [], $tok);
    $call('DELETE', "/reports/$rid/share", null, $tok);
    [$s] = $call('GET', '/shared/' . $sh['data']['token']);
    T::eq(404, $s, 'revoked link');

    // stakeholder with outcomes cannot be deleted
    [$s] = $call('DELETE', "/projects/$pid/stakeholders/$sid", null, $tok);
    T::eq(409, $s);

    // soft delete + restore
    [$s] = $call('DELETE', "/projects/$pid", null, $tok);
    T::eq(204, $s);
    [$s] = $call('GET', "/projects/$pid", null, $tok);
    T::eq(404, $s);
    [$s] = $call('POST', "/projects/$pid/restore", null, $tok);
    T::eq(200, $s);
});

// ---- authorisation -----------------------------------------------------------------------------------
T::test('api: tenant isolation and role-based permissions', function () use ($call, $register) {
    [, $a] = $register(['email' => 'iso-a@x.org', 'name' => 'A', 'password' => 'correct-horse-9']);
    [, $b] = $register(['email' => 'iso-b@x.org', 'name' => 'B', 'password' => 'correct-horse-9']);
    [, $p] = $call('POST', '/projects', ['name' => 'Private', 'currency' => 'USD'], $a['token']);
    $pid = $p['data']['id'];
    foreach (['GET', 'PATCH', 'DELETE'] as $m) {
        [$s] = $call($m, "/projects/$pid", $m === 'PATCH' ? ['name' => 'hack'] : null, $b['token']);
        T::eq(404, $s, "outsider $m");
    }
    [$s] = $call('GET', "/projects/$pid/costs", null, $b['token']);
    T::eq(404, $s);
    [$s] = $call('POST', "/projects/$pid/costs", ['category' => 'opex', 'description' => 'x', 'amount' => 1, 'year' => 0], $b['token']);
    T::eq(404, $s);
    [, $list] = $call('GET', '/projects', null, $b['token']);
    T::eq([], $list['data']);

    $orgA = $a['organizations'][0]['id'];
    [$s] = $call('POST', "/organizations/$orgA/members", ['email' => 'iso-b@x.org', 'role' => 'viewer'], $a['token']);
    T::eq(201, $s);
    [$s] = $call('GET', "/projects/$pid", null, $b['token']);
    T::eq(200, $s, 'viewer can read');
    [$s] = $call('POST', "/projects/$pid/costs", ['category' => 'opex', 'description' => 'x', 'amount' => 1, 'year' => 0], $b['token']);
    T::eq(403, $s, 'viewer cannot write');
    [$s] = $call('POST', "/projects/$pid/calculate", [], $b['token']);
    T::eq(403, $s);
    [$s] = $call('DELETE', "/organizations/$orgA/members/" . $a['user']['id'], null, $a['token']);
    T::eq(409, $s, 'last owner protected');
    [$s] = $call('PATCH', "/organizations/$orgA/members/" . $b['user']['id'], ['role' => 'editor'], $b['token']);
    T::eq(403, $s, 'viewer cannot promote self');
});

T::test('api: organization member role updates and faculty hierarchy permissions', function () use ($call, $register) {
    [, $owner] = $register(['email' => 'rbac-owner@x.org', 'name' => 'Owner', 'password' => 'correct-horse-9']);
    [, $editor] = $register(['email' => 'rbac-editor@x.org', 'name' => 'Editor', 'password' => 'correct-horse-9']);
    [, $viewer] = $register(['email' => 'rbac-viewer@x.org', 'name' => 'Viewer', 'password' => 'correct-horse-9']);
    $oid = $owner['organizations'][0]['id'];
    $ownerId = $owner['user']['id'];
    $editorId = $editor['user']['id'];
    $viewerId = $viewer['user']['id'];

    [$status] = $call('POST', "/organizations/$oid/members", ['email' => 'rbac-editor@x.org', 'role' => 'editor'], $owner['token']);
    T::eq(201, $status, 'owner adds editor');
    [$status] = $call('POST', "/organizations/$oid/members", ['email' => 'rbac-viewer@x.org', 'role' => 'viewer'], $owner['token']);
    T::eq(201, $status, 'owner adds viewer');

    [$status, $fac] = $call('POST', "/organizations/$oid/faculties", ['name' => 'Editor Faculty'], $editor['token']);
    T::eq(201, $status, 'editor can create faculty');
    $fid = $fac['data']['id'];
    [$status] = $call('POST', "/organizations/$oid/faculties", ['name' => 'Viewer Forbidden'], $viewer['token']);
    T::eq(403, $status, 'viewer cannot create faculty');
    [$status, $dept] = $call('POST', "/faculties/$fid/departments", ['name' => 'Editor Department'], $editor['token']);
    T::eq(201, $status, 'editor can create department');
    $did = $dept['data']['id'];
    [$status] = $call('PATCH', "/faculties/$fid", ['name' => 'Editor Renamed'], $editor['token']);
    T::eq(200, $status, 'editor can update faculty');
    [$status] = $call('DELETE', "/faculties/$fid", null, $editor['token']);
    T::eq(403, $status, 'editor cannot delete faculty');
    [$status] = $call('DELETE', "/departments/$did", null, $editor['token']);
    T::eq(403, $status, 'editor cannot delete department');

    [$status] = $call('PATCH', "/organizations/$oid/members/$viewerId", ['role' => 'editor'], $editor['token']);
    T::eq(403, $status, 'editor cannot manage member roles');
    [$status] = $call('PATCH', "/organizations/$oid/members/$viewerId", ['role' => 'editor'], $owner['token']);
    T::eq(200, $status, 'owner can change member role');
    [$status] = $call('DELETE', "/organizations/$oid/members/$viewerId", null, $editor['token']);
    T::eq(403, $status, 'editor cannot remove another member');
    [$status] = $call('DELETE', "/organizations/$oid/members/$ownerId", null, $owner['token']);
    T::eq(409, $status, 'last owner cannot remove self');
    [$status] = $call('DELETE', "/organizations/$oid/members/$editorId", null, $owner['token']);
    T::eq(204, $status, 'owner can remove another member');
    [$status] = $call('DELETE', "/departments/$did", null, $owner['token']);
    T::eq(204, $status, 'owner can delete empty department');
    [$status] = $call('DELETE', "/faculties/$fid", null, $owner['token']);
    T::eq(204, $status, 'owner can delete empty faculty');

    // An owner can retain the owner role, but cannot demote the final owner.
    [$status] = $call('PATCH', "/organizations/$oid/members/$ownerId", ['role' => 'owner'], $owner['token']);
    T::eq(200, $status, 'last owner may retain owner role');
    [$status] = $call('PATCH', "/organizations/$oid/members/$ownerId", ['role' => 'viewer'], $owner['token']);
    T::eq(409, $status, 'last owner cannot be demoted');
});

T::test('api: incomplete project gives 422 with actionable codes, dashboard reports incomplete', function () use ($call, $register) {
    [, $a] = $register(['email' => 'inc@x.org', 'name' => 'I', 'password' => 'correct-horse-9']);
    [, $p] = $call('POST', '/projects', ['name' => 'Draft', 'currency' => 'THB'], $a['token']);
    $pid = $p['data']['id'];
    [$s, $j] = $call('POST', "/projects/$pid/calculate", [], $a['token']);
    T::eq(422, $s);
    $codes = array_column($j['error']['details'], 'code');
    T::true(in_array('discount_rate_required', $codes, true) && in_array('analysis_period_required', $codes, true) && in_array('investment_basis_required', $codes, true));
    [$s, $d] = $call('GET', "/projects/$pid/dashboard", null, $a['token']);
    T::eq('incomplete', $d['data']['status']);
    [$s] = $call('PATCH', "/projects/$pid", ['analysis_period_years' => 3, 'discount_rate' => 1.5], $a['token']);
    T::eq(422, $s);
});

T::test('api: stateless preview, malformed bodies, unknown routes, CORS, security headers', function () use ($call, $kernel, $register) {
    [, $a] = $register(['email' => 'pv@x.org', 'name' => 'P', 'password' => 'correct-horse-9']);
    $snap = ['project' => ['currency' => 'THB', 'analysis_period_years' => 1, 'discount_rate' => 0, 'investment_basis' => 'nominal'],
        'costs' => [['category' => 'opex', 'description' => 'c', 'amount' => 100, 'year' => 0]], 'stakeholders' => [['id' => 1, 'name' => 's']],
        'outcomes' => [['id' => 1, 'stakeholder_id' => 1, 'name' => 'o', 'quantity' => 1, 'proxy_value' => 350, 'evidence_quality' => 'measured']]];
    [$s, $j] = $call('POST', '/calculator/preview', $snap, $a['token']);
    T::eq(200, $s);
    T::eq(3.5, $j['data']['summary']['sroi_ratio']);
    [$s] = $call('POST', '/calculator/preview', $snap);
    T::eq(401, $s);
    $res = $kernel->handle(new Request('POST', '/api/v1/auth/login', [], [], '{bad json'));
    T::eq(400, $res->status);
    $res = $kernel->handle(new Request('POST', '/api/v1/auth/login', [], [], '[1,2]'));
    T::eq(400, $res->status);
    [$s] = $call('GET', '/nope');
    T::eq(404, $s);
    [$s] = $call('DELETE', '/health');
    T::eq(405, $s);
    $res = $kernel->handle(new Request('OPTIONS', '/api/v1/projects', [], ['origin' => 'http://localhost:3000']));
    T::eq(204, $res->status);
    T::eq('http://localhost:3000', $res->headers['Access-Control-Allow-Origin']);
    $res = $kernel->handle(new Request('GET', '/api/v1/health', [], ['origin' => 'http://evil.example']));
    T::true(!isset($res->headers['Access-Control-Allow-Origin']));
    T::eq('nosniff', $res->headers['X-Content-Type-Options']);
});

T::test('api: SQL-injection style input is treated as data', function () use ($call, $register) {
    [, $a] = $register(['email' => 'sqli@x.org', 'name' => "Robert'); DROP TABLE users;--", 'password' => 'correct-horse-9']);
    T::true(isset($a['token']));
    [$s, $l] = $call('GET', '/proxies', null, $a['token'], ['q' => "' OR 1=1 --"]);
    T::eq(200, $s);
    T::eq([], $l['data']);
    [$s] = $call('POST', '/auth/login', ['email' => 'sqli@x.org', 'password' => 'correct-horse-9']);
    T::eq(200, $s);
});

T::test('api: proxy library is organisation scoped, searchable, requires a source', function () use ($call, $register) {
    [, $a] = $register(['email' => 'px-a@x.org', 'name' => 'A', 'password' => 'correct-horse-9']);
    [, $b] = $register(['email' => 'px-b@x.org', 'name' => 'B', 'password' => 'correct-horse-9']);
    $org = $a['organizations'][0]['id'];
    [$s] = $call('POST', "/organizations/$org/proxies", ['name' => 'Hour of tutoring', 'category' => 'Education', 'unit' => 'hour', 'currency' => 'thb', 'value' => 300], $a['token']);
    T::eq(422, $s, 'source required');
    [$s, $px] = $call('POST', "/organizations/$org/proxies", ['name' => 'Hour of tutoring', 'category' => 'Education', 'unit' => 'hour', 'currency' => 'thb', 'value' => 300,
        'source' => 'Market survey 2026', 'source_url' => 'https://example.org', 'reference_year' => 2026], $a['token']);
    T::eq(201, $s);
    [, $l] = $call('GET', '/proxies', null, $a['token'], ['q' => 'tutoring', 'category' => 'education']);
    T::eq(1, count($l['data']));
    [, $l] = $call('GET', '/proxies', null, $b['token'], ['q' => 'tutoring']);
    T::eq(0, count($l['data']), 'other org cannot see');
    [$s] = $call('GET', '/proxies/' . $px['data']['id'], null, $b['token']);
    T::eq(404, $s);
});

// ---- faculty & department hierarchy -------------------------------------------------------------------------
T::test('api: faculty CRUD, department CRUD, plan ownership, consolidated report', function () use ($call, $register) {
    [, $a] = $register(['email' => 'fac@x.org', 'name' => 'FacOwner', 'password' => 'correct-horse-9']);
    $tok  = $a['token'];
    $oid  = $a['organizations'][0]['id'];

    // Create faculty
    [$s, $fac] = $call('POST', "/organizations/$oid/faculties", ['name' => 'คณะสหเวชศาสตร์', 'description' => 'Allied Health Sciences'], $tok);
    T::eq(201, $s);
    $fid = $fac['data']['id'];
    T::eq('คณะสหเวชศาสตร์', $fac['data']['name']);

    // List faculties
    [$s, $list] = $call('GET', "/organizations/$oid/faculties", null, $tok);
    T::eq(200, $s);
    T::eq(1, count($list['data']));

    // Show faculty
    [$s, $shown] = $call('GET', "/faculties/$fid", null, $tok);
    T::eq(200, $s);
    T::eq($fid, $shown['data']['id']);

    // Rename faculty
    [$s, $upd] = $call('PATCH', "/faculties/$fid", ['name' => 'Allied Health'], $tok);
    T::eq(200, $s);
    T::eq('Allied Health', $upd['data']['name']);

    // Create department under faculty
    [$s, $dept] = $call('POST', "/faculties/$fid/departments", ['name' => 'กายภาพบำบัด'], $tok);
    T::eq(201, $s);
    $did = $dept['data']['id'];

    // List departments of faculty
    [$s, $dlist] = $call('GET', "/faculties/$fid/departments", null, $tok);
    T::eq(200, $s);
    T::eq(1, count($dlist['data']));

    // Show and update department
    [$s, $ds] = $call('GET', "/departments/$did", null, $tok);
    T::eq(200, $s);
    [$s, $du] = $call('PATCH', "/departments/$did", ['name' => 'Physical Therapy'], $tok);
    T::eq(200, $s);
    T::eq('Physical Therapy', $du['data']['name']);

    // Create a faculty-owned plan (no department)
    [$s, $fp] = $call('POST', '/projects', ['name' => 'Faculty Plan', 'currency' => 'THB', 'faculty_id' => $fid], $tok);
    T::eq(201, $s, 'faculty-owned plan created');
    $fpid = $fp['data']['id'];
    T::eq($fid, $fp['data']['faculty_id']);
    T::eq(null, $fp['data']['department_id']);

    // Create a department-owned plan
    [$s, $dp] = $call('POST', '/projects', ['name' => 'Dept Plan', 'currency' => 'THB', 'department_id' => $did], $tok);
    T::eq(201, $s, 'department-owned plan created');
    $dpid = $dp['data']['id'];
    T::eq($did, $dp['data']['department_id']);
    T::eq(null, $dp['data']['faculty_id']);

    // Owner display names are derived server-side so the UI never shows a blank institution
    T::eq('faculty', $fp['data']['owner_level'], 'faculty plan owner level');
    T::true(is_string($fp['data']['owner_name']) && $fp['data']['owner_name'] !== '', 'faculty plan has owner_name');
    T::eq($fp['data']['faculty_name'], $fp['data']['owner_name'], 'faculty plan owner_name = faculty name');
    T::eq('department', $dp['data']['owner_level'], 'dept plan owner level');
    T::eq('Physical Therapy', $dp['data']['owner_name'], 'dept plan owner_name = department name');
    T::eq('Physical Therapy', $dp['data']['department_name']);
    T::true(is_string($dp['data']['faculty_name']) && $dp['data']['faculty_name'] !== '', 'dept plan exposes parent faculty name');

    // Reject plan with both faculty_id and department_id
    [$s] = $call('POST', '/projects', ['name' => 'Bad', 'currency' => 'THB', 'faculty_id' => $fid, 'department_id' => $did], $tok);
    T::eq(422, $s, 'dual ownership rejected');

    // Filter projects by faculty
    [$s, $fl] = $call('GET', '/projects', null, $tok, ['faculty_id' => (string)$fid]);
    T::eq(200, $s);
    T::eq(1, count($fl['data']), 'only faculty-owned plan returned');

    // Filter projects by department
    [$s, $dl2] = $call('GET', '/projects', null, $tok, ['department_id' => (string)$did]);
    T::eq(200, $s);
    T::eq(1, count($dl2['data']), 'only dept-owned plan returned');

    // Faculty consolidated report
    [$s, $rpt] = $call('GET', "/faculties/$fid/report", null, $tok);
    T::eq(200, $s);
    T::eq(2, count($rpt['data']['plans']), 'faculty report includes both owned and dept plans');
    $directPlan = array_values(array_filter($rpt['data']['plans'], fn($p) => $p['id'] === $fpid))[0];
    T::eq(true, $directPlan['owned_by_faculty']);
    $deptPlan = array_values(array_filter($rpt['data']['plans'], fn($p) => $p['id'] === $dpid))[0];
    T::eq(false, $deptPlan['owned_by_faculty']);
    T::eq($did, $deptPlan['department_id']);
    T::true(isset($rpt['data']['note']));

    // Cannot delete department with active plans
    [$s] = $call('DELETE', "/departments/$did", null, $tok);
    T::eq(409, $s, 'dept with plans cannot be deleted');

    // Cannot delete faculty with plans
    [$s] = $call('DELETE', "/faculties/$fid", null, $tok);
    T::eq(409, $s, 'faculty with plans cannot be deleted');
});

T::test('api: stakeholder group fields are stored and retrieved', function () use ($call, $register) {
    [, $a] = $register(['email' => 'stkg@x.org', 'name' => 'G', 'password' => 'correct-horse-9']);
    $tok = $a['token'];
    [, $p] = $call('POST', '/projects', ['name' => 'Grp', 'currency' => 'THB'], $tok);
    $pid = $p['data']['id'];

    [$s, $s1] = $call('POST', "/projects/$pid/stakeholders",
        ['name' => 'Patients', 'stakeholder_group' => 'primary_beneficiary', 'group_code' => 'S1'], $tok);
    T::eq(201, $s);
    T::eq('primary_beneficiary', $s1['data']['stakeholder_group']);
    T::eq('S1', $s1['data']['group_code']);

    // Invalid group rejected
    [$s] = $call('POST', "/projects/$pid/stakeholders",
        ['name' => 'X', 'stakeholder_group' => 'invalid_group'], $tok);
    T::eq(422, $s, 'invalid stakeholder_group rejected');
});

T::test('api: funding lines link to a stakeholder (migration 006) and survive its deletion', function () use ($call, $register) {
    [, $a] = $register(['email' => 'fund@x.org', 'name' => 'F', 'password' => 'correct-horse-9']);
    $tok = $a['token'];
    [, $p] = $call('POST', '/projects', ['name' => 'Fund', 'currency' => 'THB'], $tok);
    $pid = $p['data']['id'];
    [, $q] = $call('POST', '/projects', ['name' => 'Other', 'currency' => 'THB'], $tok);
    $qid = $q['data']['id'];

    [$s, $st] = $call('POST', "/projects/$pid/stakeholders",
        ['name' => 'Faculty', 'stakeholder_group' => 'project_supporter', 'group_code' => 'S3.1', 'estimated_count' => 1, 'count_unit' => 'คณะ'], $tok);
    T::eq(201, $s);
    T::eq('คณะ', $st['data']['count_unit']);
    $sid = $st['data']['id'];

    [$s, $c] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'Budget', 'amount' => 6090, 'year' => 0, 'stakeholder_id' => $sid], $tok);
    T::eq(201, $s);
    T::eq($sid, $c['data']['stakeholder_id']);

    // a stakeholder of ANOTHER project cannot be used as funder
    [, $ost] = $call('POST', "/projects/$qid/stakeholders", ['name' => 'Elsewhere'], $tok);
    [$s] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'Bad link', 'amount' => 1, 'year' => 0, 'stakeholder_id' => $ost['data']['id']], $tok);
    T::eq(422, $s, 'funder from another project rejected');

    // a cost can still be saved without a funder, and can be unlinked again
    [$s, $c2] = $call('POST', "/projects/$pid/costs", ['category' => 'opex', 'description' => 'No funder', 'amount' => 5, 'year' => 0], $tok);
    T::eq(201, $s);
    T::eq(null, $c2['data']['stakeholder_id']);
    [$s, $c3] = $call('PATCH', "/projects/$pid/costs/{$c['data']['id']}", ['stakeholder_id' => null], $tok);
    T::eq(200, $s);
    T::eq(null, $c3['data']['stakeholder_id']);
    [$s, $c4] = $call('PATCH', "/projects/$pid/costs/{$c['data']['id']}", ['stakeholder_id' => $sid], $tok);
    T::eq($sid, $c4['data']['stakeholder_id']);

    // deleting the stakeholder keeps the investment line (unlinked) — no figure is lost silently
    [$s] = $call('DELETE', "/projects/$pid/stakeholders/$sid", null, $tok);
    T::eq(204, $s);
    [, $list] = $call('GET', "/projects/$pid/costs", null, $tok);
    $kept = array_values(array_filter($list['data'], fn($x) => $x['description'] === 'Budget'));
    T::eq(1, count($kept));
    T::eq(null, $kept[0]['stakeholder_id']);

    // cost line items: amount is the sum of unit_price x quantity over the lines
    $lines = [['unit_price' => 100, 'quantity' => 10, 'unit' => 'แผ่น'], ['unit_price' => 200, 'quantity' => 10, 'unit' => 'ชิ้น']];
    [$s, $li] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'ค่าเอกสารและอุปกรณ์การเรียน', 'amount' => 3000, 'year' => 0, 'line_items' => $lines], $tok);
    T::eq(201, $s, 'cost with line items');
    T::eq(3000.0, (float)$li['data']['amount']);
    T::eq(2, count($li['data']['line_items']));
    T::eq(null, $li['data']['quantity'], 'multi-line leaves legacy columns empty');
    [$s] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'wrong total', 'amount' => 999, 'year' => 0, 'line_items' => $lines], $tok);
    T::eq(422, $s, 'amount must equal the sum of lines');
    [$s] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'bad line', 'amount' => 0, 'year' => 0, 'line_items' => [['unit_price' => 5, 'quantity' => 0, 'unit' => 'x']]], $tok);
    T::eq(422, $s, 'line quantity must be > 0');
    [$s, $one] = $call('POST', "/projects/$pid/costs",
        ['category' => 'opex', 'description' => 'one line', 'amount' => 500, 'year' => 0, 'line_items' => [['unit_price' => 500, 'quantity' => 1, 'unit' => 'คน']]], $tok);
    T::eq(201, $s);
    T::eq(1.0, (float)$one['data']['quantity'], 'single line mirrors legacy columns');
    // editing another field keeps the lines; an amount-only bulk edit with the same total keeps them too
    [$s, $ed] = $call('PATCH', "/projects/$pid/costs/{$li['data']['id']}", ['description' => 'renamed'], $tok);
    T::eq(200, $s);
    T::eq(2, count($ed['data']['line_items']));
    [$s, $ed2] = $call('PATCH', "/projects/$pid/costs/{$li['data']['id']}", ['amount' => 3000], $tok);
    T::eq(2, count($ed2['data']['line_items']));
    // one row with a second multiplier: 2,500 x 2 persons x 3 days = 15,000
    $two = [['unit_price' => 2500, 'quantity' => 2, 'unit' => 'คน', 'quantity2' => 3, 'unit2' => 'วัน']];
    [$s, $sp] = $call('POST', "/projects/$pid/costs",
        ['category' => 'administration', 'description' => 'ค่าตอบแทนวิทยากร', 'amount' => 15000, 'year' => 0, 'line_items' => $two], $tok);
    T::eq(201, $s);
    T::eq(15000.0, (float)$sp['data']['amount']);
    T::eq(3.0, (float)$sp['data']['line_items'][0]['quantity2']);
    T::eq(null, $sp['data']['quantity'], 'second multiplier leaves legacy columns empty');
    [$s] = $call('POST', "/projects/$pid/costs",
        ['category' => 'administration', 'description' => 'wrong', 'amount' => 5000, 'year' => 0, 'line_items' => $two], $tok);
    T::eq(422, $s, 'amount must equal price x qty x qty2');
    [$s] = $call('POST', "/projects/$pid/costs",
        ['category' => 'administration', 'description' => 'no unit2', 'amount' => 15000, 'year' => 0,
         'line_items' => [['unit_price' => 2500, 'quantity' => 2, 'unit' => 'คน', 'quantity2' => 3]]], $tok);
    T::eq(422, $s, 'second quantity needs a second unit');
});


T::test('Cost quantity, unit, and calculation modes', function () use ($call, $register) {
    [, $reg] = $register(['email' => 'costqty@x.org', 'name' => 'Cost Qty', 'password' => 'correct-horse-9']);
    $tok = $reg['token'];
    $oid = $reg['organizations'][0]['id'];
    [, $p] = $call('POST', '/projects', ['organization_id' => $oid, 'name' => 'Cost Qty Project', 'currency' => 'THB', 'analysis_period_years' => 3, 'evaluation_type' => 'forecast'], $tok);
    $pid = $p['data']['id'];

    // Case 1: 10 ถุง * 50 = 500
    [$s, $c1] = $call('POST', "/projects/$pid/costs", [
        'category' => 'opex', 'description' => 'ปุ๋ยอินทรีย์',
        'calculation_mode' => 'quantity', 'quantity' => 10, 'unit' => 'ถุง', 'unit_price' => 50, 'amount' => 500, 'year' => 0
    ], $tok);
    T::eq(201, $s, 'case 1 status 201');
    T::eq(500.0, $c1['data']['amount'], 'case 1 amount 500');
    T::eq(10.0, $c1['data']['quantity'], 'case 1 quantity 10');
    T::eq('ถุง', $c1['data']['unit'], 'case 1 unit ถุง');
    T::eq(50.0, $c1['data']['unit_price'], 'case 1 unit price 50');
    T::eq('quantity', $c1['data']['calculation_mode']);

    // Case 2: 2.5 กก. * 100 = 250
    [$s, $c2] = $call('POST', "/projects/$pid/costs", [
        'category' => 'delivery', 'description' => 'เมล็ดพันธุ์',
        'calculation_mode' => 'quantity', 'quantity' => 2.5, 'unit' => 'กก.', 'unit_price' => 100, 'amount' => 250, 'year' => 0
    ], $tok);
    T::eq(201, $s);
    T::eq(250.0, $c2['data']['amount']);
    T::eq(2.5, $c2['data']['quantity']);

    // Case 3: 100 ชิ้น * 12.50 = 1,250
    [$s, $c3] = $call('POST', "/projects/$pid/costs", [
        'category' => 'capex', 'description' => 'แก้วน้ำแจกผู้ร่วมงาน',
        'calculation_mode' => 'quantity', 'quantity' => 100, 'unit' => 'ชิ้น', 'unit_price' => 12.5, 'amount' => 1250, 'year' => 1
    ], $tok);
    T::eq(201, $s);
    T::eq(1250.0, $c3['data']['amount']);

    // Case 4: Manual 5,000 = 5,000
    [$s, $c4] = $call('POST', "/projects/$pid/costs", [
        'category' => 'administration', 'description' => 'ค่าธรรมเนียมจัดการ',
        'calculation_mode' => 'manual', 'amount' => 5000, 'year' => 0
    ], $tok);
    T::eq(201, $s);
    T::eq(5000.0, $c4['data']['amount']);
    T::eq('manual', $c4['data']['calculation_mode']);
    T::eq(null, $c4['data']['quantity']);
    T::eq(null, $c4['data']['unit']);
    T::eq(null, $c4['data']['unit_price']);

    // Case 5: Quantity = 0 -> rejected (422)
    [$s] = $call('POST', "/projects/$pid/costs", [
        'category' => 'opex', 'description' => 'Zero qty',
        'calculation_mode' => 'quantity', 'quantity' => 0, 'unit' => 'ชิ้น', 'unit_price' => 50, 'amount' => 0, 'year' => 0
    ], $tok);
    T::eq(422, $s, 'quantity = 0 rejected');

    // Quantity < 0 -> rejected (422)
    [$s] = $call('POST', "/projects/$pid/costs", [
        'category' => 'opex', 'description' => 'Neg qty',
        'calculation_mode' => 'quantity', 'quantity' => -2, 'unit' => 'ชิ้น', 'unit_price' => 50, 'amount' => -100, 'year' => 0
    ], $tok);
    T::eq(422, $s, 'quantity < 0 rejected');

    // Case 6: Unit empty -> rejected (422)
    [$s] = $call('POST', "/projects/$pid/costs", [
        'category' => 'opex', 'description' => 'Empty unit',
        'calculation_mode' => 'quantity', 'quantity' => 10, 'unit' => '  ', 'unit_price' => 50, 'amount' => 500, 'year' => 0
    ], $tok);
    T::eq(422, $s, 'unit empty rejected');

    // Case 7: Unit Price negative -> rejected (422)
    [$s] = $call('POST', "/projects/$pid/costs", [
        'category' => 'opex', 'description' => 'Neg price',
        'calculation_mode' => 'quantity', 'quantity' => 10, 'unit' => 'ชิ้น', 'unit_price' => -50, 'amount' => -500, 'year' => 0
    ], $tok);
    T::eq(422, $s, 'unit_price < 0 rejected');

    // Case 8: Edit existing item -> fields updated correctly
    $cid = $c1['data']['id'];
    [$s, $c1Up] = $call('PATCH', "/projects/$pid/costs/$cid", [
        'quantity' => 20, 'unit' => 'กระสอบ', 'unit_price' => 60, 'amount' => 1200
    ], $tok);
    T::eq(200, $s);
    T::eq(1200.0, $c1Up['data']['amount']);
    T::eq(20.0, $c1Up['data']['quantity']);
    T::eq('กระสอบ', $c1Up['data']['unit']);
    T::eq(60.0, $c1Up['data']['unit_price']);

    // Case 9: Switch mode
    // Switch quantity -> manual: quantity, unit, unit_price are cleared
    [$s, $c1Manual] = $call('PATCH', "/projects/$pid/costs/$cid", [
        'calculation_mode' => 'manual', 'amount' => 1500
    ], $tok);
    T::eq(200, $s);
    T::eq(1500.0, $c1Manual['data']['amount']);
    T::eq('manual', $c1Manual['data']['calculation_mode']);
    T::eq(null, $c1Manual['data']['quantity']);
    T::eq(null, $c1Manual['data']['unit']);
    T::eq(null, $c1Manual['data']['unit_price']);

    // Switch manual -> quantity
    [$s, $c1Qty] = $call('PATCH', "/projects/$pid/costs/$cid", [
        'calculation_mode' => 'quantity', 'quantity' => 5, 'unit' => 'ชุด', 'unit_price' => 300, 'amount' => 1500
    ], $tok);
    T::eq(200, $s);
    T::eq(1500.0, $c1Qty['data']['amount']);
    T::eq('quantity', $c1Qty['data']['calculation_mode']);
    T::eq(5.0, $c1Qty['data']['quantity']);
    T::eq('ชุด', $c1Qty['data']['unit']);
    T::eq(300.0, $c1Qty['data']['unit_price']);

    // Case 10: Legacy item (default manual without quantity) works as normal
    [$s, $legacy] = $call('POST', "/projects/$pid/costs", [
        'category' => 'other', 'description' => 'Legacy format', 'amount' => 800, 'year' => 0
    ], $tok);
    T::eq(201, $s);
    T::eq(800.0, $legacy['data']['amount']);
    T::eq('manual', $legacy['data']['calculation_mode']);

    // Case 11: Non-cash item calculates value accurately
    [$s, $nonCash] = $call('POST', "/projects/$pid/costs", [
        'category' => 'in_kind', 'description' => 'อาหารว่างสนับสนุน',
        'calculation_mode' => 'quantity', 'quantity' => 50, 'unit' => 'กล่อง', 'unit_price' => 35, 'amount' => 1750, 'year' => 0, 'is_cash' => false
    ], $tok);
    T::eq(201, $s);
    T::eq(1750.0, $nonCash['data']['amount']);
    T::eq(false, $nonCash['data']['is_cash']);
    T::eq('in_kind', $nonCash['data']['category']);
});

