<?php
declare(strict_types=1);

/**
 * Database Seeder for SROI Analytics
 * 
 * Re-seeds the database with a complete, modern, institutional-grade dataset for Naresuan University:
 * - Creates/finds Naresuan University organization and default owner user.
 * - Deletes old/stale seed projects and org hierarchy (cascade deletes child items).
 * - Creates 4 faculties and their respective academic departments.
 * - Creates full, high-fidelity SROI plans:
 *     1. Faculty-owned Evaluative Plan (คณะสหเวชศาสตร์)
 *     2. Department-owned Evaluative Plan (ภาควิชากายภาพบำบัด)
 *     3. Department-owned Plan (ภาควิชาเทคนิคการแพทย์)
 *     4. Faculty-owned Multi-year Plan (คณะสาธารณสุขศาสตร์)
 *     5. Department-owned Multi-year Plan (ภาควิชาอนามัยชุมชน)
 * - Persists authoritative Calculation Runs for all plans so dashboards, reports, and lists are populated.
 * 
 * Usage: php bin/seed.php [--clean]
 */

require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;
use App\Services\CalculationService;

$app = App::fromEnv();
$db = $app->db;

echo "========================================================\n";
echo "SROI Analytics - Seeding Full Comprehensive Dataset\n";
echo "========================================================\n\n";

// 1. Identify or create owner user
$user = $db->one('SELECT * FROM users ORDER BY id ASC LIMIT 1');
if (!$user) {
    $uid = $db->insert('users', [
        'email' => 'admin@nu.ac.th',
        'name' => 'ผู้ดูแลระบบ SROI (Naresuan University)',
        'password_hash' => password_hash('nu-sroi-2026', PASSWORD_DEFAULT),
    ]);
    $user = $db->one('SELECT * FROM users WHERE id = ?', [$uid]);
    echo "Created default admin user: {$user['email']} (#{$user['id']})\n";
} else {
    echo "Using existing user: {$user['email']} (#{$user['id']})\n";
}
$ownerId = (int)$user['id'];

// 2. Identify or create Naresuan University organization
$orgName = 'มหาวิทยาลัยนเรศวร (Naresuan University)';
$org = $db->one('SELECT * FROM organizations WHERE name = ?', [$orgName]);
if (!$org) {
    $orgId = $db->insert('organizations', [
        'name' => $orgName,
        'created_by' => $ownerId,
    ]);
    $org = $db->one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
    echo "Created organization: $orgName (#{$org['id']})\n";
} else {
    echo "Found organization: $orgName (#{$org['id']})\n";
}
$orgId = (int)$org['id'];

// Ensure user has owner membership
$membership = $db->one('SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?', [$orgId, $ownerId]);
if (!$membership) {
    $db->insert('memberships', [
        'organization_id' => $orgId,
        'user_id' => $ownerId,
        'role' => 'owner',
    ]);
    echo "Granted owner role to user #$ownerId in organization #$orgId\n";
}

// 3. Clean out old stale seeded data
echo "\nCleaning old projects and organizational hierarchy under organization #$orgId...\n";
$db->transaction(function () use ($db, $orgId) {
    // Delete all projects belonging to the org (cascades to costs, stakeholders, outcomes, adjustments, scenarios, runs, sheet tables)
    $db->run('DELETE FROM projects WHERE organization_id = ?', [$orgId]);
    // Delete all faculties belonging to the org (cascades to departments)
    $db->run('DELETE FROM faculties WHERE organization_id = ?', [$orgId]);
});
echo "Old project and hierarchy data cleared successfully.\n\n";

// 4. Seed Faculties & Academic Departments (Institutional Structure)
echo "Seeding Faculties and Departments...\n";

// 4.1 คณะสหเวชศาสตร์ (Faculty of Allied Health Sciences)
$facAlliedId = $db->insert('faculties', [
    'organization_id' => $orgId,
    'name'            => 'คณะสหเวชศาสตร์',
    'description'     => 'Faculty of Allied Health Sciences, Naresuan University - ศูนย์ความเป็นเลิศด้านการฟื้นฟูสมรรถภาพและการตรวจวินิจฉัยทางการแพทย์',
    'created_by'      => $ownerId,
]);

$deptPTId = $db->insert('departments', [
    'faculty_id'  => $facAlliedId,
    'name'        => 'ภาควิชากายภาพบำบัด',
    'description' => 'Department of Physical Therapy - บริการฟื้นฟูสมรรถภาพทางกายภาพบำบัดและธาราบำบัด',
    'created_by'  => $ownerId,
]);

$deptMedTechId = $db->insert('departments', [
    'faculty_id'  => $facAlliedId,
    'name'        => 'ภาควิชาเทคนิคการแพทย์',
    'description' => 'Department of Medical Technology - บริการตรวจวิเคราะห์ทางห้องปฏิบัติการทางการแพทย์เชิงรุก',
    'created_by'  => $ownerId,
]);

$deptOptoId = $db->insert('departments', [
    'faculty_id'  => $facAlliedId,
    'name'        => 'ภาควิชาทัศนมาตรศาสตร์',
    'description' => 'Department of Optometry - บริการตรวจวัดสายตาและสุขภาพการมองเห็นเฉพาะทาง',
    'created_by'  => $ownerId,
]);

$deptRadioId = $db->insert('departments', [
    'faculty_id'  => $facAlliedId,
    'name'        => 'ภาควิชารังสีเทคนิค',
    'description' => 'Department of Radiological Technology - บริการรังสีวินิจฉัยและสร้างภาพทางการแพทย์',
    'created_by'  => $ownerId,
]);

// 4.2 คณะสาธารณสุขศาสตร์ (Faculty of Public Health)
$facPHId = $db->insert('faculties', [
    'organization_id' => $orgId,
    'name'            => 'คณะสาธารณสุขศาสตร์',
    'description'     => 'Faculty of Public Health, Naresuan University - ผู้นำด้านการสร้างเสริมสุขภาพและการจัดการอนามัยสิ่งแวดล้อมชุมชน',
    'created_by'      => $ownerId,
]);

$deptCommHealthId = $db->insert('departments', [
    'faculty_id'  => $facPHId,
    'name'        => 'ภาควิชาอนามัยชุมชน',
    'description' => 'Department of Community Health - พัฒนาระบบสุขภาพปฐมภูมิและสุขอนามัยในโรงเรียนและชุมชน',
    'created_by'  => $ownerId,
]);

$deptEnvHealthId = $db->insert('departments', [
    'faculty_id'  => $facPHId,
    'name'        => 'ภาควิชาอนามัยสิ่งแวดล้อมและอาชีวอนามัย',
    'description' => 'Department of Environmental and Occupational Health - เฝ้าระวังมลพิษทางอากาศและความปลอดภัยในการทำงาน',
    'created_by'  => $ownerId,
]);

// 4.3 คณะเกษตรศาสตร์ ทรัพยากรธรรมชาติและสิ่งแวดล้อม
$facAgriId = $db->insert('faculties', [
    'organization_id' => $orgId,
    'name'            => 'คณะเกษตรศาสตร์ ทรัพยากรธรรมชาติและสิ่งแวดล้อม',
    'description'     => 'Faculty of Agriculture, Natural Resources and Environment - นวัตกรรมเกษตรปลอดภัยและการจัดการทรัพยากรชุมชน',
    'created_by'      => $ownerId,
]);

$deptAgriSciId = $db->insert('departments', [
    'faculty_id'  => $facAgriId,
    'name'        => 'ภาควิชาวิทยาศาสตร์การเกษตร',
    'description' => 'Department of Agricultural Science - การถ่ายทอดเทคโนโลยีเกษตรแม่นยำและเกษตรอินทรีย์',
    'created_by'  => $ownerId,
]);

$deptAgroIndId = $db->insert('departments', [
    'faculty_id'  => $facAgriId,
    'name'        => 'ภาควิชาอุตสาหกรรมเกษตร',
    'description' => 'Department of Agro-Industry - การแปรรูปเพิ่มมูลค่าผลผลิตการเกษตรและมาตรฐานอาหารปลอดภัย',
    'created_by'  => $ownerId,
]);

// 4.4 คณะวิศวกรรมศาสตร์
$facEngId = $db->insert('faculties', [
    'organization_id' => $orgId,
    'name'            => 'คณะวิศวกรรมศาสตร์',
    'description'     => 'Faculty of Engineering, Naresuan University - วิศวกรรมเพื่อการพัฒนาที่ยั่งยืนและพลังงานทดแทน',
    'created_by'      => $ownerId,
]);

$deptCivilId = $db->insert('departments', [
    'faculty_id'  => $facEngId,
    'name'        => 'ภาควิชาวิศวกรรมโยธา',
    'description' => 'Department of Civil Engineering - การบริหารจัดการน้ำชุมชนและโครงสร้างพื้นฐาน',
    'created_by'  => $ownerId,
]);

echo "Created 4 Faculties and 9 Departments.\n\n";

// Helper for loading proxies from the database
$proxies = $db->all('SELECT * FROM financial_proxies WHERE organization_id IS NULL');
$proxyMap = [];
foreach ($proxies as $p) {
    $proxyMap[$p['name']] = $p;
}

