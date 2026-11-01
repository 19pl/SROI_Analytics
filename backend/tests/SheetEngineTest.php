<?php
declare(strict_types=1);

use App\Domain\Calculation\Formula;
use App\Domain\Calculation\FormulaException;
use App\Domain\Calculation\SheetEngine;
use Tests\T;

// ---- Formula: the small arithmetic the customer's cells use -------------------------------------------------------

T::test('formula: plain numbers, formulas copied from the workbooks, percent, thousands commas', function () {
    T::eq(660760.0, Formula::evaluate(660760));
    T::eq(660760.0, Formula::evaluate('660760'));
    T::eq(3199950.0, Formula::evaluate('=63999000/20'));
    T::eq(1768.0, Formula::evaluate('=542+485+4+385+281+29+42'));
    // exact formulas from the Hydrotherapy workbook
    T::eq(1426383.0, Formula::evaluate('=1300000/20+(400000/20)+(270000/20)+49000+9840+(480000/20)+(60000/10)+(97000/10)+(86600/5)+(200000/10)+(37000/10)+(63840/5)+(16300/5)+(8500/10)+315095+125400+45847+478800+24000+74597+84043+23663'));
    T::eq(1602887.0, Formula::evaluate('=125400+45847+(5450000/10)+(620000/10)+824640'));
    T::eq(100481.4, Formula::evaluate('=(904840+123500+88120)*9%'));
    T::eq(27500.0, Formula::evaluate('27,500'));
    T::eq(1234567.5, Formula::evaluate('1,234,567.5'));
    T::eq(0.09, Formula::evaluate('9%'));
    T::eq(-5.0, Formula::evaluate('-(2+3)'));
    T::eq(8.0, Formula::evaluate('2^3'));
    T::eq(12.0, Formula::evaluate('3 × 4'));
    T::eq(6.0, Formula::evaluate('12 ÷ 2'));
    T::eq(2.0 + 3 * 4, Formula::evaluate('2+3*4'), 'operator precedence');
});

T::test('formula: blank is "not entered" (null), never 0', function () {
    T::eq(null, Formula::evaluate(null));
    T::eq(null, Formula::evaluate(''));
    T::eq(null, Formula::evaluate('   '));
    T::eq(null, Formula::evaluate('='));
    T::eq(0.0, Formula::evaluate('0'), 'a typed zero is a real zero');
});

T::test('formula: bad input is rejected and nothing is evaluated as code', function () {
    foreach (['1/0', '2+', '(1+2', '1+2)', 'abc', 'system("ls")', '1;2', '$a', '5 5', '1,2', '=1+', str_repeat('1+', 400) . '1'] as $bad) {
        T::throws(FormulaException::class, fn() => Formula::evaluate($bad), "must reject: $bad");
    }
    T::true(is_string(Formula::check('1/0')), 'check() returns the message');
    T::eq(null, Formula::check('=(1+2)*3'));
});

// ---- SheetEngine ----------------------------------------------------------------------------------------------------

/** Minimal sheet: S1 with sub-group S1.1, S2 ; $over overrides pieces. */
function sheetFixture(array $over = []): array
{
    return array_replace_recursive([
        'project' => ['currency' => 'THB', 'adjustment_mode' => 'deduct'],
        'columns' => [],
        'groups' => [
            ['id' => 1, 'parent_id' => null, 'code' => 'S1', 'name' => 'Beneficiaries', 'custom' => []],
            ['id' => 2, 'parent_id' => 1, 'code' => 'S1.1', 'name' => 'Service A', 'custom' => []],
            ['id' => 3, 'parent_id' => null, 'code' => 'S2', 'name' => 'Operator', 'custom' => []],
        ],
        'inputs' => [
            ['id' => 1, 'group_id' => 3, 'resource' => 'Staff', 'y0_raw' => '1000', 'y1_raw' => '500', 'custom' => []],
        ],
        'outcomes' => [
            ['id' => 1, 'group_id' => 2, 'outcome' => 'Revenue', 'y0_raw' => '600', 'y1_raw' => null, 'adj_y0' => null, 'adj_y1' => null, 'custom' => []],
            ['id' => 2, 'group_id' => 1, 'outcome' => 'Savings', 'y0_raw' => '=100*3', 'y1_raw' => '150', 'adj_y0' => null, 'adj_y1' => null, 'custom' => []],
        ],
    ], $over);
}

