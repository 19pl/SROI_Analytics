<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;

$app = App::fromEnv();
$db = $app->db;

echo "Seeding database...\n";

// 1. Create or get demo user
$user = $db->one('SELECT * FROM users WHERE email = ?', ['demo@impactvalue.local']);
if (!$user) {
    $db->run(
        'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
        ['demo@impactvalue.local', 'Social Impact Analyst', password_hash('DemoPassword123!', PASSWORD_DEFAULT)]
    );
    $user = $db->one('SELECT * FROM users WHERE email = ?', ['demo@impactvalue.local']);
}

// 2. Create organization
$org = $db->one('SELECT * FROM organizations WHERE created_by = ?', [$user['id']]);
if (!$org) {
    $orgId = $db->insert('organizations', [
        'name' => 'Naresuan University Social Value Center',
        'created_by' => $user['id'],
    ]);
    $db->run(
        'INSERT OR IGNORE INTO memberships (organization_id, user_id, role) VALUES (?, ?, ?)',
        [$orgId, $user['id'], 'owner']
    );
    $org = $db->one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
}

// 3. Seed Global Financial Proxies
$proxies = [
    [
        'name' => 'Annual supplementary tutoring cost avoidance',
        'category' => 'Education',
        'unit' => 'household / year',
        'currency' => 'THB',
        'value' => 2000.0,
        'source' => 'National Education Household Survey 2026',
        'definition' => 'Average annual private tutoring fees saved by participating families.',
    ],
    [
        'name' => 'High school completion incremental lifetime earning proxy',
        'category' => 'Education',
        'unit' => 'student / year',
        'currency' => 'THB',
        'value' => 15000.0,
        'source' => 'Labor Market & Educational Attainment Study',
        'definition' => 'Estimated annual wage uplift attributable to improved academic progression.',
    ],
    [
        'name' => 'Value of community volunteer time',
        'category' => 'Time savings',
        'unit' => 'hour',
        'currency' => 'THB',
        'value' => 120.0,
        'source' => 'Standard Social Value Volunteering Rate',
        'definition' => 'Shadow wage replacement rate for non-specialist community volunteers.',
    ],
    [
        'name' => 'Healthcare cost avoidance per treated outpatient',
        'category' => 'Health and wellbeing',
        'unit' => 'person / year',
        'currency' => 'THB',
        'value' => 4500.0,
        'source' => 'Public Health Hospital Utilization Benchmark',
        'definition' => 'Direct clinical outpatient treatment expenditure avoided.',
    ],
    [
        'name' => 'Municipal waste diversion and paper recycling value',
        'category' => 'Waste management',
        'unit' => 'kg paper',
        'currency' => 'THB',
        'value' => 8.5,
        'source' => 'Pollution Control Department Material Recovery Value',
        'definition' => 'Monetized landfill diversion and raw material salvage value.',
    ],
    [
        'name' => 'Unregulated informal debt reduction interest avoidance',
        'category' => 'Poverty reduction',
        'unit' => 'household / year',
        'currency' => 'THB',
        'value' => 12000.0,
        'source' => 'Community Financial Wellness Survey',
        'definition' => 'Compound predatory interest payments avoided per beneficiary household.',
    ],
];

foreach ($proxies as $p) {
    $exists = $db->one('SELECT id FROM financial_proxies WHERE name = ?', [$p['name']]);
    if (!$exists) {
        $db->insert('financial_proxies', [
            'organization_id' => null,
            'name' => $p['name'],
            'category' => $p['category'],
            'unit' => $p['unit'],
            'currency' => $p['currency'],
            'value' => $p['value'],
            'source' => $p['source'],
            'definition' => $p['definition'],
        ]);
    }
}