$calcService = new CalculationService($app);

// =========================================================================
// PLAN 1: Faculty-owned Evaluative Plan (คณะสหเวชศาสตร์)
// =========================================================================
echo "Seeding Plan 1 (Faculty-Owned): โครงการตรวจคัดกรองสายตาผู้สูงอายุ 2568...\n";

$p1Id = $db->insert('projects', [
    'organization_id'       => $orgId,
    'faculty_id'            => $facAlliedId,
    'department_id'         => null, // Direct Faculty Ownership
    'name'                  => 'โครงการบริการวิชาการตรวจคัดกรองสายตาและส่งมอบแว่นสายตาในผู้สูงอายุชุมชน ประจำปี 2568',
    'organization_name'     => 'คณะสหเวชศาสตร์ มหาวิทยาลัยนเรศวร',
    'description'           => 'การประเมินผลตอบแทนทางสังคม (SROI) โครงการบริการตรวจคัดกรองสายตา ตรวจความดันลูกตา และส่งมอบแว่นสายตาแก่ผู้สูงอายุในเขตชนบท จ.พิษณุโลก (อ้างอิงข้อมูลวิเคราะห์ SROI โครงการตา 68)',
    'category'              => 'Health and wellbeing',
    'country'               => 'Thailand',
    'start_date'            => '2025-10-01',
    'end_date'              => '2026-09-30',
    'evaluation_type'       => 'evaluative',
    'currency'              => 'THB',
    'price_basis'           => 'constant 2026 prices',
    'analysis_period_years' => 1,
    'assessment_months'     => 12,
    'discount_rate'         => 0.0,
    'discount_base_year'    => 0,
    'investment_basis'      => 'nominal',
    'include_in_kind'       => 1,
    'status'                => 'ready',
    'created_by'            => $ownerId,
]);

// Stakeholders (S1-S4)
$s1_beneficiary = $db->insert('stakeholders', [
    'project_id'             => $p1Id,
    'name'                   => 'ผู้สูงอายุที่มีปัญหาทางสายตาในชุมชนรอบมหาวิทยาลัย',
    'category'               => 'Beneficiary households',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1',
    'role_in_project'        => 'Primary Beneficiary',
    'estimated_count'        => 150,
    'count_unit'             => 'คน',
    'target_characteristics' => 'ผู้สูงอายุ 60 ปีขึ้นไปที่มีปัญหาการมองเห็นไม่ชัดเจน',
    'needs_or_problems'      => 'ขาดโอกาสเข้าถึงการตรวจวัดสายตาเฉพาะทางและไม่มีแว่นสายตาที่เหมาะสม',
    'expected_positive'      => 'สายตามองเห็นชัดเจนขึ้น ลดความเสี่ยงในการพลัดตกหกล้ม ช่วยเหลือตนเองในชีวิตประจำวันได้',
    'evidence_source'        => 'แบบคัดกรองสุขภาพสายตาผู้สูงอายุชุมชน ต.ท่าโพธิ์ 2568',
]);

$s1_family = $db->insert('stakeholders', [
    'project_id'             => $p1Id,
    'name'                   => 'ครอบครัวและผู้ดูแลผู้สูงอายุ',
    'category'               => 'Beneficiary households',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1.2',
    'role_in_project'        => 'Supported Family',
    'estimated_count'        => 120,
    'count_unit'             => 'ครัวเรือน',
    'target_characteristics' => 'สมาชิกในครอบครัวที่เป็นผู้ดูแลหลัก',
    'needs_or_problems'      => 'ภาระค่าใช้จ่ายในการตัดแว่นสายตาและการพาผู้สูงอายุเดินทางไปพบแพทย์',
    'expected_positive'      => 'ประหยัดค่าใช้จ่ายการตัดแว่นตา และลดเวลาเฝ้าระวังผู้สูงอายุ',
    'evidence_source'        => 'แบบสำรวจความพึงพอใจและภาระค่าใช้จ่ายครัวเรือน',
]);

$s1_operators = $db->insert('stakeholders', [
    'project_id'             => $p1Id,
    'name'                   => 'คณาจารย์และนิสิตหลักสูตรทัศนมาตรศาสตร์ คณะสหเวชศาสตร์',
    'category'               => 'Teachers and educational staff',
    'stakeholder_group'      => 'project_operator',
    'group_code'             => 'S2',
    'role_in_project'        => 'Delivery Institution',
    'estimated_count'        => 25,
    'count_unit'             => 'คน',
    'resources_used'         => 'องค์ความรู้ทัศนมาตรศาสตร์ เครื่องตรวจวัดความดันตา ชุดทดลองเลนส์',
    'expected_positive'      => 'ทักษะทางคลินิกและการเรียนรู้เชิงประสบการณ์จริงในชุมชน',
    'evidence_source'        => 'รายงานการประเมินสมรรถนะการฝึกปฏิบัติงานวิชาชีพ',
]);

$s1_supporters = $db->insert('stakeholders', [
    'project_id'             => $p1Id,
    'name'                   => 'รพ.สต. และ อาสาสมัครสาธารณสุขประจำหมู่บ้าน (อสม.)',
    'category'               => 'Community groups and civil society',
    'stakeholder_group'      => 'project_supporter',
    'group_code'             => 'S3',
    'role_in_project'        => 'Community Partner',
    'estimated_count'        => 4,
    'count_unit'             => 'แห่ง',
    'support_type'           => 'การประสานงานพื้นที่และคัดกรองเบื้องต้น',
    'expected_positive'      => 'ฐานข้อมูลสุขภาพสายตาผู้สูงอายุในความรับผิดชอบ',
    'evidence_source'        => 'บันทึกความร่วมมือพัฒนาสุขภาพชุมชน',
]);

// Costs (Step 1)
$p1Costs = [
    ['delivery', 'เลนส์และกรอบแว่นสายตาคุณภาพมาตรฐานสำหรับผู้สูงอายุ', 52500.0, 0, 1, 'quantity', 150, 'อัน', 350.0, 'ใบเสนอราคาและจัดซื้อวัสดุตรวจสายตา', $s1_beneficiary],
    ['delivery', 'เวชภัณฑ์และน้ำยาตรวจคัดกรองสุขภาพดวงตาและต้อหิน', 18200.0, 0, 1, 'manual', null, null, null, 'ใบเบิกเวชภัณฑ์ทางการแพทย์', null],
    ['opex', 'ค่าตอบแทนและเบี้ยเลี้ยงทีมตรวจวัดสายตาและจักษุวิทยา', 24000.0, 0, 1, 'quantity', 8, 'คน-วัน', 3000.0, 'หลักฐานการจ่ายเงินค่าตอบแทนบุคลากร', $s1_operators],
    ['administration', 'ยานพาหนะ ค่าน้ำมันเชื้อเพลิง และเอกสารประสานงานชุมชน', 14500.0, 0, 1, 'manual', null, null, null, 'ใบเสร็จค่าน้ำมันและใบสำคัญรับเงิน', null],
];
foreach ($p1Costs as [$cat, $desc, $amt, $yr, $cash, $mode, $qty, $unit, $price, $ev, $stkId]) {
    $db->insert('project_costs', [
        'project_id'             => $p1Id,
        'stakeholder_id'         => $stkId,
        'category'               => $cat,
        'description'            => $desc,
        'amount'                 => $amt,
        'currency'               => 'THB',
        'exchange_rate'          => 1.0,
        'year'                   => $yr,
        'period_label'           => 'Y0',
        'is_cash'                => $cash,
        'calculation_mode'       => $mode,
        'quantity'               => $qty,
        'unit'                   => $unit,
        'unit_price'             => $price,
        'include_in_calculation' => 1,
        'evidence_source'        => $ev,
    ]);
}

// Outcomes (Step 3)
$fallProxy = $proxyMap['ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลสังกัดมหาวิทยาลัย']['value'] ?? 34807.0;
$o1_1 = $db->insert('outcomes', [
    'project_id'         => $p1Id,
    'stakeholder_id'     => $s1_beneficiary,
    'proxy_id'           => $proxyMap['ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลสังกัดมหาวิทยาลัย']['id'] ?? null,
    'name'               => 'การป้องกันอุบัติเหตุสะดุดล้มและลดค่ารักษาพยาบาลจากภาวะกระดูกหักในผู้สูงอายุ',
    'activity'           => 'ตรวจวัดสายตาประกอบแว่นสายตาเฉพาะบุคคลและการให้คำแนะนำความปลอดภัยในบ้าน',
    'output_description' => 'ส่งมอบแว่นสายตาที่ตรงกับค่าสายตาจริงแก่ผู้สูงอายุ 150 ราย',
    'indicator'          => 'จำนวนผู้สูงอายุที่หลีกเลี่ยงอุบัติเหตุพลัดตกหกล้มที่มีความรุนแรงระดับต้องนอน รพ.',
    'baseline'           => 'อัตราการสะดุดล้มเฉลี่ยในผู้สูงอายุที่มีสายตาผิดปกติ 25% ต่อปี',
    'observed_result'    => 'ลดอุบัติเหตุล้มรุนแรงได้ 15 รายในรอบ 1 ปีหลังได้รับแว่นตา',
    'quantity'           => 15,
    'proxy_value'        => $fallProxy,
    'proxy_unit'         => 'คน / ปี',
    'proxy_source'       => 'ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลสังกัดมหาวิทยาลัย (สปสช.)',
    'proxy_rationale'    => 'การมองเห็นชัดเจนช่วยลดการสะดุดล้ม ป้องกันการบาดเจ็บกระดูกสะโพกหักและการนอนรักษาในโรงพยาบาล',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'measured',
]);

