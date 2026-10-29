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

    [$s, $o] = $call('POST', "/projects/$pid/outcomes", ['stakeholder_id' => $sid, 'name' => 'Reduced tutoring costs', 'quantity' => 40, 'proxy_value' => 2000,
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
    $call('PATCH', "/projects/$pid/outcomes/$oid", ['quantity' => 50, 'change_reason' => 'new survey'], $tok);
    [, $run2] = $call('POST', "/projects/$pid/calculate", [], $tok);
    [$s, $cmp] = $call('GET', "/projects/$pid/run-comparison", null, $tok, ['a' => (string)$run1, 'b' => (string)$run2['data']['run']['id']]);
    T::eq(200, $s);
    T::true($cmp['data']['delta']['present_value'] > 0);
    T::true(count(array_filter($cmp['data']['changed_inputs'], fn($c) => str_ends_with($c['path'], 'quantity'))) === 1);

    // audit trail captured old/new and reason
    [, $aud] = $call('GET', "/projects/$pid/audit", null, $tok, ['entity_type' => 'outcome']);
    $upd = array_values(array_filter($aud['data'], fn($e) => $e['action'] === 'update'))[0];
    T::eq(40.0, $upd['old_values']['quantity']);
    T::eq(50.0, $upd['new_values']['quantity']);
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
