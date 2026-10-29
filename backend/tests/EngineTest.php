<?php
declare(strict_types=1);

use App\Domain\Calculation\CalculationEngine;
use App\Domain\Calculation\InvalidSnapshotException;
use Tests\T;

/** Builds a minimal valid snapshot; $o overrides the single outcome, $p the project. */
function snap(array $o = [], array $p = [], array $costs = null, array $scenario = []): array
{
    return [
        'project' => $p + ['currency' => 'THB', 'analysis_period_years' => 5, 'discount_rate' => 0.03,
            'discount_base_year' => 0, 'investment_basis' => 'nominal', 'include_in_kind' => true],
        'costs' => $costs ?? [['id' => 1, 'category' => 'opex', 'description' => 'Delivery', 'amount' => 100000, 'currency' => 'THB', 'year' => 0]],
        'stakeholders' => [['id' => 1, 'name' => 'Families'], ['id' => 2, 'name' => 'Students']],
        'outcomes' => [$o + ['id' => 10, 'name' => 'Reduced tutoring costs', 'stakeholder_id' => 1, 'quantity' => 40, 'proxy_value' => 2000,
            'start_year' => 1, 'duration_years' => 1, 'evidence_quality' => 'measured', 'proxy_source' => 'survey',
            'adjustment' => ['deadweight' => 0.15, 'attribution' => 0.20, 'displacement' => 0.0, 'drop_off' => 0.0, 'justification' => 'x', 'source' => 'y']]],
        'scenario' => $scenario + ['id' => 1, 'name' => 'Base case', 'kind' => 'base', 'assumptions' => []],
    ];
}

$engine = new CalculationEngine();

T::test('spec example: 40 x 2000, 15%/20%/0% adjustments = 54,400; PV at 3% = 52,815.53', function () use ($engine) {
    $r = $engine->calculate(snap());
    $y = $r['outcomes'][0]['years'][0];
    T::eq(80000.0, $y['gross_value']);
    T::eq(54400.0, $y['adjusted_impact']);
    T::eq(52815.53, $y['present_value']);
    T::eq(52815.53, $r['summary']['present_value_of_impact']);
});

