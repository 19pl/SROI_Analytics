<?php
declare(strict_types=1);

use App\Core\App;
use App\Core\Kernel;
use App\Core\Migrator;
use App\Core\Request;
use Tests\T;

// Self-contained fixture (own in-memory database) so `php tests/run.php SheetApi` works on its own.
$shTmp = sys_get_temp_dir() . '/sroi-sheet-test-' . bin2hex(random_bytes(4));
mkdir($shTmp, 0775, true);
$shApp = new App([
    'db_path' => ':memory:', 'storage_path' => $shTmp, 'debug' => true, 'token_ttl_days' => 1, 'cors_origins' => ['http://localhost:3000'],
    'max_body_bytes' => 2097152, 'max_upload_bytes' => 1048576, 'public_report_base_url' => 'https://app.example/r', 'allow_non_uploaded_files' => true,
]);
Migrator::run($shApp->db, dirname(__DIR__) . '/database/migrations');
$shKernel = new Kernel($shApp);

/** @return array{0:int,1:mixed} */
$sh = function (string $method, string $path, ?array $body = null, ?string $token = null) use ($shKernel): array {
    $h = $token ? ['authorization' => "Bearer $token"] : [];
    $res = $shKernel->handle(new Request($method, '/api/v1' . $path, [], $h, $body === null ? null : json_encode($body), [], '127.0.0.1', null));
    return [$res->status, str_contains($res->headers['Content-Type'] ?? '', 'json') ? json_decode($res->body, true) : $res->body];
};
$shUser = function (string $email, string $role, int $orgId = 0) use ($shApp, $sh): array {
    $db = $shApp->db;
    $uid = $db->insert('users', ['email' => $email, 'name' => $email, 'password_hash' => password_hash('correct-horse-9', PASSWORD_DEFAULT)]);
    if ($orgId === 0) {
        $orgId = $db->insert('organizations', ['name' => "$email org", 'created_by' => $uid]);
    }
    $db->insert('memberships', ['organization_id' => $orgId, 'user_id' => $uid, 'role' => $role]);
    [, $j] = $sh('POST', '/auth/login', ['email' => $email, 'password' => 'correct-horse-9']);
    return [$j['token'], $orgId];
};

[$tok, $org] = $shUser('sheet-owner@x.org', 'owner');
[$viewer] = $shUser('sheet-viewer@x.org', 'viewer', $org);
[$outsider] = $shUser('sheet-outsider@x.org', 'owner');

$mk = function (array $extra = []) use ($sh, $tok, $org): int {
    [$s, $j] = $sh('POST', '/projects', $extra + ['name' => 'Hydro', 'currency' => 'THB', 'calc_method' => 'sheet', 'organization_id' => $org,
        'y0_label' => 'ปีงบประมาณ 66', 'y1_label' => 'ปีงบประมาณ 67'], $tok);
    T::eq(201, $s, 'project created: ' . json_encode($j));
    return (int)$j['data']['id'];
};

T::test('sheet api: a sheet project starts from the workbook template (S1..S4) and the starter never overwrites', function () use ($sh, $tok, $mk) {
    $p = $mk();
    [$s, $j] = $sh('POST', "/projects/$p/sheet/template", null, $tok);
    T::eq(200, $s);
    T::eq(['S1', 'S2', 'S3', 'S4'], array_column($j['data']['groups'], 'code'));
    T::eq('sheet', $sh('GET', "/projects/$p", null, $tok)[1]['data']['calc_method']);
    [$s] = $sh('POST', "/projects/$p/sheet/template", null, $tok);
    T::eq(409, $s, 'second call is refused');
    T::eq(null, $j['data']['result']['sroi'], 'an empty sheet has no ratio');
});