$o1_2 = $db->insert('outcomes', [
    'project_id'         => $p1Id,
    'stakeholder_id'     => $s1_family,
    'name'               => 'การลดภาระค่าใช้จ่ายในการตัดแว่นสายตาและการตรวจสายตาภาคเอกชนของครอบครัว',
    'activity'           => 'บริการตรวจวัดและส่งมอบแว่นสายตาฟรีในพื้นที่ชุมชน',
    'output_description' => '150 ครัวเรือนได้รับบริการโดยไม่ต้องเดินทางเข้าคลินิกเอกชนในตัวเมือง',
    'indicator'          => 'มูลค่าค่าบริการตัดแว่นตาและค่าเดินทางเฉลี่ยที่ประหยัดได้',
    'baseline'           => 'ค่าตัดแว่นสายตาคลินิกเอกชนเฉลี่ย 1,800 บาทต่ออัน',
    'observed_result'    => 'ประหยัดค่าใช้จ่ายได้ 1,500 บาทต่อคน',
    'quantity'           => 150,
    'proxy_value'        => 1500.0,
    'proxy_unit'         => 'ครัวเรือน / ครั้ง',
    'proxy_source'       => 'การสำรวจอัตราค่าบริการตัดแว่นสายตาร้านแว่นตาในจังหวัดพิษณุโลก 2568',
    'proxy_rationale'    => 'มูลค่าทดแทนค่าใช้จ่ายจริงที่ครอบครัวต้องจ่ายเพื่อจัดหาแว่นตาให้ผู้สูงอายุ',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'external',
]);

$o1_3 = $db->insert('outcomes', [
    'project_id'         => $p1Id,
    'stakeholder_id'     => $s1_operators,
    'name'               => 'การพัฒนาทักษะทางคลินิกทัศนมาตรและการตรวจสายตาชุมชนของนิสิต',
    'activity'           => 'การฝึกปฏิบัติการทางทัศนมาตรศาสตร์คลินิกภาคสนาม',
    'output_description' => 'นิสิต 20 รายได้รับการฝึกปฏิบัติจริงกับผู้ป่วยสายตามนุษย์ปฐมภูมิ',
    'indicator'          => 'มูลค่าเทียบเท่าการฝึกอบรมเชิงปฏิบัติการวิชาชีพเฉพาะทาง',
    'baseline'           => 'การฝึกปฏิบัติในห้องทดลองจำลอง 30 ชั่วโมง',
    'observed_result'    => 'การตรวจวัดผู้ป่วยจริงในสถานการณ์ภาคสนาม 50 ชั่วโมง',
    'quantity'           => 20,
    'proxy_value'        => 4500.0,
    'proxy_unit'         => 'คน / โครงการ',
    'proxy_source'       => 'เกณฑ์มูลค่าการฝึกปฏิบัติงานคลินิกวิชาชีพสุขภาพ สปสช.',
    'proxy_rationale'    => 'ทักษะทางคลินิกที่นิสิตได้รับช่วยเพิ่มความพร้อมในการสอบใบประกอบโรคศิลปะและการทำงานจริง',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'estimated',
]);

// Adjustments (Step 4)
$db->insert('impact_adjustments', [
    'outcome_id'    => $o1_1,
    'deadweight'    => 0.10,
    'attribution'   => 0.15,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'สถิติอุบัติเหตุผู้สูงอายุ รพ.สต. ในพื้นที่',
    'justification' => '10% ของผู้สูงอายุอาจระมัดระวังตนเองได้โดยธรรมชาติ และ 15% ได้รับการช่วยเหลือดูแลปรับปรุงสภาพบ้านจากบุตรหลาน',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o1_2,
    'deadweight'    => 0.15,
    'attribution'   => 0.10,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'แบบสำรวจพฤติกรรมการจัดหาแว่นตาของครอบครัว',
    'justification' => '15% ของครอบครัวมีแผนจะตัดแว่นให้อยู่แล้ว และ 10% ได้รับการสนับสนุนจากกองทุนสวัสดิการชุมชน',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o1_3,
    'deadweight'    => 0.20,
    'attribution'   => 0.10,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'การประเมินหลักสูตรทัศนมาตรศาสตรบัณฑิต',
    'justification' => '20% ของทักษะได้จากการฝึกในห้องปฏิบัติการปกติของมหาวิทยาลัย',
]);

// Scenarios (Step 5)
$sc1_base = $db->insert('scenarios', [
    'project_id'  => $p1Id,
    'name'        => 'Base case',
    'kind'        => 'base',
    'description' => 'สมมติฐานตามหลักฐานเชิงประจักษ์จริงจากการดำเนินงานโครงการ',
    'is_base'     => 1,
    'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
]);
$db->insert('scenarios', [
    'project_id'  => $p1Id,
    'name'        => 'Conservative Case',
    'kind'        => 'conservative',
    'description' => 'กรณีคิดการป้องกันอุบัติเหตุลดลงและเพิ่มค่า Deadweight',
    'is_base'     => 0,
    'assumptions' => json_encode([
        'outcomes' => [$o1_1 => ['quantity_multiplier' => 0.8, 'deadweight_delta' => 0.1]]
    ]),
]);
$db->insert('scenarios', [
    'project_id'  => $p1Id,
    'name'        => 'Optimistic Case',
    'kind'        => 'optimistic',
    'description' => 'กรณีขยายผลการส่งมอบแว่นตาครอบคลุมชุมชนข้างเคียง',
    'is_base'     => 0,
    'assumptions' => json_encode([
        'outcomes' => [$o1_1 => ['quantity_multiplier' => 1.25]]
    ]),
]);

// Run calculation and save to calculation_runs (Step 6)
$p1Row = $db->one('SELECT * FROM projects WHERE id = ?', [$p1Id]);
$c1 = $calcService->calculate($p1Row, $sc1_base, null, true);
echo "  -> Plan #$p1Id calculated: Investment = ฿" . number_format($c1['run']['investment']) .
     ", PV = ฿" . number_format($c1['run']['present_value']) .
     ", SROI = " . number_format((float)$c1['run']['sroi_ratio'], 2) . ":1\n";


// =========================================================================
// PLAN 2: Department-owned Plan (ภาควิชากายภาพบำบัด under คณะสหเวชศาสตร์)
// =========================================================================
echo "\nSeeding Plan 2 (Department-Owned): โครงการบริการอาคารธาราบำบัด 2568...\n";

$p2Id = $db->insert('projects', [
    'organization_id'       => $orgId,
    'faculty_id'            => null,
    'department_id'         => $deptPTId, // Department Ownership
    'name'                  => 'โครงการบริการฟื้นฟูสมรรถภาพผู้ป่วยโรคหลอดเลือดสมองและระบบประสาทด้วยธาราบำบัด (Hydrotherapy)',
    'organization_name'     => 'ภาควิชากายภาพบำบัด คณะสหเวชศาสตร์',
    'description'           => 'การประเมินผลตอบแทนทางสังคมจากการให้บริการฟื้นฟูสมรรถภาพผู้ป่วยด้วยธาราบำบัด (รอบการประเมิน 6 เดือน อ้างอิงสมุดงานอาคารธาราบำบัด_SROI Data 18.4.67)',
    'category'              => 'Health and wellbeing',
    'country'               => 'Thailand',
    'start_date'            => '2026-01-01',
    'end_date'              => '2026-06-30',
    'evaluation_type'       => 'evaluative',
    'currency'              => 'THB',
    'price_basis'           => 'constant 2026 prices',
    'analysis_period_years' => 1,
    'assessment_months'     => 6,
    'discount_rate'         => 0.0,
    'discount_base_year'    => 0,
    'investment_basis'      => 'nominal',
    'include_in_kind'       => 1,
    'status'                => 'ready',
    'created_by'            => $ownerId,
]);

// Stakeholders
$s2_patients = $db->insert('stakeholders', [
    'project_id'             => $p2Id,
    'name'                   => 'ผู้ป่วยโรคหลอดเลือดสมองและระบบประสาทกล้ามเนื้อที่รับบริการธาราบำบัด',
    'category'               => 'Beneficiary households',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1',
    'role_in_project'        => 'Primary Beneficiary',
    'estimated_count'        => 542,
    'count_unit'             => 'คน',
    'target_characteristics' => 'ผู้ป่วย Stroke, พาร์กินสัน, และผู้ป่วยฟื้นฟูหลังผ่าตัดข้อ',
    'needs_or_problems'      => 'ต้องการสถานที่ธาราบำบัดมาตรฐานและนักกายภาพบำบัดดูแลใกล้ชิดเพื่อฟื้นตัวเร็วขึ้น',
    'expected_positive'      => 'ความสามารถในการทรงตัวและการเคลื่อนไหวดีขึ้น ลดอาการปวดกล้ามเนื้อ',
    'evidence_source'        => 'เวชระเบียนคลินิกกายภาพบำบัดและอาคารธาราบำบัด ม.นเรศวร',
]);

