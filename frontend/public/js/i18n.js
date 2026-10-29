/**
 * SROI Analytics — Internationalization (i18n) Module
 * Supports English ('en') and Thai ('th')
 * Persists selection to localStorage ('sroi_lang')
 */

const STORAGE_KEY = 'sroi_lang';
const DEFAULT_LANG = 'th';

const listeners = new Set();

export const translations = {
  th: {
    // Navigation
    nav_projects: 'พื้นที่ทำงานโครงการ',
    nav_calculator: 'เครื่องคำนวณ SROI',
    nav_org: 'คณะและภาควิชา',
    nav_reports: 'รายงานและการตรวจสอบ',
    nav_about: 'ระเบียบวิธีและหลักการ',
    nav_auth: 'บัญชีและองค์กร',
    nav_faculty_report: 'รายงานระดับคณะ',

    // Shell & Header
    app_title: 'เครื่องคำนวณ ImpactValue SROI',
    toggle_sidebar: 'ย่อหรือขยายเมนู',
    theme_light: 'โหมดสว่าง (Light)',
    theme_black: 'โหมดมืด (Black)',
    theme_switch: 'เปลี่ยนธีม',
    lang_switch: 'เปลี่ยนภาษา',
    lang_th: 'ไทย',
    lang_en: 'English',
    view_account: 'ดูข้อมูลบัญชี',

    // Common Actions & Labels
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    delete: 'ลบ',
    edit: 'แก้ไข',
    close: 'ปิด',
    back: 'ย้อนกลับ',
    next: 'ถัดไป',
    previous: 'ก่อนหน้า',
    confirm: 'ยืนยัน',
    actions: 'การกระทำ',
    status: 'สถานะ',
    all: 'ทั้งหมด',
    search: 'ค้นหา',
    name: 'ชื่อ',
    description: 'คำอธิบาย',
    loading: 'กำลังโหลด...',
    required: 'จำเป็นต้องกรอก',
    currency: 'สกุลเงิน',
    year: 'ปี',
    years: 'ปี',
    baht: 'บาท',
    unit: 'หน่วย',
    total: 'รวมทั้งหมด',
    confirm_delete: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?',
    success: 'สำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    no_data: 'ยังไม่มีข้อมูล',

    // Projects Workspace
    projects_title: 'พื้นที่ทำงานโครงการ (Projects)',
    projects_subtitle: 'จัดการการประเมินผลกระทบทางสังคมและเลือกแผนงานเพื่อประเมิน SROI',
    btn_new_plan: 'สร้างแผนงาน SROI ใหม่',
    filter_org: 'องค์กร',
    filter_faculty: 'ตัวกรองคณะ',
    filter_dept: 'ตัวกรองภาควิชา',
    all_faculties: 'ทุกคณะและส่วนกลาง',
    all_departments: 'ทุกภาควิชา',
    col_project_name: 'ชื่อโครงการ / แผนงาน',
    col_owner: 'หน่วยงานเจ้าของ (คณะ / ภาควิชา)',
    col_target: 'กลุ่มเป้าหมาย',
    col_status: 'สถานะ',
    col_net_pv: 'มูลค่าปัจจุบันสุทธิ (NPV)',
    col_sroi_ratio: 'อัตราส่วน SROI',
    col_actions: 'จัดการ',
    btn_open_calculator: 'เปิดเครื่องคำนวณ',
    btn_edit_plan: 'แก้ไข',
    btn_delete_plan: 'ลบ',
    loading_projects: 'กำลังโหลดรายการโครงการจากฐานข้อมูล...',
    no_projects_found: 'ไม่พบโครงการที่ตรงกับเงื่อนไขการกรอง',
    create_first_plan: 'เริ่มต้นโดยการสร้างแผนงาน SROI แรกของคุณ',
    modal_new_project_title: 'สร้างแผนงาน SROI ใหม่',
    modal_edit_project_title: 'แก้ไขแผนงาน SROI',
    field_plan_name: 'ชื่อแผนงาน / โครงการ',
    field_plan_name_placeholder: 'เช่น โครงการส่งเสริมทักษะอาชีพชุมชน ปี 2568',
    field_plan_desc: 'คำอธิบายโครงการ / วัตถุประสงค์',
    field_target_pop: 'กลุ่มเป้าหมายที่ได้รับประโยชน์',
    field_owner_type: 'ประเภทหน่วยงานเจ้าของแผนงาน',
    owner_faculty_direct: 'คณะเป็นเจ้าของโดยตรง (Faculty-owned)',
    owner_dept_direct: 'ภาควิชาเป็นเจ้าของโดยตรง (Dept-owned)',
    owner_general: 'ส่วนกลาง / ไม่ระบุคณะ',
    field_faculty: 'คณะที่สังกัด',
    field_department: 'ภาควิชาที่สังกัด',
    field_currency: 'สกุลเงิน',
    field_discount_rate: 'อัตราคิดลดต่อปี (%)',
    field_analysis_period: 'ระยะเวลาประเมิน (ปี)',
    alert_double_count_safe: 'ระบบมีการป้องกันการนับซ้ำ: แต่ละแผนงานเป็นของคณะหรือภาควิชาเพียงระดับเดียว',

    // Stepper (6 Stages)
    step1_title: '1. โครงการและต้นทุน',
    step1_desc: 'ขอบเขตและการลงทุน',
    step2_title: '2. ผู้มีส่วนได้ส่วนเสีย',
    step2_desc: 'กลุ่มที่ได้รับผลกระทบ',
    step3_title: '3. ผลลัพธ์และตัวแทน',
    step3_desc: 'การเปลี่ยนแปลงและการประเมินมูลค่า',
    step4_title: '4. การปรับปรุงผลกระทบ',
    step4_desc: 'ส่วนเกินและการลดลง (Deadweight)',
    step5_title: '5. ทบทวนและแบบจำลอง',
    step5_desc: 'สมมติฐานและการทดสอบ',
    step6_title: '6. แดชบอร์ดและรายงาน',
    step6_desc: 'ผลลัพธ์และการส่งออก',

    // Wizard Step 1: Project & Costs
    step1_heading: 'ขั้นตอนที่ 1: ข้อมูลโครงการและการลงทุน',
    step1_subheading: 'กำหนดขอบเขต ระยะเวลาประเมิน และบันทึกต้นทุนเงินลงทุนทั้งหมดของโครงการ',
    btn_add_cost: 'เพิ่มรายการต้นทุน',
    col_cost_cat: 'หมวดหมู่',
    col_cost_desc: 'รายละเอียดต้นทุน',
    col_cost_amount: 'จำนวนเงิน',
    col_cost_year: 'ปีที่ลงทุน',
    cost_total_investment: 'เงินลงทุนรวมทั้งโครงการ',
    modal_add_cost_title: 'เพิ่มรายการต้นทุน',
    modal_edit_cost_title: 'แก้ไขรายการต้นทุน',
    cost_cat_personnel: 'บุคลากร / ค่าตอบแทน',
    cost_cat_operational: 'ค่าดำเนินงาน / กิจกรรม',
    cost_cat_capital: 'ครุภัณฑ์ / สินทรัพย์ลงทุน',
    cost_cat_inkind: 'สิ่งสนับสนุนอื่นที่ไม่ใช่ตัวเงิน (In-Kind)',

    // Wizard Step 2: Stakeholders
    step2_heading: 'ขั้นตอนที่ 2: การระบุผู้มีส่วนได้ส่วนเสีย',
    step2_subheading: 'ระบุกลุ่มคนที่เกิดการเปลี่ยนแปลงจากโครงการ ไม่ว่าทางตรงหรือทางอ้อม',
    btn_add_stakeholder: 'เพิ่มกลุ่มผู้มีส่วนได้ส่วนเสีย',
    col_stakeholder_name: 'ชื่อกลุ่มผู้มีส่วนได้ส่วนเสีย',
    col_stakeholder_desc: 'รายละเอียด / บทบาท',
    col_stakeholder_count: 'จำนวนคนในกลุ่ม',
    col_stakeholder_outcomes: 'จำนวนผลลัพธ์',
    modal_add_stakeholder_title: 'เพิ่มกลุ่มผู้มีส่วนได้ส่วนเสีย',
    modal_edit_stakeholder_title: 'แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย',

    // Wizard Step 3: Outcomes & Proxies
    step3_heading: 'ขั้นตอนที่ 3: ผลลัพธ์และตัวแทนทางการเงิน (Financial Proxies)',
    step3_subheading: 'ระบุผลลัพธ์ที่เกิดการเปลี่ยนแปลงจริง และกำหนดมูลค่าทางการเงินที่เทียบเท่า',
    btn_add_outcome: 'เพิ่มผลลัพธ์',
    col_outcome_name: 'ผลลัพธ์ที่เกิดขึ้น',
    col_outcome_indicator: 'ตัวชี้วัด',
    col_outcome_proxy: 'ตัวแทนทางการเงิน (Proxy Value)',
    col_outcome_quantity: 'จำนวนผู้ได้รับผล',
    col_outcome_is_negative: 'ผลกระทบด้านลบ',
    modal_add_outcome_title: 'เพิ่มผลลัพธ์ใหม่',
    modal_edit_outcome_title: 'แก้ไขผลลัพธ์',

    // Wizard Step 4: Adjustments
    step4_heading: 'ขั้นตอนที่ 4: การปรับปรุงผลกระทบ (Impact Adjustments)',
    step4_subheading: 'หักผลลัพธ์ที่ไม่ควรนับรวม เพื่อป้องกันการกล่าวอ้างคุณค่าเกินจริง',
    field_deadweight: 'Deadweight % (ผลที่เกิดขึ้นเองได้)',
    field_attribution: 'Attribution % (ผลจากหน่วยงาน/ปัจจัยอื่น)',
    field_displacement: 'Displacement % (การย้ายที่ของผลกระทบ)',
    field_dropoff: 'Drop-off % ต่อปี (การลดลงของผลในแต่ละปี)',

    // Wizard Step 5: Review & Scenarios
    step5_heading: 'ขั้นตอนที่ 5: ทบทวนและจำลองสถานการณ์ (Scenarios)',
    step5_subheading: 'ทดสอบความอ่อนไหวของผลลัพธ์ตามสมมติฐานที่หลากหลาย',
    scenario_base: 'สถานการณ์ปกติ (Base Case)',
    scenario_conservative: 'สถานการณ์ระมัดระวัง (Conservative)',
    scenario_optimistic: 'สถานการณ์เชิงบวก (Optimistic)',
    tornado_analysis: 'การวิเคราะห์ Tornado Sensitivity',

    // Wizard Step 6: Dashboard & Reports
    step6_heading: 'ขั้นตอนที่ 6: ผลลัพธ์และการวิเคราะห์ SROI',
    step6_subheading: 'สรุปอัตราส่วนผลตอบแทนทางสังคม มูลค่าปัจจุบัน และการกระจายผลประโยชน์',
    card_sroi_ratio: 'อัตราส่วน SROI',
    card_net_impact: 'มูลค่าปัจจุบันสุทธิ (NPV)',
    card_total_benefits: 'มูลค่าผลประโยชน์รวม (PV Benefits)',
    card_total_investment: 'เงินลงทุนคิดลดรวม (PV Costs)',
    card_payback_period: 'ระยะเวลาคืนทุนทางสังคม',
    btn_export_pdf: 'ส่งออกรายงาน PDF',
    btn_export_excel: 'ส่งออกข้อมูล Excel',
    yearly_pv_title: 'มูลค่าปัจจุบันรายปี',
    yearly_pv_desc: 'หลังหัก Deadweight, Attribution, Drop-off และคิดลดแล้ว',

    // Org (Faculties & Depts)
    org_title: 'โครงสร้างคณะและภาควิชา',
    org_subtitle: 'จัดการรายชื่อคณะ ภาควิชา และการกำกับดูแลแผนงาน SROI',
    btn_add_faculty: 'เพิ่มคณะใหม่',
    btn_add_department: 'เพิ่มภาควิชาใหม่',
    faculty_list_heading: 'รายชื่อคณะ',
    dept_list_heading: 'รายชื่อภาควิชา',
    col_code: 'รหัส',
    col_faculty_name: 'ชื่อคณะ',
    col_dept_count: 'จำนวนภาควิชา',
    col_plans_count: 'จำนวนแผนงาน',
    col_department_name: 'ชื่อภาควิชา',
    col_belongs_faculty: 'สังกัดคณะ',

    // Reports View
    reports_title: 'รายงานและการตรวจสอบ (Reports & Audit)',
    reports_subtitle: 'ตรวจสอบประวัติการคำนวณและดาวน์โหลดรายงานการประเมิน',

    // Methodology (About)
    about_eyebrow: 'SOCIAL RETURN ON INVESTMENT',
    about_hero_title: 'วัดคุณค่าที่โครงการสร้างให้สังคม',
    about_hero_desc: 'SROI (Social Return on Investment) คือแนวทางประเมินคุณค่าทางสังคม เศรษฐกิจ และสิ่งแวดล้อมที่เกิดจากโครงการ โดยเปรียบเทียบมูลค่าผลลัพธ์ที่เกิดขึ้นกับเงินลงทุน',
    about_q_title: 'SROI ช่วยให้เราเข้าใจอะไร?',
    about_q_desc: 'มองให้ไกลกว่าตัวเลขรายรับและรายจ่าย',
    about_read_title: 'อ่านค่า SROI อย่างไร?',
    about_read_desc: 'ตัวอย่างการตีความอัตราส่วน',
    about_ratio_sample: '3 : 1',
    about_ratio_label: 'ตัวอย่างอัตราส่วน SROI',
    about_ratio_explain: 'หมายถึง ทุกการลงทุน 1 บาท สร้างมูลค่าผลลัพธ์ทางสังคมที่ประเมินได้ประมาณ 3 บาท ภายใต้สมมติฐานและวิธีประเมินของโครงการนั้น',
    about_ratio_note: 'อัตราส่วนนี้เป็นเพียงตัวอย่าง ไม่ใช่ผลการประเมินของโครงการใดโดยเฉพาะ',
    about_steps_title: 'ประเมิน SROI อย่างไร?',
    about_steps_desc: 'ขั้นตอนหลักในการประเมินผลตอบแทนทางสังคม',
    about_terms_title: 'คำศัพท์สำคัญในการปรับปรุงผลลัพธ์',
    about_terms_desc: 'ความหมายของคำที่ใช้ในตารางและการคำนวณ',

    // Auth View
    auth_title: 'บัญชีผู้ใช้และองค์กร',
    auth_subtitle: 'การควบคุมการเข้าถึงและการกำหนดสิทธิ์ในระดับองค์กร',
    auth_signed_in_as: 'เข้าสู่ระบบในชื่อ:',
    btn_sign_out: 'ออกจากระบบ',
    btn_go_projects: 'ไปยังพื้นที่ทำงานโครงการ →',
    tab_sign_in: 'เข้าสู่ระบบ',
    tab_register: 'สร้างบัญชี',
    btn_quick_demo: '⚡ เข้าสู่ระบบแบบทดสอบด่วน',
    field_email: 'อีเมล',
    field_password: 'รหัสผ่าน',
    field_full_name: 'ชื่อ-นามสกุล',
  },

  en: {
    // Navigation
    nav_projects: 'Projects Workspace',
    nav_calculator: 'SROI Calculator',
    nav_org: 'Faculties & Depts',
    nav_reports: 'Reports & Audit',
    nav_about: 'Methodology & Principles',
    nav_auth: 'Account & Org',
    nav_faculty_report: 'Faculty Report',

    // Shell & Header
    app_title: 'ImpactValue SROI Calculator',
    toggle_sidebar: 'Toggle menu',
    theme_light: 'Light Theme',
    theme_black: 'Black Theme',
    theme_switch: 'Switch Theme',
    lang_switch: 'Switch Language',
    lang_th: 'ไทย',
    lang_en: 'English',
    view_account: 'View Account',

    // Common Actions & Labels
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    confirm: 'Confirm',
    actions: 'Actions',
    status: 'Status',
    all: 'All',
    search: 'Search',
    name: 'Name',
    description: 'Description',
    loading: 'Loading...',
    required: 'Required',
    currency: 'Currency',
    year: 'Year',
    years: 'Years',
    baht: 'THB',
    unit: 'Unit',
    total: 'Total',
    confirm_delete: 'Are you sure you want to delete this item?',
    success: 'Success',
    error: 'Error',
    no_data: 'No data available',

    // Projects Workspace
    projects_title: 'Projects Workspace',
    projects_subtitle: 'Manage social impact assessments and select a plan to evaluate SROI',
    btn_new_plan: 'New SROI Plan',
    filter_org: 'Organization',
    filter_faculty: 'Faculty Filter',
    filter_dept: 'Department Filter',
    all_faculties: 'All Faculties & General',
    all_departments: 'All Departments',
    col_project_name: 'Project / Plan Name',
    col_owner: 'Owner Unit (Faculty / Dept)',
    col_target: 'Target Group',
    col_status: 'Status',
    col_net_pv: 'Net PV',
    col_sroi_ratio: 'SROI Ratio',
    col_actions: 'Actions',
    btn_open_calculator: 'Open Calculator',
    btn_edit_plan: 'Edit',
    btn_delete_plan: 'Delete',
    loading_projects: 'Loading projects from database...',
    no_projects_found: 'No projects found matching the filter criteria.',
    create_first_plan: 'Get started by creating your first SROI plan.',
    modal_new_project_title: 'Create New SROI Plan',
    modal_edit_project_title: 'Edit SROI Plan',
    field_plan_name: 'Plan / Project Name',
    field_plan_name_placeholder: 'e.g. Community Skills Development Initiative 2025',
    field_plan_desc: 'Project Description / Objectives',
    field_target_pop: 'Target Beneficiaries',
    field_owner_type: 'Direct Ownership Level',
    owner_faculty_direct: 'Faculty Direct Owner (Faculty-level)',
    owner_dept_direct: 'Department Direct Owner (Department-level)',
    owner_general: 'General / No Faculty',
    field_faculty: 'Assigned Faculty',
    field_department: 'Assigned Department',
    field_currency: 'Currency',
    field_discount_rate: 'Annual Discount Rate (%)',
    field_analysis_period: 'Analysis Horizon (Years)',
    alert_double_count_safe: 'Double-counting safeguard active: Each plan is directly owned by exactly one entity level.',

    // Stepper (6 Stages)
    step1_title: '1. Project & Costs',
    step1_desc: 'Scope & Investment',
    step2_title: '2. Stakeholders',
    step2_desc: 'Affected Groups',
    step3_title: '3. Outcomes & Proxies',
    step3_desc: 'Changes & Valuation',
    step4_title: '4. Adjustments',
    step4_desc: 'Additionality & Drop-off',
    step5_title: '5. Review & Scenarios',
    step5_desc: 'Assumptions & Check',
    step6_title: '6. Dashboard & Reports',
    step6_desc: 'Results & Export',

    // Wizard Step 1: Project & Costs
    step1_heading: 'Step 1: Scope & Investment',
    step1_subheading: "Define the evaluation horizon, boundary, and record all project investment inputs.",
    btn_add_cost: 'Add Cost Item',
    col_cost_cat: 'Category',
    col_cost_desc: 'Description',
    col_cost_amount: 'Amount',
    col_cost_year: 'Incurred Year',
    cost_total_investment: 'Total Project Investment',
    modal_add_cost_title: 'Add Investment Cost',
    modal_edit_cost_title: 'Edit Investment Cost',
    cost_cat_personnel: 'Personnel & Labor',
    cost_cat_operational: 'Operational & Activities',
    cost_cat_capital: 'Capital & Equipment',
    cost_cat_inkind: 'In-Kind / Donated Resources',

    // Wizard Step 2: Stakeholders
    step2_heading: 'Step 2: Stakeholder Identification',
    step2_subheading: 'Identify all groups experiencing material change as a result of the initiative.',
    btn_add_stakeholder: 'Add Stakeholder Group',
    col_stakeholder_name: 'Stakeholder Group Name',
    col_stakeholder_desc: 'Description / Role',
    col_stakeholder_count: 'Group Size (People)',
    col_stakeholder_outcomes: 'Outcomes Count',
    modal_add_stakeholder_title: 'Add Stakeholder Group',
    modal_edit_stakeholder_title: 'Edit Stakeholder Group',

    // Wizard Step 3: Outcomes & Proxies
    step3_heading: 'Step 3: Outcomes & Financial Proxies',
    step3_subheading: 'Record measurable changes experienced by stakeholders and apply monetary proxy values.',
    btn_add_outcome: 'Add Outcome',
    col_outcome_name: 'Outcome Description',
    col_outcome_indicator: 'Indicator',
    col_outcome_proxy: 'Financial Proxy Value',
    col_outcome_quantity: 'Quantity of Beneficiaries',
    col_outcome_is_negative: 'Negative Outcome (Harm)',
    modal_add_outcome_title: 'Add New Outcome',
    modal_edit_outcome_title: 'Edit Outcome',

    // Wizard Step 4: Adjustments
    step4_heading: 'Step 4: Impact Adjustments (Additionality)',
    step4_subheading: 'Deduct factors to ensure the analysis does not over-claim change.',
    field_deadweight: 'Deadweight % (Would have happened anyway)',
    field_attribution: 'Attribution % (Caused by other contributors)',
    field_displacement: 'Displacement % (Displaced from elsewhere)',
    field_dropoff: 'Annual Drop-off % (Outcome fade over time)',

    // Wizard Step 5: Review & Scenarios
    step5_heading: 'Step 5: Review & Scenario Analysis',
    step5_subheading: 'Test the sensitivity of the SROI results against varied plausible assumptions.',
    scenario_base: 'Base Case Scenario',
    scenario_conservative: 'Conservative Scenario',
    scenario_optimistic: 'Optimistic Scenario',
    tornado_analysis: 'Tornado Sensitivity Analysis',

    // Wizard Step 6: Dashboard & Reports
    step6_heading: 'Step 6: SROI Analytics Dashboard',
    step6_subheading: 'Comprehensive social return ratio, net value created, and stakeholder distribution.',
    card_sroi_ratio: 'SROI Ratio',
    card_net_impact: 'Net Present Value (NPV)',
    card_total_benefits: 'Present Value of Benefits',
    card_total_investment: 'Present Value of Investment',
    card_payback_period: 'Social Payback Period',
    btn_export_pdf: 'Export PDF Report',
    btn_export_excel: 'Export Excel Workbook',
    yearly_pv_title: 'Annual Present Value Trends',
    yearly_pv_desc: 'Net discounted benefit values after deducting deadweight, attribution, and drop-off.',

    // Org (Faculties & Depts)
    org_title: 'Faculties & Departments Hierarchy',
    org_subtitle: 'Manage university organizational structure and configure plan ownership.',
    btn_add_faculty: 'Add Faculty',
    btn_add_department: 'Add Department',
    faculty_list_heading: 'Registered Faculties',
    dept_list_heading: 'Registered Departments',
    col_code: 'Code',
    col_faculty_name: 'Faculty Name',
    col_dept_count: 'Departments',
    col_plans_count: 'Owned Plans',
    col_department_name: 'Department Name',
    col_belongs_faculty: 'Assigned Faculty',

    // Reports View
    reports_title: 'Reports & Audit Log',
    reports_subtitle: 'Audit trail of model snapshots, sensitivity checks, and formal export records.',

    // Methodology (About)
    about_eyebrow: 'SOCIAL RETURN ON INVESTMENT',
    about_hero_title: 'Measuring Societal Impact and Value',
    about_hero_desc: 'SROI (Social Return on Investment) is an internationally recognized framework that accounts for broader social, environmental, and economic value relative to resources invested.',
    about_q_title: 'What Does SROI Help Us Understand?',
    about_q_desc: 'Looking beyond traditional revenue and accounting expenditures.',
    about_read_title: 'How to Interpret SROI Ratios?',
    about_read_desc: 'Example interpretation of return ratios.',
    about_ratio_sample: '3 : 1',
    about_ratio_label: 'Example SROI Ratio',
    about_ratio_explain: 'Indicates that every 1 Baht invested generated approximately 3 Baht in verified social and economic value, under the project’s specific evidence and assumptions.',
    about_ratio_note: 'This ratio is illustrative and does not represent any specific individual project.',
    about_steps_title: 'How is SROI Evaluated?',
    about_steps_desc: 'Key stages in the social return evaluation methodology.',
    about_terms_title: 'Key Adjustment Definitions',
    about_terms_desc: 'Terminology applied in adjustment deductions and present value formulas.',

    // Auth View
    auth_title: 'User Account & Organization',
    auth_subtitle: 'Role-based access control and organizational workspace administration.',
    auth_signed_in_as: 'Signed in as:',
    btn_sign_out: 'Sign Out',
    btn_go_projects: 'Go to Projects Workspace →',
    tab_sign_in: 'Sign In',
    tab_register: 'Create Account',
    btn_quick_demo: '⚡ Quick Demo Login',
    field_email: 'Email Address',
    field_password: 'Password',
    field_full_name: 'Full Name',
  },
};

/**
 * Get current active language code ('th' | 'en')
 */
export function getLanguage() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'th') return saved;
  }
  return DEFAULT_LANG;
}

/**
 * Set active language code and notify subscribers
 */
export function setLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'th';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, target);
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('lang', target);
  }
  listeners.forEach((fn) => {
    try {
      fn(target);
    } catch (e) {
      console.error('i18n listener error:', e);
    }
  });
}

/**
 * Translate a key into the active language, with optional fallback
 */
export function t(key, fallback = '') {
  const current = getLanguage();
  const dict = translations[current] || translations[DEFAULT_LANG];
  if (dict && typeof dict[key] !== 'undefined') {
    return dict[key];
  }
  // Try English fallback
  if (translations.en && typeof translations.en[key] !== 'undefined') {
    return translations.en[key];
  }
  return fallback || key;
}

/**
 * Subscribe to language change events
 */
export function subscribeLanguage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