T::test('spec example: PV 350,000 / investment 100,000 = 3.5:1, NSV 250,000, net return 250%', function () use ($engine) {
    // quantity chosen so adjusted PV is exactly 350,000 with no discounting and no deductions
    $r = $engine->calculate(snap(['quantity' => 350, 'proxy_value' => 1000, 'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0]], ['discount_rate' => 0.0]));
    T::eq(350000.0, $r['summary']['present_value_of_impact']);
    T::eq(3.5, $r['summary']['sroi_ratio']);
    T::eq(250000.0, $r['summary']['net_social_value']);
    T::eq(250.0, $r['summary']['net_return_pct']);
});

T::test('adjustments are multiplicative, not additive', function () use ($engine) {
    $r = $engine->calculate(snap(['adjustment' => ['deadweight' => 0.5, 'attribution' => 0.5, 'displacement' => 0.5]], ['discount_rate' => 0.0]));
    T::eq(10000.0, $r['outcomes'][0]['years'][0]['adjusted_impact']); // 80000 x .125, not 80000 x (1-1.5)
});

T::test('cohort drop-off is recursive and applied once', function () use ($engine) {
    $r = $engine->calculate(snap(['duration_years' => 3, 'quantity' => 10, 'proxy_value' => 1000,
        'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.1]], ['discount_rate' => 0.0]));
    $a = array_column($r['outcomes'][0]['years'], 'adjusted_impact');
    T::eq([10000.0, 9000.0, 8100.0], $a);
});

T::test('per-year drop-off override replaces the default for that year only', function () use ($engine) {
    $r = $engine->calculate(snap(['duration_years' => 3, 'quantity' => 10, 'proxy_value' => 1000,
        'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.1],
        'year_overrides' => [['year' => 2, 'drop_off' => 0.5]]], ['discount_rate' => 0.0]));
    T::eq([10000.0, 5000.0, 4500.0], array_column($r['outcomes'][0]['years'], 'adjusted_impact'));
});

T::test('independent model does not apply drop-off (no double adjustment) and warns', function () use ($engine) {
    $r = $engine->calculate(snap(['projection_model' => 'independent', 'duration_years' => 3, 'quantity' => 10, 'proxy_value' => 1000,
        'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.1],
        'year_overrides' => [['year' => 2, 'quantity' => 8], ['year' => 3, 'quantity' => 6]]], ['discount_rate' => 0.0]));
    T::eq([10000.0, 8000.0, 6000.0], array_column($r['outcomes'][0]['years'], 'adjusted_impact'));
    T::true(in_array('DROPOFF_IGNORED', array_column($r['warnings'], 'code'), true));
});

T::test('recurring cohorts: each cohort decays by its own age', function () use ($engine) {
    // new cohort of 10 every year for 3 years, each lasting 2 years with 50% drop-off in its 2nd year
    $r = $engine->calculate(snap(['projection_model' => 'recurring_cohorts', 'entry_years' => 3, 'duration_years' => 2,
        'quantity' => 10, 'proxy_value' => 100, 'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.5]],
        ['discount_rate' => 0.0, 'analysis_period_years' => 6]));
    // y1: 10 ; y2: 10 + 5 ; y3: 10 + 5 ; y4: 5
    T::eq([1000.0, 1500.0, 1500.0, 500.0], array_column($r['outcomes'][0]['years'], 'adjusted_impact'));
});

T::test('cohort rejects a per-year quantity override', function () use ($engine) {
    T::throws(InvalidSnapshotException::class, fn() => $engine->calculate(snap(['year_overrides' => [['year' => 2, 'quantity' => 5]]])));
});

T::test('negative outcomes subtract and are reported separately', function () use ($engine) {
    $s = snap(['adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0]], ['discount_rate' => 0.0]);
    $s['outcomes'][] = ['id' => 11, 'name' => 'Noise harm', 'stakeholder_id' => 2, 'quantity' => 10, 'proxy_value' => 1000, 'polarity' => 'negative',
        'start_year' => 1, 'duration_years' => 1, 'evidence_quality' => 'estimated', 'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0]];
    $r = $engine->calculate($s);
    T::eq(80000.0, $r['summary']['positive_present_value']);
    T::eq(-10000.0, $r['summary']['negative_present_value']);
    T::eq(70000.0, $r['summary']['present_value_of_impact']);
    $st = array_column($r['by_stakeholder'], null, 'stakeholder_id');
    T::eq(-10000.0, $st[2]['negative_present_value']);
});

T::test('zero investment: ratio is null (not a divide-by-zero), net value still reported', function () use ($engine) {
    $r = $engine->calculate(snap([], [], []));
    T::eq(null, $r['summary']['sroi_ratio']);
    T::eq(52815.53, $r['summary']['net_social_value']);
    T::true(in_array('ZERO_INVESTMENT', array_column($r['warnings'], 'code'), true));
});

T::test('investment basis: present_value discounts later-year costs, nominal does not', function () use ($engine) {
    $costs = [['id' => 1, 'category' => 'opex', 'description' => 'a', 'amount' => 1000, 'currency' => 'THB', 'year' => 0],
              ['id' => 2, 'category' => 'opex', 'description' => 'b', 'amount' => 1030, 'currency' => 'THB', 'year' => 1]];
    $nom = $engine->calculate(snap([], ['investment_basis' => 'nominal'], $costs));
    $pv = $engine->calculate(snap([], ['investment_basis' => 'present_value'], $costs));
    T::eq(2030.0, $nom['summary']['investment_used']);
    T::eq(2000.0, $pv['summary']['investment_used']);
    T::eq($nom['summary']['total_investment_present_value'], $pv['summary']['investment_used']);
});

T::test('in-kind resources can be excluded by project setting', function () use ($engine) {
    $costs = [['id' => 1, 'category' => 'opex', 'description' => 'cash', 'amount' => 1000, 'currency' => 'THB', 'year' => 0],
              ['id' => 2, 'category' => 'in_kind', 'description' => 'volunteers', 'amount' => 500, 'currency' => 'THB', 'year' => 0, 'is_cash' => false]];
    T::eq(1500.0, $engine->calculate(snap([], ['include_in_kind' => true], $costs))['summary']['investment_used']);
    T::eq(1000.0, $engine->calculate(snap([], ['include_in_kind' => false], $costs))['summary']['investment_used']);
});

T::test('horizon: outcome beyond analysis period is truncated with a warning', function () use ($engine) {
    $r = $engine->calculate(snap(['duration_years' => 10], ['analysis_period_years' => 3]));
    T::eq(3, count($r['outcomes'][0]['years']));
    T::true(in_array('HORIZON_TRUNCATED', array_column($r['warnings'], 'code'), true));
});

T::test('discount base year shifts the exponent; year before base is not compounded forward', function () use ($engine) {
    $r = $engine->calculate(snap(['quantity' => 1, 'proxy_value' => 1000, 'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0]], ['discount_base_year' => 1, 'discount_rate' => 0.10]));
    T::eq(1000.0, $r['outcomes'][0]['years'][0]['present_value']);
});

T::test('invalid inputs are rejected with explicit codes', function () use ($engine) {
    $codes = fn(array $s) => array_column($engine->validate($s), 'code');
    T::true(in_array('invalid_percentage', $codes(snap(['adjustment' => ['deadweight' => 1.5]])), true), 'deadweight 150%');
    T::true(in_array('invalid_percentage', $codes(snap(['adjustment' => ['attribution' => -0.1]])), true), 'attribution -10%');
    T::true(in_array('invalid_quantity', $codes(snap(['quantity' => -1])), true), 'negative quantity');
    T::true(in_array('discount_rate_required', $codes(snap([], ['discount_rate' => null])), true), 'no silent default discount rate');
    T::true(in_array('investment_basis_required', $codes(snap([], ['investment_basis' => null])), true));
    T::true(in_array('analysis_period_required', $codes(snap([], ['analysis_period_years' => null])), true));
    T::true(in_array('outcome_start_outside_period', $codes(snap(['start_year' => 9])), true), 'start after period');
    T::true(in_array('cost_year_outside_period', $codes(snap([], [], [['id' => 1, 'category' => 'opex', 'description' => 'x', 'amount' => 1, 'currency' => 'THB', 'year' => 9]])), true));
    T::true(in_array('invalid_cost_amount', $codes(snap([], [], [['id' => 1, 'category' => 'opex', 'description' => 'x', 'amount' => -5, 'currency' => 'THB', 'year' => 0]])), true), 'negative cost');
    T::true(in_array('outcome_stakeholder_missing', $codes(snap(['stakeholder_id' => 99])), true));
    T::true(in_array('invalid_evidence_quality', $codes(snap(['evidence_quality' => 'vibes'])), true));
    T::eq([], $codes(snap()), 'valid snapshot has no errors');
});

T::test('discount rate of exactly 0 is a valid explicit choice', function () use ($engine) {
    T::eq([], $engine->validate(snap([], ['discount_rate' => 0.0])));
});

T::test('scenario: global multipliers/deltas and per-outcome absolute overrides', function () use ($engine) {
    $base = $engine->calculate(snap([], ['discount_rate' => 0.0]));
    $cons = $engine->calculate(snap([], ['discount_rate' => 0.0], null, ['kind' => 'conservative', 'name' => 'C', 'assumptions' => ['global' => ['quantity_multiplier' => 0.5, 'deadweight_delta' => 0.05]]]));
    T::eq(54400.0, $base['summary']['present_value_of_impact']);
    T::eq(round(20 * 2000 * 0.80 * 0.80, 2), $cons['summary']['present_value_of_impact']); // 40*.5, deadweight .15+.05
    $ovr = $engine->calculate(snap([], ['discount_rate' => 0.0], null, ['assumptions' => ['outcomes' => [10 => ['quantity' => 10, 'deadweight' => 0.0]]]]));
    T::eq(round(10 * 2000 * 1.0 * 0.8, 2), $ovr['summary']['present_value_of_impact']);
});

T::test('unconfigured conservative scenario is flagged as identical to base', function () use ($engine) {
    $r = $engine->calculate(snap([], [], null, ['kind' => 'conservative', 'name' => 'Conservative', 'assumptions' => []]));
    T::true(in_array('SCENARIO_NOT_CONFIGURED', array_column($r['warnings'], 'code'), true));
});

T::test('warnings: unassessed adjustments, assumed evidence, missing proxy source, overlap groups, unmonetised outcomes', function () use ($engine) {
    $s = snap(['adjustment' => null, 'evidence_quality' => 'assumed', 'proxy_source' => '', 'overlap_group' => 'savings']);
    $s['outcomes'][] = ['id' => 11, 'name' => 'Transfer', 'stakeholder_id' => 2, 'quantity' => 1, 'proxy_value' => 5, 'start_year' => 1, 'duration_years' => 1,
        'evidence_quality' => 'measured', 'proxy_source' => 's', 'overlap_group' => 'savings', 'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'justification' => 'j']];
    $s['outcomes'][] = ['id' => 12, 'name' => 'Wellbeing', 'stakeholder_id' => 2, 'quantity' => 1, 'proxy_value' => null, 'start_year' => 1, 'duration_years' => 1, 'evidence_quality' => 'measured'];
    $r = $engine->calculate($s);
    $codes = array_column($r['warnings'], 'code');
    foreach (['ADJUSTMENT_NOT_ASSESSED', 'EVIDENCE_ASSUMED', 'PROXY_NO_SOURCE', 'POSSIBLE_DOUBLE_COUNT', 'UNMONETIZED_OUTCOME'] as $c) {
        T::true(in_array($c, $codes, true), "missing warning $c");
    }
    T::eq(1, count($r['unmonetized_outcomes']));
});

T::test('determinism: same snapshot, identical result', function () use ($engine) {
    T::eq(json_encode($engine->calculate(snap())), json_encode($engine->calculate(snap())));
});

T::test('annual series: cumulative totals reconcile with summary', function () use ($engine) {
    $r = $engine->calculate(snap(['duration_years' => 4]));
    $last = end($r['annual']);
    T::eq($r['summary']['present_value_of_impact'], $last['cumulative_present_value']);
    T::eq($r['summary']['total_investment_nominal'], $last['cumulative_investment']);
});

T::test('evidence quality shares sum to ~100%', function () use ($engine) {
    $r = $engine->calculate(snap());
    T::eq(100.0, $r['evidence_quality']['measured']['share_pct']);
});

T::test('sensitivity ranks drivers and leaves base untouched', function () use ($engine) {
    $s = snap(['duration_years' => 3]);
    $before = json_encode($engine->calculate($s));
    $sens = $engine->sensitivity($s);
    T::true(count($sens['rows']) >= 5);
    T::true($sens['rows'][0]['swing_present_value'] >= end($sens['rows'])['swing_present_value']);
    T::eq($before, json_encode($engine->calculate($s)), 'input snapshot unchanged by sensitivity run');
    $disc = array_values(array_filter($sens['rows'], fn($r) => $r['parameter'] === 'discount_rate'))[0];
    T::true($disc['present_value_low'] > 0.0);
});

// ---- Excel Reference Workbooks Verification ----------------------------------------------------
T::test('workbook 1: Eye Project 68 reference calculation (undiscounted single-year SROI)', function () use ($engine) {
    // Total Investment: G19 = SUM(G9:G14) = 37,230 THB
    // Total Outcome: N19 = SUM(N3:N16) = 216,500 THB
    // SROI Ratio: N21 = N19/G19 = 216,500 / 37,230 = 5.8152
    $snap = [
        'project' => [
            'currency' => 'THB',
            'analysis_period_years' => 1,
            'discount_rate' => 0.0,
            'discount_base_year' => 0,
            'investment_basis' => 'nominal',
            'include_in_kind' => true,
        ],
        'costs' => [
            ['id' => 1, 'category' => 'delivery', 'description' => 'Medical screening & materials', 'amount' => 37230, 'currency' => 'THB', 'year' => 0],
        ],
        'stakeholders' => [
            ['id' => 1, 'name' => 'Elderly / Patients', 'stakeholder_group' => 'primary_beneficiary', 'group_code' => 'S1'],
        ],
        'outcomes' => [
            [
                'id' => 1,
                'name' => 'Visual impairment prevention & quality of life',
                'stakeholder_id' => 1,
                'quantity' => 1,
                'proxy_value' => 216500,
                'start_year' => 1,
                'duration_years' => 1,
                'evidence_quality' => 'measured',
                'proxy_source' => 'Project report',
                'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.0],
            ],
        ],
        'scenario' => ['id' => 1, 'name' => 'Base case', 'kind' => 'base', 'assumptions' => []],
    ];

    $r = $engine->calculate($snap);
    T::eq(37230.0, $r['summary']['total_investment_nominal']);
    T::eq(216500.0, $r['summary']['present_value_of_impact']);
    T::eq(5.8152, $r['summary']['sroi_ratio']);
    T::eq(179270.0, $r['summary']['net_social_value']);
});

T::test('workbook 2: Hydrotherapy Building 6-month scenario reference calculation', function () use ($engine) {
    // 6-month sheet: Total Investment L92 = 2,827,766 THB, Total Outcome U92 = 434,167 THB
    // SROI Ratio: O94 = 434,167 / 2,827,766 = 0.1535
    $snap = [
        'project' => [
            'currency' => 'THB',
            'analysis_period_years' => 1,
            'discount_rate' => 0.0,
            'discount_base_year' => 0,
            'investment_basis' => 'nominal',
            'include_in_kind' => true,
            'assessment_months' => 6,
        ],
        'costs' => [
            ['id' => 1, 'category' => 'capex', 'description' => 'Facility & equipment', 'amount' => 2827766, 'currency' => 'THB', 'year' => 0, 'period_label' => '6 months'],
        ],
        'stakeholders' => [
            ['id' => 1, 'name' => 'Hydrotherapy patients', 'stakeholder_group' => 'primary_beneficiary', 'group_code' => 'S1'],
        ],
        'outcomes' => [
            [
                'id' => 1,
                'name' => 'Physical rehabilitation outcomes (6-month evaluation)',
                'stakeholder_id' => 1,
                'quantity' => 1,
                'proxy_value' => 434167,
                'start_year' => 1,
                'duration_years' => 1,
                'evidence_quality' => 'measured',
                'proxy_source' => 'Hydrotherapy center records',
                'adjustment' => ['deadweight' => 0.0, 'attribution' => 0.0, 'displacement' => 0.0, 'drop_off' => 0.0],
            ],
        ],
        'scenario' => ['id' => 1, 'name' => 'Base case', 'kind' => 'base', 'assumptions' => []],
    ];

    $r = $engine->calculate($snap);
    T::eq(2827766.0, $r['summary']['total_investment_nominal']);
    T::eq(434167.0, $r['summary']['present_value_of_impact']);
    T::eq(0.1535, $r['summary']['sroi_ratio']);
});