$s2_caregivers = $db->insert('stakeholders', [
    'project_id'             => $p2Id,
    'name'                   => 'ญาติและผู้ดูแลผู้ป่วยติดเตียงหรือกึ่งติดเตียง',
    'category'               => 'Beneficiary households',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1.2',
    'role_in_project'        => 'Supported Family',
    'estimated_count'        => 450,
    'count_unit'             => 'ครัวเรือน',
    'target_characteristics' => 'ผู้ดูแลในครอบครัวที่ต้องคอยพยุงช่วยเหลือผู้ป่วยตลอด 24 ชั่วโมง',
    'needs_or_problems'      => 'ความเครียดสะสม อาการปวดหลังจากการยกพยุง และการเสียโอกาสในการประกอบอาชีพ',
    'expected_positive'      => 'ลดเวลาในการช่วยพยุงเมื่อผู้ป่วยเคลื่อนไหวได้เอง และลดความเครียดสะสม',
    'evidence_source'        => 'แบบสอบถามความเครียดและภาระผู้ดูแล (Caregiver Burden Survey)',
]);

$s2_therapists = $db->insert('stakeholders', [
    'project_id'             => $p2Id,
    'name'                   => 'นักกายภาพบำบัดและคณาจารย์ ภาควิชากายภาพบำบัด',
    'category'               => 'Teachers and educational staff',
    'stakeholder_group'      => 'project_operator',
    'group_code'             => 'S2',
    'role_in_project'        => 'Operating Team',
    'estimated_count'        => 18,
    'count_unit'             => 'คน',
    'resources_used'         => 'ทักษะวิชาชีพการบำบัดในน้ำ และการใช้อุปกรณ์ไฮโดรเธอราปี',
    'expected_positive'      => 'การพัฒนาทักษะวิชาชีพชั้นสูงด้านธาราบำบัดและการผลิตงานวิจัยฟื้นฟูสมรรถภาพ',
    'evidence_source'        => 'รายงานการประเมินสมรรถนะบุคลากรวิชาชีพ',
]);

$s2_nhso = $db->insert('stakeholders', [
    'project_id'             => $p2Id,
    'name'                   => 'สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) เขต 2 พิษณุโลก',
    'category'               => 'Government agencies',
    'stakeholder_group'      => 'project_supporter',
    'group_code'             => 'S3',
    'role_in_project'        => 'Fund / Policy Supporter',
    'estimated_count'        => 1,
    'count_unit'             => 'แห่ง',
    'support_type'           => 'กองทุนฟื้นฟูสมรรถภาพทางการแพทย์ระดับจังหวัด',
    'expected_positive'      => 'การกระจายบริการฟื้นฟูเฉพาะทางระดับตติยภูมิสู่ชุมชน',
    'evidence_source'        => 'บันทึกข้อตกลงความร่วมมือการจัดบริการฟื้นฟูสมรรถภาพ',
]);

// Costs (Step 1)
$p2Costs = [
    ['capex', 'ค่าเสื่อมราคาอาคารธาราบำบัดและระบบสระน้ำอุ่น (รอบ 6 เดือน)', 1426383.0, 0, 1, 'manual', null, null, null, 'ทะเบียนสินทรัพย์และงบเสื่อมราคา มหาวิทยาลัยนเรศวร (J46 Excel)', $s2_nhso],
    ['opex', 'ค่าน้ำประปา ไฟฟ้า สารเคมี และค่าบำรุงรักษาระบบกรองน้ำสระ', 320000.0, 0, 1, 'manual', null, null, null, 'ใบแจ้งหนี้สาธารณูปโภคและสัญญาบำรุงรักษาอาคาร', null],
    ['opex', 'ค่าตอบแทนนักกายภาพบำบัด ช่างเทคนิค และเจ้าหน้าที่ความปลอดภัยสระ', 240000.0, 0, 1, 'quantity', 6, 'เดือน', 40000.0, 'บัญชีการจ่ายค่าตอบแทนบุคลากรประจำอาคาร', $s2_therapists],
];
foreach ($p2Costs as [$cat, $desc, $amt, $yr, $cash, $mode, $qty, $unit, $price, $ev, $stkId]) {
    $db->insert('project_costs', [
        'project_id'             => $p2Id,
        'stakeholder_id'         => $stkId,
        'category'               => $cat,
        'description'            => $desc,
        'amount'                 => $amt,
        'currency'               => 'THB',
        'exchange_rate'          => 1.0,
        'year'                   => $yr,
        'period_label'           => '6 เดือน',
        'is_cash'                => $cash,
        'calculation_mode'       => $mode,
        'quantity'               => $qty,
        'unit'                   => $unit,
        'unit_price'             => $price,
        'include_in_calculation' => 1,
        'evidence_source'        => $ev,
    ]);
}

// Outcomes (Step 3)
$timeValueProxy = $proxyMap['มูลค่าเวลารายชั่วโมง (คำนวณจากค่าจ้างขั้นต่ำ จังหวัดพิษณุโลก)']['value'] ?? 44.0;
$elecProxy = $proxyMap['ค่าไฟฟ้าเรียกเก็บเฉลี่ย (ไม่รวม VAT)']['value'] ?? 3.86;

$o2_1 = $db->insert('outcomes', [
    'project_id'         => $p2Id,
    'stakeholder_id'     => $s2_patients,
    'name'               => 'การฟื้นฟูสมรรถภาพทางกายภาพบำบัดและการประหยัดค่ารักษาพยาบาลเปรียบเทียบภาคเอกชน',
    'activity'           => 'การฝึกฟื้นฟูระบบประสาทและการทรงตัวในสระธาราบำบัด',
    'output_description' => 'ให้บริการผู้ป่วยระบบประสาทและกล้ามเนื้อรวม 1,768 ครั้ง (542 ราย)',
    'indicator'          => 'ค่าใช้จ่ายส่วนต่างเปรียบเทียบกับการทำธาราบำบัดในโรงพยาบาลเอกชน',
    'baseline'           => 'ค่าบริการธาราบำบัด รพ.เอกชน เฉลี่ย 1,800 บาทต่อครั้ง',
    'observed_result'    => 'ผู้ป่วยจ่ายค่าธรรมเนียมเพียง 350-500 บาท ประหยัดได้ 1,300 บาทต่อครั้ง',
    'quantity'           => 1768,
    'proxy_value'        => 1300.0,
    'proxy_unit'         => 'ครั้ง / 6 เดือน',
    'proxy_source'       => 'การเปรียบเทียบอัตราค่าบริการธาราบำบัดในโรงพยาบาลเอกชนเขตภาคเหนือ',
    'proxy_rationale'    => 'ส่วนต่างค่าบริการที่ผู้ป่วยประหยัดได้จริงจากการรับบริการที่อาคารธาราบำบัดมหาวิทยาลัย',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'measured',
]);

$o2_2 = $db->insert('outcomes', [
    'project_id'         => $p2Id,
    'stakeholder_id'     => $s2_caregivers,
    'proxy_id'           => $proxyMap['มูลค่าเวลารายชั่วโมง (คำนวณจากค่าจ้างขั้นต่ำ จังหวัดพิษณุโลก)']['id'] ?? null,
    'name'               => 'การประหยัดเวลาและลดภาระการเฝ้าดูแลของญาติผู้ดูแลผู้ป่วย',
    'activity'           => 'การฟื้นฟูสมรรถภาพให้ผู้ป่วยสามารถเดินทรงตัวและช่วยเหลือตนเองในชีวิตประจำวันได้',
    'output_description' => 'ผู้ป่วย 280 รายมีความสามารถในการทำกิจวัตรประจำวันด้วยตนเองดีขึ้น (Barthel Index ดีขึ้น)',
    'indicator'          => 'เวลาที่ผู้ดูแลประหยัดได้เฉลี่ย 60 ชั่วโมงต่อคน ในช่วง 6 เดือน',
    'baseline'           => 'ผู้ดูแลต้องประกบช่วยเหลือตลอดเวลา 4-6 ชั่วโมงต่อวัน',
    'observed_result'    => 'ผู้ป่วยช่วยเหลือตนเองได้เพิ่มขึ้น ประหยัดเวลาผู้ดูแลเฉลี่ย 1.5 ชม./วัน',
    'quantity'           => 280,
    'proxy_value'        => $timeValueProxy * 60, // 2,640 THB
    'proxy_unit'         => 'ครัวเรือน / 6 เดือน',
    'proxy_source'       => 'มูลค่าเวลารายชั่วโมง (คำนวณจากค่าจ้างขั้นต่ำ จังหวัดพิษณุโลก)',
    'proxy_rationale'    => 'เวลาที่ประหยัดได้ช่วยให้ผู้ดูแลสามารถไปประกอบอาชีพหารายได้หรือมีเวลาพักผ่อน',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'external',
]);