T::test('sheet: SROI = total outcome (Y0+Y1) / total input (Y0+Y1), no discounting', function () {
    $r = (new SheetEngine())->calculate(sheetFixture());
    T::eq(false, $r['blocked']);
    T::eq(1500.0, $r['totals']['input']['total']);
    T::eq(1050.0, $r['totals']['outcome_gross']['total']);   // 600 + 300 + 150
    T::eq(0.7, $r['sroi']);
    T::eq(0.7, $r['sroi_unadjusted']);
    T::eq(-450.0, $r['net_value']);
});

T::test('sheet: sub-group totals roll up to the parent and the grand total never double-counts', function () {
    $r = (new SheetEngine())->calculate(sheetFixture());
    $by = array_column($r['groups'], null, 'id');
    T::eq(600.0, $by[2]['outcome_gross']['total'], 'S1.1 own lines');
    T::eq(1050.0, $by[1]['outcome_gross']['total'], 'S1 = its own line (450) + sub-group S1.1 (600)');
    T::eq(1500.0, $by[3]['input']['total']);
    T::eq(1050.0, $r['totals']['outcome_gross']['total'], 'grand total = sum of lines, not of groups');
});

T::test('sheet: empty adjustment % = not assessed (value unchanged and flagged), never 0 %', function () {
    $r = (new SheetEngine())->calculate(sheetFixture());
    T::eq(1050.0, $r['totals']['outcome_adjusted']['total']);
    $codes = array_column($r['warnings'], 'code');
    T::true(in_array('ADJUSTMENT_NOT_ASSESSED', $codes, true));
    T::eq(null, $r['outcomes'][0]['adj_y0']);
});

T::test('sheet: adjustment % applied once entered — deduct vs retain mode', function () {
    $s = sheetFixture();
    $s['outcomes'][0]['adj_y0'] = 0.25;                       // 600 -> 450 (deduct) / 150 (retain)
    $deduct = (new SheetEngine())->calculate($s);
    T::eq(900.0, $deduct['totals']['outcome_adjusted']['total']);  // 450 + 300 + 150
    T::eq(1050.0, $deduct['totals']['outcome_gross']['total'], 'gross is untouched');
    T::eq(0.6, $deduct['sroi']);
    T::eq(0.7, $deduct['sroi_unadjusted']);
    $s['project']['adjustment_mode'] = 'retain';
    $retain = (new SheetEngine())->calculate($s);
    T::eq(600.0, $retain['totals']['outcome_adjusted']['total']);  // 150 + 300 + 150
    T::eq(0.4, $retain['sroi']);
});

T::test('sheet: blank cells are reported, not silently zero; a bad formula blocks the calculation', function () {
    $s = sheetFixture();
    $s['outcomes'][] = ['id' => 3, 'group_id' => 1, 'outcome' => 'Not yet valued', 'y0_raw' => null, 'y1_raw' => '', 'adj_y0' => null, 'adj_y1' => null, 'custom' => []];
    $r = (new SheetEngine())->calculate($s);
    $codes = array_column($r['warnings'], 'code');
    T::true(in_array('VALUE_NOT_ENTERED', $codes, true));
    T::eq(1050.0, $r['totals']['outcome_gross']['total']);

    $s['inputs'][0]['y0_raw'] = '1000/0';
    $b = (new SheetEngine())->calculate($s);
    T::eq(true, $b['blocked']);
    T::eq(null, $b['sroi']);
    T::eq('invalid_formula', $b['errors'][0]['code']);
    T::eq('inputs.1.y0_raw', $b['errors'][0]['path']);
});