T::test('sheet api: enter the sheet like the workbook, formulas included, and read back the live result', function () use ($sh, $tok, $mk) {
    $p = $mk();
    $groups = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    [$s1, $s2] = [$groups[0]['id'], $groups[1]['id']];
    [$s, $sub] = $sh('POST', "/projects/$p/sheet/groups", ['parent_id' => $s1, 'code' => 'S1.1', 'name' => 'บริการกายภาพบำบัด', 'unit' => 'คน',
        'population_raw' => '', 'actual_count_raw' => '=542+485+4+385+281+29+42', 'actual_count_method' => 'จากทะเบียนผู้รับบริการ'], $tok);
    T::eq(201, $s, json_encode($sub));
    [$s] = $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $s2, 'resource' => 'ค่าเสื่อมอาคาร', 'y0_raw' => '=63999000/20', 'y1_raw' => '0', 'basis' => 'คิดค่าเสื่อม 20 ปี'], $tok);
    T::eq(201, $s);
    [$s, $o] = $sh('POST', "/projects/$p/sheet/outcomes", ['group_id' => $sub['data']['id'], 'dimension' => 'economic', 'beneficiary' => 'ผู้รับบริการ',
        'outcome' => 'ค่าบริการกายภาพบำบัด', 'y0_raw' => 660760, 'indicator' => 'จำนวนผู้รับบริการ'], $tok);
    T::eq(201, $s, json_encode($o));
    T::eq('660760', $o['data']['y0_raw'], 'numbers are stored as typed text');
    T::eq(null, $o['data']['adj_y0'], 'adjustment waits for input');

    [, $sheet] = $sh('GET', "/projects/$p/sheet", null, $tok);
    $r = $sheet['data']['result'];
    T::eq(3199950.0, $r['totals']['input']['total']);
    T::eq(660760.0, $r['totals']['outcome_gross']['total']);
    T::true(abs($r['sroi'] - 660760 / 3199950) < 1e-6);
    $by = array_column($r['groups'], null, 'id');
    T::eq(660760.0, $by[$s1]['outcome_gross']['total'], 'the parent S1 includes its sub-group');
    T::eq(1768.0, $by[$sub['data']['id']]['actual_count']);
    T::eq('ปีงบประมาณ 66', $sheet['data']['project']['y0_label']);
});

T::test('sheet api: entering an adjustment % changes the adjusted result only', function () use ($sh, $tok, $mk) {
    $p = $mk();
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[1]['id'], 'resource' => 'Cost', 'y0_raw' => '1000'], $tok);
    [, $o] = $sh('POST', "/projects/$p/sheet/outcomes", ['group_id' => $g[0]['id'], 'outcome' => 'Benefit', 'y0_raw' => '2000'], $tok);
    T::eq(2.0, $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data']['result']['sroi']);
    [$s, $u] = $sh('PATCH', "/projects/$p/sheet/outcomes/{$o['data']['id']}", ['adj_y0' => 0.25, 'adj_y0_reason' => 'deadweight survey'], $tok);
    T::eq(200, $s, json_encode($u));
    $r = $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data']['result'];
    T::eq(1.5, $r['sroi']);
    T::eq(2.0, $r['sroi_unadjusted']);
    [$s] = $sh('PATCH', "/projects/$p/sheet/outcomes/{$o['data']['id']}", ['adj_y0' => 1.5], $tok);
    T::eq(422, $s, 'a percentage above 100 % is refused');
    $sh('PATCH', "/projects/$p", ['sheet_adjustment_mode' => 'retain'], $tok);
    T::eq(0.5, $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data']['result']['sroi'], 'retain mode: 2000 x 25 % / 1000');
});