$o2_3 = $db->insert('outcomes', [
    'project_id'         => $p2Id,
    'stakeholder_id'     => $s2_therapists,
    'proxy_id'           => $proxyMap['ค่าไฟฟ้าเรียกเก็บเฉลี่ย (ไม่รวม VAT)']['id'] ?? null,
    'name'               => 'การลดค่าใช้จ่ายพลังงานไฟฟ้าจากการติดตั้งระบบโซลาร์เซลล์สระธาราบำบัด',
    'activity'           => 'ผลิตไฟฟ้าพลังงานแสงอาทิตย์สำหรับระบบหมุนเวียนและบำบัดน้ำอุ่น',
    'output_description' => 'ผลิตไฟฟ้าได้ 22,221 kWh ในรอบ 6 เดือน (อ้างอิง Excel S48)',
    'indicator'          => 'หน่วยไฟฟ้าที่ผลิตและนำมาใช้จริงในอาคารธาราบำบัด',
    'baseline'           => 'ใช้ไฟฟ้าจากระบบจำหน่าย 100%',
    'observed_result'    => 'ผลิตไฟฟ้าทดแทนได้ 22,221 kWh',
    'quantity'           => 22221,
    'proxy_value'        => $elecProxy,
    'proxy_unit'         => 'kWh',
    'proxy_source'       => 'ค่าไฟฟ้าเรียกเก็บเฉลี่ย (ไม่รวม VAT) กฟภ.',
    'proxy_rationale'    => 'ค่าไฟฟ้าจริงที่คณะประหยัดได้จากการใช้พลังงานแสงอาทิตย์ในการอุ่นน้ำสระธาราบำบัด',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'measured',
]);

// Adjustments (Step 4)
$db->insert('impact_adjustments', [
    'outcome_id'    => $o2_1,
    'deadweight'    => 0.15,
    'attribution'   => 0.20,
    'displacement'  => 0.05,
    'drop_off'      => 0.05,
    'source'        => 'การวิเคราะห์กลุ่มเปรียบเทียบและการประเมินทางคลินิก',
    'justification' => '15% ของผู้ป่วยอาจฟื้นตัวตามธรรมชาติ, 20% ได้รับผลจากการรับประทานยาและกายภาพบนบก, 5% ย้ายจากคลินิกอื่น',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o2_2,
    'deadweight'    => 0.10,
    'attribution'   => 0.15,
    'displacement'  => 0.00,
    'drop_off'      => 0.05,
    'source'        => 'แบบสำรวจผู้ดูแลผู้ป่วยระบบประสาท',
    'justification' => '10% ของครอบครัวมีการจ้างผู้ช่วยดูแลอยู่เดิม และ 15% เป็นผลจากการปรับสภาพแวดล้อมในบ้าน',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o2_3,
    'deadweight'    => 0.00,
    'attribution'   => 0.00,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'มิเตอร์วัดพลังงานไฟฟ้าโซลาร์เซลล์',
    'justification' => 'ไฟฟ้าที่ผลิตได้จากแผงโซลาร์เซลล์ของอาคารเกิดจากโครงการโดยตรง 100%',
]);

// Scenarios (Step 5)
$sc2_base = $db->insert('scenarios', [
    'project_id'  => $p2Id,
    'name'        => 'Base case',
    'kind'        => 'base',
    'description' => 'สมมติฐานหลักตามสถิติการให้บริการจริง 6 เดือน',
    'is_base'     => 1,
    'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
]);
$db->insert('scenarios', [
    'project_id'  => $p2Id,
    'name'        => 'Conservative Case',
    'kind'        => 'conservative',
    'description' => 'กรณีคิดการฟื้นตัวต่ำกว่าเป้าหมายและหัก Deadweight เพิ่ม 10%',
    'is_base'     => 0,
    'assumptions' => json_encode([
        'outcomes' => [$o2_1 => ['deadweight_delta' => 0.10]]
    ]),
]);
$db->insert('scenarios', [
    'project_id'  => $p2Id,
    'name'        => 'Optimistic Full Capacity',
    'kind'        => 'optimistic',
    'description' => 'กรณีขยายเวลาเปิดให้บริการช่วงเย็นและวันเสาร์-อาทิตย์',
    'is_base'     => 0,
    'assumptions' => json_encode([
        'outcomes' => [$o2_1 => ['quantity_multiplier' => 1.30]]
    ]),
]);

// Run calculation (Step 6)
$p2Row = $db->one('SELECT * FROM projects WHERE id = ?', [$p2Id]);
$c2 = $calcService->calculate($p2Row, $sc2_base, null, true);
echo "  -> Plan #$p2Id calculated: Investment = ฿" . number_format($c2['run']['investment']) .
     ", PV = ฿" . number_format($c2['run']['present_value']) .
     ", SROI = " . number_format((float)$c2['run']['sroi_ratio'], 2) . ":1\n";


// =========================================================================
// PLAN 3: Department-owned Plan (ภาควิชาเทคนิคการแพทย์ under คณะสหเวชศาสตร์)
// =========================================================================
echo "\nSeeding Plan 3 (Department-Owned): โครงการตรวจคัดกรองเบาหวานและไขมันเชิงรุก 2568...\n";

$p3Id = $db->insert('projects', [
    'organization_id'       => $orgId,
    'faculty_id'            => null,
    'department_id'         => $deptMedTechId, // Medical Technology Department
    'name'                  => 'โครงการตรวจประเมินความเสี่ยงโรคไตและเบาหวานในชุมชนเชิงรุก ประจำปี 2568',
    'organization_name'     => 'ภาควิชาเทคนิคการแพทย์ คณะสหเวชศาสตร์',
    'description'           => 'การประเมิน SROI โครงการบริการตรวจวิเคราะห์ทางห้องปฏิบัติการทางการแพทย์เชิงรุก เพื่อคัดกรองความเสี่ยงโรคเบาหวานและโรคไตเรื้อรังในประชากรวัยแรงงานและผู้สูงอายุในชนบท',
    'category'              => 'Health and wellbeing',
    'country'               => 'Thailand',
    'start_date'            => '2025-11-01',
    'end_date'              => '2026-08-31',
    'evaluation_type'       => 'evaluative',
    'currency'              => 'THB',
    'price_basis'           => 'constant 2026 prices',
    'analysis_period_years' => 1,
    'assessment_months'     => 10,
    'discount_rate'         => 0.0,
    'discount_base_year'    => 0,
    'investment_basis'      => 'nominal',
    'include_in_kind'       => 1,
    'status'                => 'ready',
    'created_by'            => $ownerId,
]);

$s3_community = $db->insert('stakeholders', [
    'project_id'             => $p3Id,
    'name'                   => 'ประชาชนกลุ่มเสี่ยงโรคไม่ติดต่อเรื้อรัง (NCDs) ในชุมชนชนบท',
    'category'               => 'Beneficiary households',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1',
    'role_in_project'        => 'Target Population',
    'estimated_count'        => 350,
    'count_unit'             => 'คน',
    'needs_or_problems'      => 'ไม่เคยได้รับการตรวจระดับน้ำตาลสะสม (HbA1c) และการทำงานของไต (eGFR)',
    'expected_positive'      => 'ทราบสถานะสุขภาพระยะเริ่มต้น ได้รับการส่งต่อก่อนไตเสื่อมระยะรุนแรง',
    'evidence_source'        => 'ระบบคัดกรองความเสี่ยง NCDs ชุมชน',
]);

$s3Costs = [
    ['delivery', 'ชุดน้ำยาตรวจวิเคราะห์ทางห้องปฏิบัติการ HbA1c, Creatinine และ Lipid Profile', 68000.0, 0, 1, 'quantity', 350, 'ชุด', 194.28, 'ใบเสนอราคาน้ำยาตรวจแล็บ', null],
    ['delivery', 'หลอดเก็บตัวอย่างเลือด เข็ม และอุปกรณ์ป้องกันการติดเชื้อ', 16500.0, 0, 1, 'manual', null, null, null, 'ใบเบิกเวชภัณฑ์ห้องปฏิบัติการ', null],
    ['opex', 'ค่าตอบแทนนักเทคนิคการแพทย์และเจ้าหน้าที่ออกหน่วยตรวจภาคสนาม', 25000.0, 0, 1, 'quantity', 5, 'ครั้ง', 5000.0, 'หลักฐานการจ่ายเงินค่าตอบแทนบุคลากร', null],
];
foreach ($s3Costs as [$cat, $desc, $amt, $yr, $cash, $mode, $qty, $unit, $price, $ev, $stkId]) {
    $db->insert('project_costs', [
        'project_id'             => $p3Id,
        'stakeholder_id'         => $stkId,
        'category'               => $cat,
        'description'            => $desc,
        'amount'                 => $amt,
        'currency'               => 'THB',
        'exchange_rate'          => 1.0,
        'year'                   => $yr,
        'period_label'           => 'Y0',
        'is_cash'                => $cash,
        'calculation_mode'       => $mode,
        'quantity'               => $qty,
        'unit'                   => $unit,
        'unit_price'             => $price,
        'include_in_calculation' => 1,
        'evidence_source'        => $ev,
    ]);
}