T::test('sheet: zero input gives no ratio (not a divide-by-zero) but still reports totals', function () {
    $s = sheetFixture();
    $s['inputs'] = [];
    $r = (new SheetEngine())->calculate($s);
    T::eq(null, $r['sroi']);
    T::eq(1050.0, $r['totals']['outcome_gross']['total']);
    T::true(in_array('ZERO_INPUT', array_column($r['warnings'], 'code'), true));
});

T::test('sheet: excluded lines do not count', function () {
    $s = sheetFixture();
    $s['outcomes'][1]['include_in_total'] = false;
    $r = (new SheetEngine())->calculate($s);
    T::eq(600.0, $r['totals']['outcome_gross']['total']);
});

T::test('sheet: custom number columns can count toward input or outcome; notes and text never do', function () {
    $s = sheetFixture([
        'columns' => [
            ['id' => 1, 'band' => 'input', 'key' => 'overhead', 'label' => 'Overhead', 'data_type' => 'number', 'counts_toward' => 'input', 'count_in' => 'y0'],
            ['id' => 2, 'band' => 'input', 'key' => 'memo', 'label' => 'Memo', 'data_type' => 'number', 'counts_toward' => 'none', 'count_in' => 'y0'],
            ['id' => 3, 'band' => 'outcome', 'key' => 'bonus', 'label' => 'Bonus', 'data_type' => 'number', 'counts_toward' => 'outcome', 'count_in' => 'y1'],
            ['id' => 4, 'band' => 'outcome', 'key' => 'tag', 'label' => 'Tag', 'data_type' => 'text', 'counts_toward' => 'none', 'count_in' => 'y0'],
        ],
    ]);
    $s['inputs'][0]['custom'] = ['overhead' => '=200/2', 'memo' => '999999'];
    $s['outcomes'][0]['custom'] = ['bonus' => '50', 'tag' => '12345'];
    $r = (new SheetEngine())->calculate($s);
    T::eq(1600.0, $r['totals']['input']['total'], '1000 + 500 + 100 (counted custom); the memo column is ignored');
    T::eq(1100.0, $r['totals']['outcome_gross']['total'], '1050 + 50 (counted custom in Y1)');
    T::eq(50.0, $r['totals']['outcome_gross']['y1'] - 150.0, 'custom lands in Y1');

    $s['inputs'][0]['custom']['overhead'] = '1/0';
    $b = (new SheetEngine())->calculate($s);
    T::eq('inputs.1.custom.overhead', $b['errors'][0]['path'], 'a bad custom formula blocks too');
});

// ---- Golden test: the Hydrotherapy workbook ("Template 6 เดือน") ------------------------------------------------------