T::test('sheet api: custom columns — add a topic, fill it, optionally count it, remove it', function () use ($sh, $tok, $mk) {
    $p = $mk();
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    [, $in] = $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[1]['id'], 'resource' => 'Staff', 'y0_raw' => '1000'], $tok);
    [, $out] = $sh('POST', "/projects/$p/sheet/outcomes", ['group_id' => $g[0]['id'], 'outcome' => 'Benefit', 'y0_raw' => '500'], $tok);

    [$s, $col] = $sh('POST', "/projects/$p/sheet/columns", ['band' => 'input', 'label' => 'ค่าดำเนินการเพิ่มเติม', 'data_type' => 'number', 'counts_toward' => 'input'], $tok);
    T::eq(201, $s, json_encode($col));
    $key = $col['data']['key'];
    T::true(preg_match('/^c_[0-9a-f]{8}$/', $key) === 1, 'a key is generated when none is given');
    [$s, $note] = $sh('POST', "/projects/$p/sheet/columns", ['band' => 'outcome', 'label' => 'ระดับความมั่นใจ', 'data_type' => 'select', 'options' => ['สูง', 'กลาง', 'ต่ำ']], $tok);
    T::eq(201, $s);

    [$s, $u] = $sh('PATCH', "/projects/$p/sheet/inputs/{$in['data']['id']}", ['custom' => [$key => '=200/2']], $tok);
    T::eq(200, $s, json_encode($u));
    T::eq(['custom_check' => '=200/2'], ['custom_check' => $u['data']['custom'][$key]]);
    $r = $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data']['result'];
    T::eq(1100.0, $r['totals']['input']['total'], 'the counted custom column adds 100');

    [$s, $e] = $sh('PATCH', "/projects/$p/sheet/outcomes/{$out['data']['id']}", ['custom' => [$note['data']['key'] => 'สูงมาก']], $tok);
    T::eq(422, $s, 'a value outside the select choices is refused');
    [$s] = $sh('PATCH', "/projects/$p/sheet/outcomes/{$out['data']['id']}", ['custom' => [$note['data']['key'] => 'สูง']], $tok);
    T::eq(200, $s);
    [$s, $e] = $sh('PATCH', "/projects/$p/sheet/inputs/{$in['data']['id']}", ['custom' => ['nope' => 'x']], $tok);
    T::eq(422, $s, 'unknown column key refused');
    [$s] = $sh('PATCH', "/projects/$p/sheet/inputs/{$in['data']['id']}", ['custom' => [$key => '5/0']], $tok);
    T::eq(422, $s, 'bad formula in a custom cell refused on write');

    // rules for counting toward a total
    [$s] = $sh('POST', "/projects/$p/sheet/columns", ['band' => 'outcome', 'label' => 'x', 'data_type' => 'number', 'counts_toward' => 'input'], $tok);
    T::eq(422, $s, 'an outcome column cannot count toward the input total');
    [$s] = $sh('POST', "/projects/$p/sheet/columns", ['band' => 'input', 'label' => 'x', 'data_type' => 'text', 'counts_toward' => 'input'], $tok);
    T::eq(422, $s, 'a text column cannot count toward a total');
    [$s] = $sh('POST', "/projects/$p/sheet/columns", ['band' => 'input', 'label' => 'x', 'data_type' => 'select'], $tok);
    T::eq(422, $s, 'a select column needs choices');
    [$s] = $sh('PATCH', "/projects/$p/sheet/columns/{$col['data']['id']}", ['key' => 'other'], $tok);
    T::eq(422, $s, 'a column key is immutable');

    // delete the column: its values disappear from the rows and from the total
    [$s] = $sh('DELETE', "/projects/$p/sheet/columns/{$col['data']['id']}", null, $tok);
    T::eq(204, $s);
    $sheet = $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data'];
    T::eq(1000.0, $sheet['result']['totals']['input']['total']);
    T::eq([], (array)$sheet['inputs'][0]['custom']);
});

T::test('sheet api: bad formulas, wrong groups and depth are refused with field-level errors', function () use ($sh, $tok, $mk) {
    $p = $mk();
    $other = $mk();
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    $og = $sh('POST', "/projects/$other/sheet/template", null, $tok)[1]['data']['groups'];
    [$s, $e] = $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[0]['id'], 'resource' => 'x', 'y0_raw' => '1+'], $tok);
    T::eq(422, $s);
    T::true(isset($e['error']['details']['y0_raw']), 'error names the field');
    [$s] = $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $og[0]['id'], 'resource' => 'x', 'y0_raw' => '1'], $tok);
    T::eq(422, $s, 'a group from another project is refused');
    [, $sub] = $sh('POST', "/projects/$p/sheet/groups", ['parent_id' => $g[0]['id'], 'name' => 'S1.1'], $tok);
    [$s] = $sh('POST', "/projects/$p/sheet/groups", ['parent_id' => $sub['data']['id'], 'name' => 'too deep'], $tok);
    T::eq(422, $s, 'sub-groups only one level deep');
    [$s] = $sh('PATCH', "/projects/$p/sheet/groups/{$g[0]['id']}", ['parent_id' => $g[1]['id']], $tok);
    T::eq(422, $s, 'a group that has sub-groups must stay top-level');
});