$dmOutpatientProxy = $proxyMap['ต้นทุนผู้ป่วยนอกโรคเบาหวาน เฉลี่ยต่อครั้ง']['value'] ?? 1676.0;
$o3_1 = $db->insert('outcomes', [
    'project_id'         => $p3Id,
    'stakeholder_id'     => $s3_community,
    'proxy_id'           => $proxyMap['ต้นทุนผู้ป่วยนอกโรคเบาหวาน เฉลี่ยต่อครั้ง']['id'] ?? null,
    'name'               => 'การตรวจพบเบาหวานระยะแรกและการป้องกันภาวะแทรกซ้อนไตเสื่อม',
    'activity'           => 'ตรวจวิเคราะห์ระดับน้ำตาลสะสมและค่าการทำงานของไตในชุมชน',
    'output_description' => 'ตรวจคัดกรองประชาชน 350 ราย พบกลุ่มเสี่ยงสูงและส่งเข้าสู่การปรับพฤติกรรม 65 ราย',
    'indicator'          => 'จำนวนผู้ป่วยที่ตรวจพบแต่เนิ่นๆ และลดการต้องมารับบริการผู้ป่วยนอกซ้ำซ้อน',
    'baseline'           => 'ตรวจพบช้าเมื่อมีอาการไตวายระยะ 3-4',
    'observed_result'    => 'ตรวจพบระยะก่อนเบาหวานและระยะที่ 1 รวม 65 ราย',
    'quantity'           => 65,
    'proxy_value'        => $dmOutpatientProxy * 4, // 6,704 THB (ประหยัดการมา รพ. 4 ครั้ง/ปี)
    'proxy_unit'         => 'คน / ปี',
    'proxy_source'       => 'ต้นทุนผู้ป่วยนอกโรคเบาหวาน เฉลี่ยต่อครั้ง (สปสช.)',
    'proxy_rationale'    => 'การตรวจพบและควบคุมระดับน้ำตาลได้แต่เนิ่นๆ ช่วยลดจำนวนครั้งที่ต้องมาตรวจรักษาภาวะแทรกซ้อนที่ รพ.',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'measured',
]);

$o3_2 = $db->insert('outcomes', [
    'project_id'         => $p3Id,
    'stakeholder_id'     => $s3_community,
    'name'               => 'การประหยัดค่าตรวจวิเคราะห์ทางห้องปฏิบัติการเอกชนของประชาชน',
    'activity'           => 'บริการเจาะเลือดตรวจแล็บฟรีถึงในหมู่บ้าน',
    'output_description' => 'ประชาชน 350 รายไม่ต้องเดินทางไปตรวจที่คลินิกแล็บเอกชน',
    'indicator'          => 'อัตราค่าตรวจชุดตรวจเบาหวานและไตในคลินิกเอกชน',
    'baseline'           => 'ค่าตรวจแล็บเอกชนเฉลี่ย 650 บาทต่อชุด',
    'observed_result'    => 'ประหยัดค่าตรวจได้ 650 บาทต่อคน',
    'quantity'           => 350,
    'proxy_value'        => 650.0,
    'proxy_unit'         => 'คน / ครั้ง',
    'proxy_source'       => 'การสำรวจราคาค่าบริการห้องปฏิบัติการเอกชน จ.พิษณุโลก',
    'proxy_rationale'    => 'มูลค่าทดแทนค่าใช้จ่ายโดยตรงที่ประชาชนประหยัดได้',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 1,
    'evidence_quality'   => 'external',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o3_1,
    'deadweight'    => 0.10,
    'attribution'   => 0.15,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'รายงานการติดตามผลสุขภาพ รพ.สต.',
    'justification' => '10% ของประชาชนอาจไปตรวจประจำปีเอง และ 15% เป็นผลจากการรณรงค์ของ อสม.',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o3_2,
    'deadweight'    => 0.15,
    'attribution'   => 0.10,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'แบบสำรวจการเข้าถึงบริการสุขภาพ',
    'justification' => '15% ของประชาชนมีสิทธิเบิกจ่ายค่ารักษาพยาบาลอยู่แล้ว',
]);

$sc3_base = $db->insert('scenarios', [
    'project_id'  => $p3Id,
    'name'        => 'Base case',
    'kind'        => 'base',
    'description' => 'สมมติฐานหลักตามสถิติผลการตรวจวิเคราะห์จริง',
    'is_base'     => 1,
    'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
]);
$db->insert('scenarios', [
    'project_id'  => $p3Id,
    'name'        => 'Conservative Case',
    'kind'        => 'conservative',
    'description' => 'กรณีคิดการคุมระดับน้ำตาลได้ผลเพียง 70%',
    'is_base'     => 0,
    'assumptions' => json_encode([
        'outcomes' => [$o3_1 => ['quantity_multiplier' => 0.70]]
    ]),
]);

$p3Row = $db->one('SELECT * FROM projects WHERE id = ?', [$p3Id]);
$c3 = $calcService->calculate($p3Row, $sc3_base, null, true);
echo "  -> Plan #$p3Id calculated: Investment = ฿" . number_format($c3['run']['investment']) .
     ", PV = ฿" . number_format($c3['run']['present_value']) .
     ", SROI = " . number_format((float)$c3['run']['sroi_ratio'], 2) . ":1\n";


// =========================================================================
// PLAN 4: Faculty-owned Multi-year Plan (คณะสาธารณสุขศาสตร์)
// =========================================================================
echo "\nSeeding Plan 4 (Faculty-Owned, Multi-Year): โครงการเฝ้าระวังมลพิษ PM 2.5 และห้องปลอดฝุ่น...\n";

$p4Id = $db->insert('projects', [
    'organization_id'       => $orgId,
    'faculty_id'            => $facPHId, // Direct Faculty Ownership
    'department_id'         => null,
    'name'                  => 'โครงการพัฒนาระบบเฝ้าระวังมลพิษอากาศ PM 2.5 และห้องปลอดฝุ่นต้นแบบเพื่อสุขภาพประชาชนกลุ่มเปราะบาง',
    'organization_name'     => 'คณะสาธารณสุขศาสตร์ มหาวิทยาลัยนเรศวร',
    'description'           => 'การประเมิน SROI โครงการจัดตั้งห้องปลอดฝุ่นต้นแบบและการพัฒนาระบบแจ้งเตือนมลพิษทางอากาศในศูนย์พัฒนาเด็กเล็กและโรงเรียนประถมศึกษา จังหวัดพิษณุโลก (ระยะเวลาประเมิน 3 ปี)',
    'category'              => 'Environmental benefits',
    'country'               => 'Thailand',
    'start_date'            => '2026-01-01',
    'end_date'              => '2028-12-31',
    'evaluation_type'       => 'forecast',
    'currency'              => 'THB',
    'price_basis'           => 'constant 2026 prices',
    'analysis_period_years' => 3,
    'discount_rate'         => 0.035,
    'discount_rate_basis'   => 'real',
    'discount_rate_source'  => 'National Social Time Preference Framework (3.5%)',
    'discount_base_year'    => 0,
    'investment_basis'      => 'nominal',
    'include_in_kind'       => 1,
    'status'                => 'ready',
    'created_by'            => $ownerId,
]);

$s4_children = $db->insert('stakeholders', [
    'project_id'             => $p4Id,
    'name'                   => 'เด็กปฐมวัยในศูนย์พัฒนาเด็กเล็กและโรงเรียนอนุบาล',
    'category'               => 'Students and learners',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1',
    'role_in_project'        => 'Vulnerable Beneficiary',
    'estimated_count'        => 420,
    'count_unit'             => 'คน',
    'needs_or_problems'      => 'เสี่ยงต่อการเจ็บป่วยระบบทางเดินหายใจเฉียบพลันช่วงวิกฤตฝุ่น PM 2.5',
    'expected_positive'      => 'ลดการสัมผัสฝุ่นพิษในห้องเรียน ลดอัตราป่วยโรคหอบหืดและทางเดินหายใจ',
    'evidence_source'        => 'ระบบเฝ้าระวังโรคจากมลพิษสิ่งแวดล้อม กรมควบคุมโรค',
]);

$s4_schools = $db->insert('stakeholders', [
    'project_id'             => $p4Id,
    'name'                   => 'ศูนย์พัฒนาเด็กเล็กและโรงเรียนสังกัด อปท.',
    'category'               => 'Local authorities and municipalities',
    'stakeholder_group'      => 'project_supporter',
    'group_code'             => 'S3',
    'role_in_project'        => 'Host Institution',
    'estimated_count'        => 8,
    'count_unit'             => 'แห่ง',
    'support_type'           => 'พื้นที่ติดตั้งห้องปลอดฝุ่นและงบสนับสนุนการบำรุงรักษา',
    'evidence_source'        => 'บันทึกข้อตกลง อปท. และมหาวิทยาลัย',
]);