// 4. Seed PRD Demo Project: University Tutoring Initiative
$proj = $db->one('SELECT * FROM projects WHERE name = ? AND organization_id = ?', ['University Community Tutoring Initiative', $org['id']]);
if (!$proj) {
    $pId = $db->insert('projects', [
        'organization_id' => $org['id'],
        'name' => 'University Community Tutoring Initiative',
        'organization_name' => 'Naresuan University',
        'description' => 'Supplementary tutoring and educational mentoring for underserved secondary school students in Phitsanulok.',
        'category' => 'Education',
        'country' => 'Thailand',
        'evaluation_type' => 'evaluative',
        'currency' => 'THB',
        'price_basis' => 'constant 2026 prices',
        'analysis_period_years' => 5,
        'discount_rate' => 0.035,
        'discount_rate_basis' => 'real',
        'discount_rate_source' => 'National Social Time Preference Framework',
        'discount_base_year' => 0,
        'investment_basis' => 'nominal',
        'include_in_kind' => 1,
        'status' => 'ready',
        'created_by' => $user['id'],
    ]);

    // Costs (matching PRD Section 1.2: Equipment 20,000, Staff 50,000, Materials 10,000, Admin 10,000 = 90,000)
    $costs = [
        ['capex', 'Initial equipment & computer hardware', 20000.0, 0, 1],
        ['opex', 'Staff and tutoring honorarium', 50000.0, 0, 1],
        ['delivery', 'Learning materials & workbooks', 10000.0, 0, 1],
        ['administration', 'Program administration & management overhead', 10000.0, 0, 1],
    ];
    foreach ($costs as [$cat, $desc, $amt, $yr, $cash]) {
        $db->insert('project_costs', [
            'project_id' => $pId,
            'category' => $cat,
            'description' => $desc,
            'amount' => $amt,
            'currency' => 'THB',
            'exchange_rate' => 1.0,
            'year' => $yr,
            'is_cash' => $cash,
            'include_in_calculation' => 1,
            'evidence_source' => 'Project Budget FY2026',
        ]);
    }

    // Stakeholders
    $stkStudents = $db->insert('stakeholders', [
        'project_id' => $pId,
        'name' => 'Students and learners',
        'category' => 'Students and learners',
        'role_in_project' => 'Primary Beneficiary',
        'estimated_count' => 200,
        'expected_positive' => 'Improved academic scores and progression',
        'evidence_source' => 'Student Progress Records',
    ]);

    $stkFamilies = $db->insert('stakeholders', [
        'project_id' => $pId,
        'name' => 'Beneficiary households',
        'category' => 'Beneficiary households',
        'role_in_project' => 'Supported Family',
        'estimated_count' => 120,
        'expected_positive' => 'Reduced household expenditure on private tuition',
        'evidence_source' => 'Parent Survey FY2026',
    ]);

    $stkUniv = $db->insert('stakeholders', [
        'project_id' => $pId,
        'name' => 'University & faculty',
        'category' => 'Teachers and educational staff',
        'role_in_project' => 'Delivery Institution',
        'estimated_count' => 30,
        'expected_positive' => 'Better student retention and teaching efficiency',
        'evidence_source' => 'Institutional Retention Report',
    ]);

    // Outcomes
    $o1 = $db->insert('outcomes', [
        'project_id' => $pId,
        'stakeholder_id' => $stkStudents,
        'name' => 'Improved educational attainment and exam pass rates',
        'activity' => 'Weekly mentoring and small-group tutoring sessions',
        'output_description' => '500 tutoring hours delivered over academic year',
        'indicator' => 'Secondary school standardized exam pass rate',
        'baseline' => '55% passing baseline',
        'observed_result' => '82% passing after intervention',
        'quantity' => 150,
        'proxy_value' => 4000.0,
        'proxy_unit' => 'student / year',
        'proxy_source' => 'National Education Improvement Benchmark',
        'polarity' => 'positive',
        'projection_model' => 'cohort',
        'duration_years' => 5,
        'evidence_quality' => 'measured',
    ]);

    $o2 = $db->insert('outcomes', [
        'project_id' => $pId,
        'stakeholder_id' => $stkFamilies,
        'name' => 'Reduced household expenditure on commercial tutoring',
        'activity' => 'Free campus tutoring provided',
        'output_description' => '120 families supported with free sessions',
        'indicator' => 'Average household tutoring spend',
        'baseline' => '฿3,500 / month commercial tutor fees',
        'observed_result' => '฿1,500 / month savings',
        'quantity' => 40,
        'proxy_value' => 2000.0,
        'proxy_unit' => 'household / year',
        'proxy_source' => 'National Education Household Survey 2026',
        'polarity' => 'positive',
        'projection_model' => 'cohort',
        'duration_years' => 4,
        'evidence_quality' => 'external',
    ]);

    $o3 = $db->insert('outcomes', [
        'project_id' => $pId,
        'stakeholder_id' => $stkStudents,
        'name' => 'Student commute transport fatigue and transit cost',
        'activity' => 'Traveling to weekend tutoring center',
        'output_description' => 'Commute across town',
        'indicator' => 'Travel time and transit ticket expense',
        'baseline' => 'No weekend travel',
        'observed_result' => '2 hours commute each weekend',
        'quantity' => 50,
        'proxy_value' => 500.0,
        'proxy_unit' => 'student / year',
        'proxy_source' => 'Student Travel Log',
        'polarity' => 'negative',
        'projection_model' => 'cohort',
        'duration_years' => 3,
        'evidence_quality' => 'estimated',
    ]);

    // Adjustments
    $db->insert('impact_adjustments', [
        'outcome_id' => $o1,
        'deadweight' => 0.20,
        'attribution' => 0.10,
        'displacement' => 0.00,
        'drop_off' => 0.10,
        'source' => 'Regional school control group comparison',
        'justification' => '20% of students historically improve without tutoring; 10% attributable to school teachers.',
    ]);

    $db->insert('impact_adjustments', [
        'outcome_id' => $o2,
        'deadweight' => 0.15,
        'attribution' => 0.20,
        'displacement' => 0.00,
        'drop_off' => 0.05,
        'source' => 'Parent survey responses',
        'justification' => '15% of families would have economized anyway; 20% attributable to self-study materials.',
    ]);

    $db->insert('impact_adjustments', [
        'outcome_id' => $o3,
        'deadweight' => 0.05,
        'attribution' => 0.05,
        'displacement' => 0.00,
        'drop_off' => 0.10,
        'source' => 'Student commute questionnaire',
        'justification' => 'Minor displacement from alternative local weekend activities.',
    ]);

    // Scenarios (Conservative & Optimistic)
    $db->insert('scenarios', [
        'project_id' => $pId,
        'name' => 'Base case',
        'kind' => 'base',
        'description' => 'Evidence-based central assumptions',
        'is_base' => 1,
        'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
    ]);

    $db->insert('scenarios', [
        'project_id' => $pId,
        'name' => 'Conservative Case',
        'kind' => 'conservative',
        'description' => 'Lower beneficiary retention and higher deadweight deductions',
        'is_base' => 0,
        'assumptions' => json_encode([
            'global' => ['discount_rate' => 0.05],
            'outcomes' => [
                $o1 => ['deadweight_delta' => 0.10, 'attribution_delta' => 0.05],
            ]
        ]),
    ]);

    $db->insert('scenarios', [
        'project_id' => $pId,
        'name' => 'Optimistic Policy Expansion',
        'kind' => 'optimistic',
        'description' => 'Extended multi-year benefit persistence and regional scaling',
        'is_base' => 0,
        'assumptions' => json_encode([
            'global' => ['discount_rate' => 0.025],
            'outcomes' => [
                $o1 => ['quantity_multiplier' => 1.25],
            ]
        ]),
    ]);

    echo "Demo Project #$pId created with full PRD dataset.\n";
}

echo "Seeding completed successfully.\n";