T::test('sheet api: permissions — viewers read, cannot write; outsiders see 404; wizard projects are untouched', function () use ($sh, $tok, $viewer, $outsider, $mk) {
    $p = $mk();
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    T::eq(200, $sh('GET', "/projects/$p/sheet", null, $viewer)[0]);
    T::eq(403, $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[0]['id'], 'resource' => 'x', 'y0_raw' => '1'], $viewer)[0]);
    T::eq(403, $sh('POST', "/projects/$p/sheet/calculate", null, $viewer)[0]);
    T::eq(404, $sh('GET', "/projects/$p/sheet", null, $outsider)[0]);
    T::eq(401, $sh('GET', "/projects/$p/sheet")[0]);

    [, $w] = $sh('POST', '/projects', ['name' => 'Classic', 'currency' => 'THB'], $tok);
    T::eq('wizard', $w['data']['calc_method'], 'existing behaviour is the default');
    [$s, $e] = $sh('GET', "/projects/{$w['data']['id']}/sheet", null, $tok);
    T::eq(422, $s);
    T::eq('not_a_sheet_project', $e['error']['code']);
    T::eq(422, $sh('POST', "/projects/{$w['data']['id']}/sheet/groups", ['name' => 'x'], $tok)[0]);
});

T::test('sheet api: calculate saves a run (history + audit); a blocked sheet cannot be saved', function () use ($sh, $tok, $mk, $shApp) {
    $p = $mk();
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[1]['id'], 'resource' => 'Cost', 'y0_raw' => '1000'], $tok);
    $sh('POST', "/projects/$p/sheet/outcomes", ['group_id' => $g[0]['id'], 'outcome' => 'Benefit', 'y0_raw' => '250'], $tok);
    [$s, $j] = $sh('POST', "/projects/$p/sheet/calculate", null, $tok);
    T::eq(201, $s, json_encode($j));
    T::eq(0.25, $j['data']['run']['sroi_ratio']);
    T::eq('sheet-1.0.0', $j['data']['run']['methodology_version']);
    $runs = $sh('GET', "/projects/$p/runs", null, $tok)[1]['data'];
    T::eq(1, count($runs), 'shows up in the existing run history');
    $n = (int)$shApp->db->val("SELECT COUNT(*) FROM audit_events WHERE project_id = ? AND entity_type IN ('sheet_input','sheet_outcome','calculation_run')", [$p]);
    T::true($n >= 3, 'writes are audited');

    // corrupt a cell directly in the database (the API would have refused it) — the engine must still block, not guess
    $shApp->db->run("UPDATE sheet_inputs SET y0_raw = '1/0' WHERE project_id = ?", [$p]);
    [$s, $e] = $sh('POST', "/projects/$p/sheet/calculate", null, $tok);
    T::eq(422, $s);
    T::eq('calculation_inputs_invalid', $e['error']['code']);
    T::eq(null, $sh('GET', "/projects/$p/sheet", null, $tok)[1]['data']['result']['sroi']);
    T::eq(1, count($sh('GET', "/projects/$p/runs", null, $tok)[1]['data']), 'no run saved for a blocked sheet');
});

T::test('sheet api: a sheet plan owned by a faculty shows its saved result in the faculty report and the project list', function () use ($sh, $tok, $org, $mk) {
    [, $fac] = $sh('POST', "/organizations/$org/faculties", ['name' => 'Allied Health'], $tok);
    $p = $mk(['faculty_id' => $fac['data']['id']]);
    $g = $sh('POST', "/projects/$p/sheet/template", null, $tok)[1]['data']['groups'];
    $sh('POST', "/projects/$p/sheet/inputs", ['group_id' => $g[1]['id'], 'resource' => 'Cost', 'y0_raw' => '2000'], $tok);
    $sh('POST', "/projects/$p/sheet/outcomes", ['group_id' => $g[0]['id'], 'outcome' => 'Benefit', 'y0_raw' => '500'], $tok);
    $sh('POST', "/projects/$p/sheet/calculate", null, $tok);
    [$s, $rep] = $sh('GET', "/faculties/{$fac['data']['id']}/report", null, $tok);
    T::eq(200, $s);
    $plan = array_values(array_filter($rep['data']['plans'], fn($x) => (int)$x['id'] === $p))[0];
    T::eq(0.25, $plan['latest_run']['sroi_ratio']);
    T::eq(2000.0, (float)$plan['latest_run']['investment']);
    $list = array_values(array_filter($sh('GET', '/projects', null, $tok)[1]['data'], fn($x) => (int)$x['id'] === $p))[0];
    T::eq(0.25, $list['latest_run']['sroi_ratio']);
    T::eq('sheet', $list['calc_method']);
});