$p4Costs = [
    ['capex', 'เครื่องฟอกอากาศประสิทธิภาพสูงระบบ HEPA H14 สำหรับห้องเรียนเด็กเล็ก', 112000.0, 0, 1, 'quantity', 16, 'เครื่อง', 7000.0, 'ใบสั่งซื้อเครื่องฟอกอากาศมาตรฐาน มอก.', $s4_schools],
    ['capex', 'เซนเซอร์ตรวจวัดคุณภาพอากาศ IoT และจอแสดงผลดัชนีคุณภาพอากาศ (AQI)', 48000.0, 0, 1, 'quantity', 8, 'ชุด', 6000.0, 'ใบเสนอราคาระบบตรวจวัดคุณภาพอากาศ IoT', null],
    ['opex', 'ค่าเปลี่ยนแผ่นกรองอากาศ HEPA และการบำรุงรักษาระบบระบายอากาศ (รายปี)', 36000.0, 0, 1, 'manual', null, null, null, 'สัญญาบริการบำรุงรักษาระบบกรองอากาศ', null],
    ['delivery', 'คู่มือแนวทางการจัดทำห้องปลอดฝุ่นและการจัดอบรมครูผู้ดูแลเด็ก', 24000.0, 0, 1, 'manual', null, null, null, 'ใบเบิกค่าใช้จ่ายการจัดอบรมเชิงปฏิบัติการ', null],
];
foreach ($p4Costs as [$cat, $desc, $amt, $yr, $cash, $mode, $qty, $unit, $price, $ev, $stkId]) {
    $db->insert('project_costs', [
        'project_id'             => $p4Id,
        'stakeholder_id'         => $stkId,
        'category'               => $cat,
        'description'            => $desc,
        'amount'                 => $amt,
        'currency'               => 'THB',
        'exchange_rate'          => 1.0,
        'year'                   => $yr,
        'period_label'           => 'Y0',
        'is_cash'                => $cash,
        'calculation_mode'       => $mode,
        'quantity'               => $qty,
        'unit'                   => $unit,
        'unit_price'             => $price,
        'include_in_calculation' => 1,
        'evidence_source'        => $ev,
    ]);
}

$inpatientHospitalCommunityProxy = $proxyMap['ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลชุมชนแม่ข่าย']['value'] ?? 13721.0;
$o4_1 = $db->insert('outcomes', [
    'project_id'         => $p4Id,
    'stakeholder_id'     => $s4_children,
    'proxy_id'           => $proxyMap['ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลชุมชนแม่ข่าย']['id'] ?? null,
    'name'               => 'การลดอัตราการเจ็บป่วยระบบทางเดินหายใจเฉียบพลันและการนอนโรงพยาบาลในเด็กเล็ก',
    'activity'           => 'การจัดทำห้องปลอดฝุ่น HEPA และมาตรการลดกิจกรรมกลางแจ้งเมื่อค่าฝุ่นเกินเกณฑ์',
    'output_description' => 'เด็กเล็ก 420 คนได้รับการปกป้องในห้องปลอดฝุ่นตลอดฤดูกาลวิกฤตฝุ่น 3 เดือนต่อปี',
    'indicator'          => 'จำนวนเด็กเล็กที่หลีกเลี่ยงการเจ็บป่วยจนต้องนอนรักษาใน รพ.',
    'baseline'           => 'อัตราป่วยทางเดินหายใจจนต้องนอน รพ. ในช่วงวิกฤตฝุ่น 12 รายต่อปี',
    'observed_result'    => 'ลดผู้ป่วยต้องนอน รพ. ได้ 8 รายต่อปี',
    'quantity'           => 8,
    'proxy_value'        => $inpatientHospitalCommunityProxy,
    'proxy_unit'         => 'คน / ปี',
    'proxy_source'       => 'ต้นทุนผู้ป่วยใน เฉลี่ยต่อ AdjRW: โรงพยาบาลชุมชนแม่ข่าย (สปสช.)',
    'proxy_rationale'    => 'การนอนรักษาโรคปอดอักเสบ/หลอดลมอักเสบในเด็กเล็กก่อให้เกิดต้นทุนทางสาธารณสุขสูง',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 3,
    'evidence_quality'   => 'measured',
]);

$o4_2 = $db->insert('outcomes', [
    'project_id'         => $p4Id,
    'stakeholder_id'     => $s4_children,
    'name'               => 'การลดการขาดเรียนและการประหยัดค่ารักษาพยาบาลผู้ป่วยนอกของครอบครัว',
    'activity'           => 'ระบบแจ้งเตือนมลพิษและการดูแลสุขภาพเด็กเล็ก',
    'output_description' => 'เด็กเล็กมีสุขภาพแข็งแรงขึ้น ลดการขาดเรียนเฉลี่ย 4 วันต่อคนต่อปี',
    'indicator'          => 'ค่าใช้จ่ายการพาบุตรหลานไปพบแพทย์คลินิกและค่ายาที่ประหยัดได้',
    'baseline'           => 'ค่าใช้จ่ายพาเด็กไปหาหมอคลินิกทางเดินหายใจเฉลี่ย 850 บาทต่อครั้ง',
    'observed_result'    => 'ประหยัดการไปหาหมอได้ 1 ครั้งต่อคนต่อปี ในกลุ่มเด็ก 180 คน',
    'quantity'           => 180,
    'proxy_value'        => 850.0,
    'proxy_unit'         => 'ครัวเรือน / ปี',
    'proxy_source'       => 'การสำรวจค่าใช้จ่ายในการรักษาพยาบาลโรคทางเดินหายใจในเด็กปฐมวัย',
    'proxy_rationale'    => 'มูลค่าค่ารักษาและค่ายาที่ผู้ปกครองไม่ต้องแบกรับ',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 3,
    'evidence_quality'   => 'external',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o4_1,
    'deadweight'    => 0.10,
    'attribution'   => 0.15,
    'displacement'  => 0.00,
    'drop_off'      => 0.05,
    'source'        => 'ข้อมูลสถิติโรงพยาบาลและการตรวจวัดค่าฝุ่นในห้องเรียน',
    'justification' => '10% ของครอบครัวมีเครื่องฟอกอากาศที่บ้านอยู่แล้ว และ 15% เป็นผลจากมาตรการปิดโรงเรียนของภาครัฐ',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o4_2,
    'deadweight'    => 0.15,
    'attribution'   => 0.10,
    'displacement'  => 0.00,
    'drop_off'      => 0.05,
    'source'        => 'แบบสำรวจผู้ปกครองศูนย์เด็กเล็ก',
    'justification' => '15% ของเด็กอาจมีภูมิต้านทานดีขึ้นตามวัย',
]);

$sc4_base = $db->insert('scenarios', [
    'project_id'  => $p4Id,
    'name'        => 'Base case',
    'kind'        => 'base',
    'description' => 'สมมติฐานการวิเคราะห์ระยะยาว 3 ปี คิดอัตราคิดลดสังคม 3.5%',
    'is_base'     => 1,
    'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
]);

$p4Row = $db->one('SELECT * FROM projects WHERE id = ?', [$p4Id]);
$c4 = $calcService->calculate($p4Row, $sc4_base, null, true);
echo "  -> Plan #$p4Id calculated: Investment = ฿" . number_format($c4['run']['investment']) .
     ", PV = ฿" . number_format($c4['run']['present_value']) .
     ", SROI = " . number_format((float)$c4['run']['sroi_ratio'], 2) . ":1\n";


// =========================================================================
// PLAN 5: Department-owned Plan (ภาควิชาอนามัยชุมชน under คณะสาธารณสุขศาสตร์)
// =========================================================================
echo "\nSeeding Plan 5 (Department-Owned): โครงการสุขาภิบาลอาหารและน้ำดื่มปลอดภัยในโรงเรียน...\n";

$p5Id = $db->insert('projects', [
    'organization_id'       => $orgId,
    'faculty_id'            => null,
    'department_id'         => $deptCommHealthId, // Community Health Department
    'name'                  => 'โครงการยกระดับสุขาภิบาลอาหารและระบบน้ำดื่มปลอดภัยในโรงเรียนประถมศึกษาพื้นที่สูง',
    'organization_name'     => 'ภาควิชาอนามัยชุมชน คณะสาธารณสุขศาสตร์',
    'description'           => 'การประเมิน SROI โครงการติดตั้งระบบกรองน้ำดื่มสะอาดและปรับปรุงมาตรฐานสุขาภิบาลโรงอาหารในโรงเรียนขยายโอกาสพื้นที่ห่างไกล (ระยะเวลาประเมิก 2 ปี)',
    'category'              => 'Health and wellbeing',
    'country'               => 'Thailand',
    'start_date'            => '2026-05-01',
    'end_date'              => '2028-04-30',
    'evaluation_type'       => 'evaluative',
    'currency'              => 'THB',
    'price_basis'           => 'constant 2026 prices',
    'analysis_period_years' => 2,
    'discount_rate'         => 0.035,
    'discount_base_year'    => 0,
    'investment_basis'      => 'nominal',
    'include_in_kind'       => 1,
    'status'                => 'ready',
    'created_by'            => $ownerId,
]);