/** Rebuilds the workbook's S1..S4 totals from its exact cell contents. */
function hydroFixture(bool $reproduceExcelOmissions): array
{
    $groups = [
        ['id' => 1, 'parent_id' => null, 'code' => 'S1', 'name' => 'ผู้รับประโยชน์หลัก', 'custom' => []],
        ['id' => 2, 'parent_id' => null, 'code' => 'S2', 'name' => 'ผู้ดำเนินโครงการหลัก', 'custom' => []],
        ['id' => 3, 'parent_id' => null, 'code' => 'S3', 'name' => 'ผู้สนับสนุน', 'custom' => []],
        ['id' => 4, 'parent_id' => null, 'code' => 'S4', 'name' => 'หน่วยงานเกี่ยวข้อง', 'custom' => []],
    ];
    $inputs = [
        ['id' => 1, 'group_id' => 2, 'resource' => 'คณะสหเวชศาสตร์ (J46)', 'y0_raw' => '=1300000/20+(400000/20)+(270000/20)+49000+9840+(480000/20)+(60000/10)+(97000/10)+(86600/5)+(200000/10)+(37000/10)+(63840/5)+(16300/5)+(8500/10)+315095+125400+45847+478800+24000+74597+84043+23663', 'y1_raw' => '0', 'custom' => []],
        ['id' => 2, 'group_id' => 3, 'resource' => 'จังหวัดพิษณุโลก (J59)', 'y0_raw' => '=63999000/20', 'y1_raw' => '0', 'custom' => []],
        ['id' => 3, 'group_id' => 3, 'resource' => 'ม.นเรศวร (J63)', 'y0_raw' => '=125400+45847+(5450000/10)+(620000/10)+824640', 'y1_raw' => '0', 'custom' => []],
    ];
    $o = fn(int $id, int $g, string $name, $y0, bool $incl = true) => ['id' => $id, 'group_id' => $g, 'outcome' => $name,
        'y0_raw' => (string)$y0, 'y1_raw' => null, 'adj_y0' => null, 'adj_y1' => null, 'include_in_total' => $incl, 'custom' => []];
    $outcomes = [
        $o(1, 1, 'S10 รายรับกายภาพบำบัด', 660760),
        $o(2, 1, 'S18 ค่าใช้จ่ายฝึกงานนิสิต', 80800),
        $o(3, 1, 'S38 รายรับฟิตเนส', 113660),
        // The workbook's own subtotal formulas skip these two lines (S57 omits S48, S70 omits S68):
        $o(4, 2, 'S48 ลดค่าไฟจากโซล่าเซล', 85775, !$reproduceExcelOmissions),
        $o(5, 2, 'S55 ลดก๊าซเรือนกระจก', 384),
        ['id' => 6, 'group_id' => 3, 'outcome' => 'S63 รายรับจากการให้บริการ (9%)', 'y0_raw' => '=(904840+123500+88120)*9%', 'y1_raw' => null,
            'adj_y0' => null, 'adj_y1' => null, 'include_in_total' => true, 'custom' => []],
        $o(7, 3, 'S68 บำบัดน้ำเสีย', 1046.52, !$reproduceExcelOmissions),
    ];
    return ['project' => ['currency' => 'THB', 'adjustment_mode' => 'deduct'], 'columns' => [], 'groups' => $groups, 'inputs' => $inputs, 'outcomes' => $outcomes];
}

T::test('golden (Hydrotherapy workbook): reproduces the Excel exactly when its two omitted lines are left out', function () {
    $r = (new SheetEngine())->calculate(hydroFixture(true));
    T::eq(6229220.0, $r['totals']['input']['total'], 'L92 = 6,229,220');
    T::eq(956085.4, $r['totals']['outcome_gross']['total'], 'U92 = 956,085.4');
    // the workbook cell O94 = U92/L92 = 0.1534839674951278
    T::true(abs($r['sroi'] - 0.1534839674951278) < 1e-6, 'SROI matches Excel O94: got ' . json_encode($r['sroi']));
});

T::test('golden (Hydrotherapy workbook): summing every line gives the corrected total (Excel S57/S70 skip 85,775 and 1,046.52)', function () {
    $r = (new SheetEngine())->calculate(hydroFixture(false));
    T::eq(1042906.92, $r['totals']['outcome_gross']['total'], '956,085.40 + 85,775 + 1,046.52');
    T::true(abs($r['sroi'] - 1042906.92 / 6229220.0) < 1e-6, 'corrected SROI: got ' . json_encode($r['sroi']));
    T::true(abs($r['sroi'] - 0.1674213) < 1e-6, 'about 0.1674');
    $by = array_column($r['groups'], null, 'id');
    T::eq(855220.0, $by[1]['outcome_gross']['total'], 'S1 = Excel S44');
    T::eq(1426383.0, $by[2]['input']['total'], 'S2 = Excel J46');
    T::eq(4802837.0, $by[3]['input']['total'], 'S3 = J59 + J63');
});