$s5_students = $db->insert('stakeholders', [
    'project_id'             => $p5Id,
    'name'                   => 'นักเรียนและบุคลากรครูในโรงเรียนพื้นที่สูง',
    'category'               => 'Students and learners',
    'stakeholder_group'      => 'primary_beneficiary',
    'group_code'             => 'S1',
    'role_in_project'        => 'Target School',
    'estimated_count'        => 320,
    'count_unit'             => 'คน',
    'needs_or_problems'      => 'น้ำดื่มมีตะกอนและเชื้อแบคทีเรียปนเปื้อน ส่งผลให้เกิดโรคอุจจาระร่วงบ่อยครั้ง',
    'expected_positive'      => 'ได้ดื่มน้ำสะอาดผ่านมาตรฐาน ปลอดโรคระบบทางเดินอาหาร',
    'evidence_source'        => 'ผลตรวจวิเคราะห์คุณภาพน้ำดื่มทางจุลชีววิทยา',
]);

$p5Costs = [
    ['capex', 'ระบบเครื่องกรองน้ำดื่ม RO มาตรฐานอุตสาหกรรมพร้อมถังเก็บน้ำสแตนเลส', 65000.0, 0, 1, 'quantity', 2, 'ระบบ', 32500.0, 'ใบสั่งซื้อและตรวจรับเครื่องกรองน้ำ', null],
    ['opex', 'ไส้กรองและสารเคมีล้างระบบกรองน้ำรายปี', 18000.0, 0, 1, 'manual', null, null, null, 'สัญญาบริการเปลี่ยนไส้กรอง', null],
    ['delivery', 'ชุดอุปกรณ์ปรับปรุงสุขาภิบาลโรงอาหารและถาดหลุมสแตนเลส', 22000.0, 0, 1, 'manual', null, null, null, 'ใบตรวจรับพัสดุสุขาภิบาลโรงเรียน', null],
];
foreach ($p5Costs as [$cat, $desc, $amt, $yr, $cash, $mode, $qty, $unit, $price, $ev, $stkId]) {
    $db->insert('project_costs', [
        'project_id'             => $p5Id,
        'stakeholder_id'         => $stkId,
        'category'               => $cat,
        'description'            => $desc,
        'amount'                 => $amt,
        'currency'               => 'THB',
        'exchange_rate'          => 1.0,
        'year'                   => $yr,
        'period_label'           => 'Y0',
        'is_cash'                => $cash,
        'calculation_mode'       => $mode,
        'quantity'               => $qty,
        'unit'                   => $unit,
        'unit_price'             => $price,
        'include_in_calculation' => 1,
        'evidence_source'        => $ev,
    ]);
}

$rphOutpatientProxy = $proxyMap['ต้นทุนบริการ รพ.สต. ต่อครั้ง: ผู้ป่วยนอก (ไม่รวมทันตกรรม)']['value'] ?? 180.0;
$o5_1 = $db->insert('outcomes', [
    'project_id'         => $p5Id,
    'stakeholder_id'     => $s5_students,
    'proxy_id'           => $proxyMap['ต้นทุนบริการ รพ.สต. ต่อครั้ง: ผู้ป่วยนอก (ไม่รวมทันตกรรม)']['id'] ?? null,
    'name'               => 'การลดการป่วยด้วยโรคอุจจาระร่วงเฉียบพลันและการรักษาพยาบาลที่ รพ.สต.',
    'activity'           => 'ติดตั้งระบบกรองน้ำดื่มสะอาดและการอบรมสุขาภิบาลแม่ครัว',
    'output_description' => 'นักเรียนและครู 320 คนมีน้ำดื่มสะอาดบริโภคตลอดปีการศึกษา',
    'indicator'          => 'จำนวนครั้งการเข้ารับการรักษาโรคระบบทางเดินอาหารที่ รพ.สต.',
    'baseline'           => 'มีผู้ป่วยอุจจาระร่วงในโรงเรียนเฉลี่ย 120 ครั้งต่อปี',
    'observed_result'    => 'ลดลงเหลือไม่เกิน 20 ครั้งต่อปี (ลดลง 100 ครั้ง)',
    'quantity'           => 100,
    'proxy_value'        => $rphOutpatientProxy,
    'proxy_unit'         => 'ครั้ง / ปี',
    'proxy_source'       => 'ต้นทุนบริการ รพ.สต. ต่อครั้ง: ผู้ป่วยนอก (ไม่รวมทันตกรรม)',
    'proxy_rationale'    => 'ต้นทุนบริการสาธารณสุขของ รพ.สต. ที่ประหยัดได้จากการลดโรคระบาดในโรงเรียน',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 2,
    'evidence_quality'   => 'measured',
]);

$o5_2 = $db->insert('outcomes', [
    'project_id'         => $p5Id,
    'stakeholder_id'     => $s5_students,
    'name'               => 'การประหยัดค่าใช้จ่ายจัดซื้อน้ำดื่มบรรจุถังของโรงเรียนและผู้ปกครอง',
    'activity'           => 'ผลิตน้ำดื่มสะอาดได้เองภายในโรงเรียน',
    'output_description' => 'ผลิตน้ำดื่มสะอาดได้วันละ 500 ลิตรสำหรับครูและนักเรียน',
    'indicator'          => 'มูลค่าน้ำดื่มบรรจุถังที่โรงเรียนต้องสั่งซื้อลดลง',
    'baseline'           => 'โรงเรียนต้องซื้อน้ำดื่มถัง 20 ลิตร สัปดาห์ละ 30 ถัง (ถังละ 15 บาท)',
    'observed_result'    => 'โรงเรียนไม่ต้องจัดซื้อน้ำถังจากภายนอก ประหยัดได้ 1,800 บาทต่อเดือน',
    'quantity'           => 10,
    'proxy_value'        => 1800.0 * 8, // 14,400 THB ต่อปี (8 เดือนการศึกษา)
    'proxy_unit'         => 'โรงเรียน / ปี',
    'proxy_source'       => 'ใบแจ้งหนี้จัดซื้อน้ำดื่มของโรงเรียน',
    'proxy_rationale'    => 'งบประมาณค่าอาหารกลางวันและน้ำดื่มที่โรงเรียนประหยัดได้จริง',
    'polarity'           => 'positive',
    'projection_model'   => 'cohort',
    'duration_years'     => 2,
    'evidence_quality'   => 'measured',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o5_1,
    'deadweight'    => 0.10,
    'attribution'   => 0.10,
    'displacement'  => 0.00,
    'drop_off'      => 0.05,
    'source'        => 'สถิติการป่วย รพ.สต.',
    'justification' => '10% อาจเกิดจากอาหารที่รับประทานจากบ้าน',
]);

$db->insert('impact_adjustments', [
    'outcome_id'    => $o5_2,
    'deadweight'    => 0.05,
    'attribution'   => 0.05,
    'displacement'  => 0.00,
    'drop_off'      => 0.00,
    'source'        => 'ใบเบิกเงินงบประมาณโรงเรียน',
    'justification' => 'ประหยัดได้โดยตรงจากระบบกรองน้ำของโครงการ',
]);

$sc5_base = $db->insert('scenarios', [
    'project_id'  => $p5Id,
    'name'        => 'Base case',
    'kind'        => 'base',
    'description' => 'สมมติฐานการวิเคราะห์ 2 ปีตามอายุรอบไส้กรอง',
    'is_base'     => 1,
    'assumptions' => json_encode(['global' => [], 'outcomes' => []]),
]);

$p5Row = $db->one('SELECT * FROM projects WHERE id = ?', [$p5Id]);
$c5 = $calcService->calculate($p5Row, $sc5_base, null, true);
echo "  -> Plan #$p5Id calculated: Investment = ฿" . number_format($c5['run']['investment']) .
     ", PV = ฿" . number_format($c5['run']['present_value']) .
     ", SROI = " . number_format((float)$c5['run']['sroi_ratio'], 2) . ":1\n";



echo "\n========================================================\n";
echo "Seeding Completed Successfully!\n";
echo "Summary of Seeded SROI Plans:\n";
$allSeeded = $db->all("
    SELECT p.id, p.name, p.calc_method, 
           CASE WHEN p.faculty_id IS NOT NULL THEN 'Faculty: ' || f.name 
                WHEN p.department_id IS NOT NULL THEN 'Dept: ' || d.name 
                ELSE 'Org Level' END AS direct_owner,
           r.sroi_ratio, r.investment, r.present_value
    FROM projects p
    LEFT JOIN faculties f ON f.id = p.faculty_id
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN calculation_runs r ON r.id = (
        SELECT id FROM calculation_runs WHERE project_id = p.id ORDER BY id DESC LIMIT 1
    )
    WHERE p.organization_id = ?
    ORDER BY p.id ASC
", [$orgId]);

foreach ($allSeeded as $row) {
    echo sprintf(
        " [#%d] %-60s | %-32s | Ratio: %-6s | Inv: %10s | PV: %10s\n",
        $row['id'],
        mb_substr($row['name'], 0, 58),
        $row['direct_owner'],
        $row['sroi_ratio'] !== null ? number_format((float)$row['sroi_ratio'], 2) : 'N/A',
        $row['investment'] !== null ? number_format((float)$row['investment']) : 'N/A',
        $row['present_value'] !== null ? number_format((float)$row['present_value']) : 'N/A'
    );
}
echo "========================================================\n";
