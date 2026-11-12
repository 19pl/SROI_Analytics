/**
 * Smart Input Assistance — configuration for S2, S3 and S4 (data only, no logic).
 *
 * S1 keeps its own presets (BENEFICIARY_PRESETS in step2Stakeholders.js). The lists below are written for
 * the role of each group and are intentionally NOT shared with S1.
 *
 * Shapes
 *   type option : { id, th, en, legacy?:[], tip:{th,en}, names?:[…], defaultName?, unit?, count?:{ph,th,en}, roleExtras?:[…] }
 *   chip item   : 'plain text'  |  { th, en }  |  { th, en, focus:true }  (focus = just focus the input, insert nothing)
 *
 * `legacy` lists values already stored in the database by the previous form (English keys / Thai labels), so
 * records saved before this change still open on the right option.
 * Nothing here is ever written into a numeric field: counts and amounts only appear as placeholders/examples.
 */

const T = (th, en) => ({ th, en });

/* ───────────────────────────── S2 — Project Implementers ───────────────────────────── */

export const S2_ASSIST = {
  hints: {
    type: T(
      'เลือกให้ใกล้เคียงที่สุด ระบบจะแนะนำตัวอย่างชื่อและบทบาทให้',
      'Pick the closest type — examples and role suggestions follow.',
    ),
    name: T(
      'ชื่อคณะ หน่วยงาน หรือทีมที่ลงมือดำเนินโครงการจริง',
      'The faculty, agency or team that actually runs the project.',
    ),
    period: T(
      'ช่วงเวลาที่ผู้ดำเนินโครงการนี้ทำงานในโครงการ',
      'How long this implementer works on the project.',
    ),
    count: T(
      'นับเฉพาะผู้ที่ร่วมดำเนินงานจริง เว้นว่างได้หากยังไม่ทราบ',
      'Only people who actually take part. Leave blank if unknown.',
    ),
    role: T(
      'หน้าที่หลักในโครงการ เลือกตัวอย่างด้านล่างแล้วแก้ไขต่อได้',
      'Main duties. Tap an example below, then edit freely.',
    ),
    resources: T(
      'คน เวลา อุปกรณ์ หรือยานพาหนะที่นำมาใช้ในโครงการ',
      'People, time, equipment or vehicles used.',
    ),
    description: T('ข้อมูลเพิ่มเติมเกี่ยวกับคณะทำงาน (ถ้ามี)', 'Any other notes about the team.'),
  },
  placeholders: {
    name: T(
      'เช่น คณะพยาบาลศาสตร์, ศูนย์บริการวิชาการ, ทีมวิจัยโครงการ',
      'e.g. Faculty of Nursing, Project Research Team',
    ),
    period: T(
      'เช่น ตลอดโครงการ 12 เดือน หรือ เดือนที่ 1-6',
      'e.g. Entire 12 months, or Months 1-6',
    ),
    count: T('เช่น 15', 'e.g. 15'),
    unit: T('เช่น คน, ทีม, หน่วยงาน', 'e.g. people, teams'),
    role: T(
      'เช่น วางแผนหลักสูตร จัดอบรม และให้บริการตรวจคัดกรองสายตา',
      'e.g. Plan curriculum and run eye-screening',
    ),
    resources: T(
      'เช่น อาจารย์ 4 คน, นักศึกษาจิตอาสา 8 คน, รถตู้ 1 คัน',
      'e.g. 4 faculty, 8 student volunteers, 1 van',
    ),
    description: T(
      'ข้อมูลเพิ่มเติมเกี่ยวกับคณะทำงาน...',
      'Further notes about the implementers...',
    ),
  },
  defaultUnit: 'คน',
  unitSuggestions: ['คน', 'ทีม', 'หน่วยงาน', 'กลุ่ม'],

  types: [
    {
      id: 'faculty',
      th: 'คณะ / สำนัก / ภาควิชาในมหาวิทยาลัย',
      en: 'Faculty / Office / Department',
      legacy: ['Faculty / Department', 'Research Center / Institute'],
      names: ['คณะพยาบาลศาสตร์', 'คณะสหเวชศาสตร์', 'ภาควิชาเวชศาสตร์ชุมชน', 'ศูนย์บริการวิชาการ'],
      tip: T(
        'ใส่ชื่อคณะหรือส่วนงานที่รับผิดชอบโครงการ หากมีหลายส่วนงานให้เพิ่มเป็นรายการแยกกัน',
        'Name the unit in charge. Add each unit as its own entry.',
      ),
      count: {
        ph: 'เช่น 10',
        th: 'นับอาจารย์และเจ้าหน้าที่ของส่วนงานที่ร่วมโครงการจริง',
        en: 'Count the lecturers and staff of this unit who take part.',
      },
      roleExtras: [T('กำกับดูแลทางวิชาการ', 'Academic supervision')],
    },
    {
      id: 'government',
      th: 'หน่วยงานภาครัฐ',
      en: 'Government agency',
      names: [
        'สำนักงานสาธารณสุขจังหวัด',
        'สำนักงานพัฒนาสังคมและความมั่นคงของมนุษย์จังหวัด',
        'สำนักงานเขตพื้นที่การศึกษา',
      ],
      tip: T(
        'ระบุชื่อหน่วยงานตามที่ปรากฏในหนังสือราชการ',
        'Use the agency name as in official documents.',
      ),
      count: {
        ph: 'เช่น 5',
        th: 'จำนวนเจ้าหน้าที่ของหน่วยงานที่ร่วมดำเนินโครงการ',
        en: 'Number of agency staff taking part.',
      },
      roleExtras: [T('กำกับดูแลและให้คำแนะนำเชิงนโยบาย', 'Policy oversight and guidance')],
    },
    {
      id: 'hospital',
      th: 'โรงพยาบาล / สถานพยาบาล',
      en: 'Hospital / Health facility',
      names: ['โรงพยาบาลมหาวิทยาลัย', 'โรงพยาบาลส่งเสริมสุขภาพตำบล', 'คลินิกจักษุ'],
      tip: T(
        'ระบุชื่อสถานพยาบาล และบอกว่าทำหน้าที่ตรวจ รักษา หรือส่งต่อ',
        'Name the facility and say whether it examines, treats or refers.',
      ),
      count: {
        ph: 'เช่น 6',
        th: 'จำนวนแพทย์ พยาบาล หรือเจ้าหน้าที่ที่ออกปฏิบัติงานโครงการ',
        en: 'Doctors, nurses or staff assigned to the project.',
      },
      roleExtras: [
        T('ให้บริการตรวจรักษาโรคตา', 'Provide eye examination/treatment'),
        T('ส่งต่อผู้ป่วยเพื่อรักษาต่อ', 'Refer patients for further care'),
      ],
    },
    {
      id: 'research_team',
      th: 'ทีมวิจัย / นักวิจัย',
      en: 'Research team / Researchers',
      legacy: ['Project Team / Researchers'],
      defaultName: 'ทีมวิจัยโครงการ',
      names: ['ทีมวิจัยโครงการ', 'นักวิจัยหลักและผู้ร่วมวิจัย'],
      tip: T(
        'ตั้งชื่อตามทีมจริงได้ เช่น ทีมวิจัยโครงการ ตามด้วยชื่อโครงการ',
        'Use your real team name, e.g. the project name + research team.',
      ),
      count: {
        ph: 'เช่น 5',
        th: 'นับหัวหน้าโครงการ นักวิจัย และผู้ช่วยวิจัย',
        en: 'Count the lead, researchers and assistants.',
      },
      roleExtras: [
        T('ออกแบบงานวิจัยและเก็บข้อมูล', 'Design research and collect data'),
        T('วิเคราะห์ข้อมูลและเขียนรายงาน', 'Analyse data and write reports'),
      ],
    },
    {
      id: 'academic_staff',
      th: 'อาจารย์ / บุคลากรทางการศึกษา',
      en: 'Lecturers / Education personnel',
      defaultName: 'อาจารย์และบุคลากรผู้ร่วมโครงการ',
      names: ['อาจารย์และบุคลากรผู้ร่วมโครงการ', 'อาจารย์ที่ปรึกษานักศึกษา'],
      tip: T(
        'ถ้าเป็นกลุ่มคนหลายคน ให้ตั้งชื่อกลุ่มแล้วใส่จำนวนในช่องจำนวนบุคลากร',
        'For a group of people, name the group and enter the number below.',
      ),
      count: {
        ph: 'เช่น 4',
        th: 'จำนวนอาจารย์และบุคลากรที่เข้าร่วม',
        en: 'Lecturers and staff taking part.',
      },
      roleExtras: [T('ให้คำปรึกษาและสอนงานนักศึกษา', 'Mentor student volunteers')],
    },
    {
      id: 'project_staff',
      th: 'เจ้าหน้าที่โครงการ',
      en: 'Project staff',
      defaultName: 'เจ้าหน้าที่โครงการ',
      names: ['เจ้าหน้าที่โครงการ', 'เจ้าหน้าที่ประสานงานโครงการ'],
      tip: T(
        'เจ้าหน้าที่ที่จ้างหรือมอบหมายให้ทำงานโครงการโดยตรง',
        'Staff hired or assigned directly to the project.',
      ),
      count: {
        ph: 'เช่น 2',
        th: 'จำนวนเจ้าหน้าที่ที่ทำงานในโครงการ',
        en: 'Staff working on the project.',
      },
      roleExtras: [T('ดูแลเอกสารและการเงินโครงการ', 'Handle project paperwork and finance')],
    },
    {
      id: 'volunteer',
      th: 'อาสาสมัคร',
      en: 'Volunteers',
      defaultName: 'อาสาสมัครโครงการ',
      names: ['อาสาสมัครโครงการ', 'นักศึกษาจิตอาสา'],
      tip: T(
        'บอกด้วยว่าอาสาสมัครมาจากไหน เช่น นักศึกษา อสม. และใช้เวลากี่ชั่วโมง',
        'Say where volunteers come from and how much time they give.',
      ),
      count: {
        ph: 'เช่น 20',
        th: 'จำนวนอาสาสมัครที่มาช่วยจริง',
        en: 'Volunteers who actually helped.',
      },
      roleExtras: [
        T('ลงทะเบียนและอำนวยความสะดวกผู้เข้าร่วม', 'Registration and participant support'),
      ],
    },
    {
      id: 'private_org',
      th: 'องค์กรเอกชน',
      en: 'Private organisation',
      legacy: ['Civil Society / NGO'],
      names: ['บริษัท (ระบุชื่อ) จำกัด', 'ร้านแว่นตาพันธมิตร', 'มูลนิธิ (ระบุชื่อ)'],
      tip: T(
        'รวมบริษัท ร้านค้า มูลนิธิ และองค์กรภาคประชาสังคมที่ลงมือดำเนินงาน',
        'Includes companies, shops, foundations and NGOs that deliver the work.',
      ),
      count: {
        ph: 'เช่น 3',
        th: 'จำนวนผู้ปฏิบัติงานขององค์กรในโครงการ',
        en: 'Staff of the organisation working on the project.',
      },
      roleExtras: [T('ผลิตและส่งมอบสิ่งของตามข้อตกลง', 'Produce and deliver goods per agreement')],
    },
  ],

  /** Role quick-select (spec list). Type-specific extras are placed in front of these. */
  roleChips: [
    T('วางแผนและบริหารโครงการ', 'Plan and manage the project'),
    T('ดำเนินกิจกรรม', 'Run activities'),
    T('ตรวจวัดสายตา', 'Vision screening'),
    T('จัดหาและตัดแว่น', 'Procure and fit eyeglasses'),
    T('ประสานงานกับกลุ่มเป้าหมาย', 'Coordinate with target group'),
    T('ติดตามและประเมินผล', 'Monitor and evaluate'),
  ],

  periodChips: [
    T('ตลอดระยะเวลาโครงการ', 'Entire project duration'),
    T('1 เดือน', '1 month'),
    T('3 เดือน', '3 months'),
    T('6 เดือน', '6 months'),
    T('1 ปี', '1 year'),
    { th: 'กำหนดเอง', en: 'Custom', focus: true },
  ],

  resourceChips: [
    T('อาจารย์ / นักวิจัย', 'Lecturers / researchers'),
    T('นักศึกษาจิตอาสา', 'Student volunteers'),
    T('ยานพาหนะ', 'Vehicle'),
    T('อุปกรณ์ตรวจสายตา', 'Eye-screening equipment'),
    T('สถานที่ดำเนินงาน', 'Venue'),
  ],
};

/* ───────────────────────────── S3 — Project Supporters ───────────────────────────── */

export const S3_ASSIST = {
  hints: {
    type: T(
      'เลือกว่าผู้สนับสนุนรายนี้เป็นองค์กรประเภทใด',
      'What kind of organisation is this supporter?',
    ),
    name: T(
      'ชื่อผู้ให้การสนับสนุน หากมีหลายราย ให้เพิ่มแยกเป็นรายการ',
      'Who gives the support. Add each supporter separately.',
    ),
    supportType: T('สิ่งที่ผู้สนับสนุนมอบให้โครงการ', 'What the supporter gives to the project.'),
    value: T(
      'มูลค่าเป็นเงินบาท กรอกเฉพาะตัวเลข เว้นว่างได้หากยังไม่ทราบ',
      'Value in baht. Numbers only; leave blank if unknown.',
    ),
    amount: T('ระบุจำนวนพร้อมหน่วย', 'Give a quantity with its unit.'),
    description: T(
      'เงื่อนไข งวดเงิน หรือข้อตกลงของการสนับสนุน (ถ้ามี)',
      'Conditions, instalments or agreements (if any).',
    ),
  },
  placeholders: {
    name: T(
      'เช่น สำนักงานกองทุน สสส., เทศบาลตำบล, บริษัท ปตท. จำกัด',
      'e.g. Thai Health Promotion Foundation, Municipality, Donor',
    ),
    value: T('เช่น 10,000', 'e.g. 10,000'),
    amount: T('เช่น งบประมาณ 10,000 บาท, แว่นตา 30 อัน', 'e.g. Budget 10,000 THB, 30 eyeglasses'),
    description: T(
      'เช่น สนับสนุนเป็น 2 งวด และต้องส่งรายงานความก้าวหน้า',
      'e.g. Paid in 2 instalments with a progress report',
    ),
  },
  /** Format examples only — never inserted into the field. */
  valueExamples: ['5,000', '10,000', '50,000'],

  types: [
    {
      id: 'government',
      th: 'หน่วยงานภาครัฐ',
      en: 'Government agency',
      legacy: ['Government Agency / Fund'],
      names: [
        'สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ (สสส.)',
        'สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.)',
        'สำนักงานสาธารณสุขจังหวัด',
      ],
      tip: T(
        'ถ้าเป็นกองทุนของรัฐ ให้ใส่ชื่อกองทุนหรือสำนักงานที่เป็นผู้จ่ายเงินจริง',
        'For state funds, use the office that actually pays.',
      ),
    },
    {
      id: 'local_gov',
      th: 'องค์กรปกครองส่วนท้องถิ่น',
      en: 'Local government',
      legacy: ['Local Administration'],
      names: [
        'เทศบาลตำบลบ้านดู่',
        'องค์การบริหารส่วนตำบล (ระบุชื่อ)',
        'องค์การบริหารส่วนจังหวัด (ระบุชื่อ)',
      ],
      tip: T(
        'ระบุประเภทและชื่อ เช่น เทศบาลตำบล / อบต. / อบจ. ตามด้วยชื่อพื้นที่',
        'Give type and area, e.g. sub-district municipality + name.',
      ),
    },
    {
      id: 'company',
      th: 'บริษัทเอกชน',
      en: 'Private company',
      legacy: ['Private Sector / CSR'],
      names: ['บริษัท ปตท. จำกัด (มหาชน)', 'บริษัท (ระบุชื่อ) จำกัด', 'ธนาคาร (ระบุชื่อ)'],
      tip: T(
        'มักเป็นงบ CSR ให้ระบุชื่อบริษัทตามที่จดทะเบียน',
        'Often CSR money — use the registered company name.',
      ),
    },
    {
      id: 'foundation',
      th: 'มูลนิธิ / องค์กรไม่แสวงหากำไร',
      en: 'Foundation / Non-profit',
      legacy: ['Foundation / Donor'],
      names: ['สภากาชาดไทย', 'มูลนิธิสยามกัมมาจล', 'สโมสรโรตารี (ระบุชื่อ)'],
      tip: T('ระบุชื่อมูลนิธิหรือสมาคมที่ให้การสนับสนุน', 'Name the foundation or association.'),
    },
    {
      id: 'research_fund',
      th: 'แหล่งทุนวิจัย',
      en: 'Research funder',
      names: [
        'สำนักงานการวิจัยแห่งชาติ (วช.)',
        'กองทุนส่งเสริมวิทยาศาสตร์ วิจัยและนวัตกรรม',
        'ทุนวิจัยของมหาวิทยาลัย',
      ],
      tip: T(
        'ใส่ชื่อแหล่งทุนและเลขที่สัญญาทุน (ถ้ามี) ในรายละเอียดเพิ่มเติม',
        'Name the funder; put the grant number in the details.',
      ),
    },
    {
      id: 'donor',
      th: 'บุคคลทั่วไป / ผู้บริจาค',
      en: 'Individuals / Donors',
      legacy: [],
      defaultName: 'ผู้บริจาคทั่วไป',
      names: ['ผู้บริจาคทั่วไป', 'ศิษย์เก่าผู้บริจาค'],
      tip: T(
        'หากไม่ประสงค์ออกนาม ใช้ชื่อกลุ่ม เช่น ผู้บริจาคทั่วไป (ไม่ต้องใส่ข้อมูลส่วนบุคคล)',
        'Use a group name; no personal data needed.',
      ),
    },
    {
      id: 'education',
      th: 'สถาบันการศึกษา',
      en: 'Educational institution',
      legacy: ['University Division'],
      names: ['คณะสหเวชศาสตร์', 'มหาวิทยาลัย (ระบุชื่อ)', 'วิทยาลัยพยาบาล (ระบุชื่อ)'],
      tip: T(
        'รวมคณะหรือส่วนงานภายในมหาวิทยาลัยที่ให้ทุนหรือทรัพยากร',
        'Includes faculties/divisions that provide funds or resources.',
      ),
    },
  ],

  supportTypes: [
    {
      id: 'financial',
      th: 'เงินทุน (Financial / Grants)',
      en: 'Financial / Grants',
      legacy: ['เงินทุน'],
      money: true,
      tip: T('เงินที่โอนหรือจ่ายให้โครงการโดยตรง', 'Cash given directly to the project.'),
      amount: {
        ph: 'เช่น 10,000 บาท',
        th: 'ใส่จำนวนเงินที่ให้จริง เช่น 10,000 บาท',
        en: 'Actual cash given, e.g. 10,000 THB',
      },
      valueHint: T('จำนวนเงินที่สนับสนุนเป็นบาท', 'Amount of cash in baht.'),
    },
    {
      id: 'equipment',
      th: 'วัสดุและอุปกรณ์',
      en: 'Materials & equipment',
      legacy: ['สิ่งของ / อุปกรณ์'],
      tip: T(
        'ของที่มอบให้ใช้ในโครงการ เช่น แว่นตา วัสดุตรวจ',
        'Goods supplied, e.g. eyeglasses, screening supplies.',
      ),
      amount: {
        ph: 'เช่น แว่นสายตา 30 อัน',
        th: 'ระบุชนิดของและจำนวน เช่น แว่นสายตา 30 อัน',
        en: 'Item and quantity, e.g. 30 eyeglasses',
      },
      valueHint: T(
        'มูลค่าโดยประมาณของสิ่งของ (ราคาตลาด) เป็นบาท',
        'Approximate market value in baht.',
      ),
    },
    {
      id: 'personnel',
      th: 'บุคลากร',
      en: 'Personnel',
      legacy: ['บุคลากร / ผู้เชี่ยวชาญ'],
      tip: T(
        'คนที่มาช่วยงานโดยไม่คิดค่าแรงจากโครงการ',
        'People who help without being paid from the project.',
      ),
      amount: {
        ph: 'เช่น 5 คน',
        th: 'ระบุจำนวนคน เช่น 5 คน',
        en: 'Number of people, e.g. 5 people',
      },
      valueHint: T(
        'มูลค่าค่าแรงโดยประมาณเป็นบาท (ถ้าคำนวณได้)',
        'Approximate labour value in baht, if you can estimate.',
      ),
    },
    {
      id: 'venue',
      th: 'สถานที่',
      en: 'Venue',
      legacy: ['สถานที่ / ยานพาหนะ'],
      tip: T(
        'สถานที่หรือยานพาหนะที่ให้ใช้ฟรีหรือราคาพิเศษ',
        'Venue or vehicle provided free or at a discount.',
      ),
      amount: {
        ph: 'เช่น 1 แห่ง',
        th: 'ระบุจำนวนและหน่วย เช่น 1 แห่ง',
        en: 'Quantity and unit, e.g. 1 venue',
      },
      valueHint: T('มูลค่าค่าเช่าโดยประมาณเป็นบาท', 'Approximate rental value in baht.'),
    },
    {
      id: 'service',
      th: 'บริการหรือความเชี่ยวชาญ',
      en: 'Services or expertise',
      legacy: ['บริการ / สื่อประชาสัมพันธ์'],
      tip: T(
        'บริการเฉพาะทาง เช่น ตรวจสุขภาพตา การอบรม การให้คำปรึกษา',
        'Specialist services such as screening, training, consulting.',
      ),
      amount: {
        ph: 'เช่น ตรวจสุขภาพตา 2 ครั้ง',
        th: 'ระบุบริการและจำนวนครั้ง เช่น ตรวจสุขภาพตา 2 ครั้ง',
        en: 'Service and times, e.g. 2 screening sessions',
      },
      valueHint: T('มูลค่าบริการโดยประมาณเป็นบาท', 'Approximate service value in baht.'),
    },
    {
      id: 'publicity',
      th: 'ประชาสัมพันธ์',
      en: 'Publicity',
      tip: T('การเผยแพร่ข่าวหรือสื่อให้โครงการ', 'News or media coverage given to the project.'),
      amount: {
        ph: 'เช่น 3 ช่องทาง',
        th: 'ระบุช่องทางหรือจำนวนครั้ง เช่น 3 ช่องทาง',
        en: 'Channels or times, e.g. 3 channels',
      },
      valueHint: T(
        'มูลค่าสื่อโดยประมาณเป็นบาท (ถ้าทราบ)',
        'Approximate media value in baht, if known.',
      ),
    },
    {
      id: 'multi',
      th: 'สนับสนุนหลายรูปแบบ',
      en: 'Multiple types of support',
      legacy: ['ผสมผสานหลายรูปแบบ'],
      tip: T(
        'เขียนรายการทั้งหมดในช่องจำนวน และใส่มูลค่ารวมทุกรายการในช่องมูลค่า',
        'List everything in the quantity box; enter the combined value above.',
      ),
      amount: {
        ph: 'เช่น เงินทุน 10,000 บาท และแว่นสายตา 30 อัน',
        th: 'ระบุแต่ละรูปแบบพร้อมจำนวน',
        en: 'Each type with its quantity',
      },
      valueHint: T('มูลค่ารวมของทุกรูปแบบเป็นบาท', 'Combined value of all support in baht.'),
    },
  ],

  detailChips: [
    T('สนับสนุนครั้งเดียว', 'One-off support'),
    T('สนับสนุนเป็นงวด', 'Paid in instalments'),
    T('เบิกจ่ายตามความก้าวหน้าของโครงการ', 'Released by project milestones'),
    T('ต้องส่งรายงานความก้าวหน้า', 'Progress report required'),
    T('มีสัญญาหรือบันทึกข้อตกลงสนับสนุน', 'Written agreement in place'),
    T('เบิกจ่ายตามจริง', 'Reimbursed at actual cost'),
    T('ไม่มีเงื่อนไขพิเศษ', 'No special conditions'),
  ],
};

/* ───────────────────────────── S4 — Other Stakeholders ───────────────────────────── */

export const S4_ASSIST = {
  hints: {
    type: T(
      'เลือกประเภทหน่วยงานหรือกลุ่มที่ร่วมงานกับโครงการ',
      'What kind of agency or group is this partner?',
    ),
    name: T(
      'ชื่อหน่วยงานหรือกลุ่มที่ประสานงานกับโครงการ',
      'The agency or group that works with the project.',
    ),
    cooperation: T(
      'วิธีที่หน่วยงานนี้ร่วมมือกับโครงการ',
      'How this partner cooperates with the project.',
    ),
    count: T('เว้นว่างได้ หากยังไม่มีข้อมูลจำนวน', 'Leave blank if you do not have a number.'),
    role: T(
      'สิ่งที่หน่วยงานนี้ทำในโครงการ เลือกตัวอย่างแล้วแก้ไขต่อได้',
      'What this partner does. Tap an example, then edit.',
    ),
    resources: T(
      'สิ่งที่หน่วยงานนำมาสนับสนุน เช่น สถานที่ คน ข้อมูล',
      'What the partner contributes: venue, people, data.',
    ),
    description: T(
      'ข้อมูลเพิ่มเติมเกี่ยวกับหน่วยงานหรือข้อตกลง (ถ้ามี)',
      'Other notes about the partner or agreement.',
    ),
  },
  placeholders: {
    name: T(
      'เช่น รพ.สต. บ้านดู่, ชมรมผู้สูงอายุตำบล, เทศบาลตำบล',
      'e.g. Sub-district Health Promoting Hospital, Elderly Club',
    ),
    count: T('เช่น 5', 'e.g. 5'),
    unit: T('เช่น แห่ง, คน, กลุ่ม', 'e.g. agency, people, group'),
    role: T(
      'เช่น ช่วยประชาสัมพันธ์ คัดกรองเบื้องต้น และส่งต่อกลุ่มเป้าหมาย',
      'e.g. Publicise, pre-screen and refer',
    ),
    resources: T(
      'เช่น สถานที่จัดกิจกรรมใน รพ.สต., เจ้าหน้าที่ อสม. 10 ท่าน',
      'e.g. Venue at the health centre, 10 health volunteers',
    ),
    description: T(
      'ข้อมูลเพิ่มเติมเกี่ยวกับหน่วยงานหรือข้อตกลง...',
      'Further notes about the agency...',
    ),
  },
  defaultUnit: 'แห่ง',
  unitSuggestions: ['แห่ง', 'คน', 'กลุ่ม', 'หน่วยงาน', 'ทีม'],

  types: [
    {
      id: 'local_gov',
      th: 'องค์กรปกครองส่วนท้องถิ่น (อบต. / เทศบาล / อบจ.)',
      en: 'Local government (SAO / Municipality / PAO)',
      legacy: ['Local Administration'],
      unit: 'แห่ง',
      names: [
        'เทศบาลตำบลบ้านดู่',
        'องค์การบริหารส่วนตำบล (ระบุชื่อ)',
        'องค์การบริหารส่วนจังหวัด (ระบุชื่อ)',
      ],
      tip: T(
        'ถ้าร่วมมือกับหลายแห่ง ให้เพิ่มทีละแห่ง หรือใส่จำนวนแห่งในช่องจำนวน',
        'For several authorities, add each, or enter the number of sites.',
      ),
      count: {
        ph: 'เช่น 1',
        th: 'จำนวนหน่วยงานท้องถิ่นที่ร่วมมือ (หน่วย: แห่ง)',
        en: 'Number of local authorities (unit: sites).',
      },
    },
    {
      id: 'hospital',
      th: 'โรงพยาบาล / โรงพยาบาลส่งเสริมสุขภาพตำบล',
      en: 'Hospital / Sub-district health hospital',
      legacy: ['Health Center / Clinic'],
      unit: 'แห่ง',
      names: ['รพ.สต. บ้านดู่', 'โรงพยาบาลชุมชน (ระบุชื่อ)', 'โรงพยาบาลทั่วไปประจำจังหวัด'],
      tip: T(
        'ระบุชื่อสถานบริการ และบทบาท เช่น คัดกรอง ส่งต่อ หรือให้ใช้สถานที่',
        'Name the facility and its role: screening, referral, venue.',
      ),
      count: {
        ph: 'เช่น 2',
        th: 'จำนวนสถานบริการที่ร่วมมือ (หน่วย: แห่ง)',
        en: 'Number of facilities (unit: sites).',
      },
    },
    {
      id: 'public_health',
      th: 'หน่วยงานสาธารณสุข',
      en: 'Public health agency',
      unit: 'แห่ง',
      names: ['สำนักงานสาธารณสุขอำเภอ', 'สำนักงานสาธารณสุขจังหวัด', 'ศูนย์อนามัยเขต'],
      tip: T(
        'เหมาะกับสำนักงานสาธารณสุขหรือศูนย์อนามัยที่ช่วยกำกับดูแลหรือให้ข้อมูล',
        'For public-health offices that guide or provide data.',
      ),
      count: {
        ph: 'เช่น 1',
        th: 'จำนวนหน่วยงานที่ร่วมมือ (หน่วย: แห่ง)',
        en: 'Number of offices (unit: sites).',
      },
    },
    {
      id: 'elderly_club',
      th: 'ชมรมผู้สูงอายุ',
      en: 'Elderly club',
      unit: 'คน',
      names: ['ชมรมผู้สูงอายุตำบลบ้านดู่', 'ชมรมผู้สูงอายุหมู่ที่ (ระบุ)'],
      tip: T(
        'ใส่ชื่อชมรม แล้วใส่จำนวนสมาชิกที่เกี่ยวข้องเป็นหน่วย คน ถ้าทราบ',
        'Name the club; give related members in people, if known.',
      ),
      count: {
        ph: 'เช่น 40',
        th: 'จำนวนสมาชิกชมรมที่เกี่ยวข้อง (หน่วย: คน)',
        en: 'Related club members (unit: people).',
      },
    },
    {
      id: 'community_leader',
      th: 'ผู้นำชุมชน',
      en: 'Community leaders',
      legacy: ['Community Leaders / Volunteers'],
      unit: 'คน',
      defaultName: 'ผู้นำชุมชน',
      names: ['ผู้นำชุมชน', 'ผู้ใหญ่บ้านและกำนัน', 'อาสาสมัครสาธารณสุข (อสม.)'],
      tip: T(
        'ใช้ชื่อกลุ่ม เช่น ผู้นำชุมชน ไม่ต้องใส่ชื่อบุคคล',
        'Use a group name; personal names are not needed.',
      ),
      count: {
        ph: 'เช่น 8',
        th: 'จำนวนผู้นำหรืออาสาสมัครที่เกี่ยวข้อง (หน่วย: คน)',
        en: 'Leaders/volunteers involved (unit: people).',
      },
    },
    {
      id: 'civil_society',
      th: 'องค์กรภาคประชาสังคม',
      en: 'Civil society organisation',
      unit: 'กลุ่ม',
      names: ['กลุ่มสตรีตำบล', 'สภาองค์กรชุมชน', 'มูลนิธิ (ระบุชื่อ)'],
      tip: T(
        'กลุ่มหรือองค์กรของประชาชนที่ไม่ใช่หน่วยงานรัฐ',
        'Citizen groups or organisations outside government.',
      ),
      count: {
        ph: 'เช่น 2',
        th: 'จำนวนกลุ่มหรือองค์กรที่ร่วมมือ (หน่วย: กลุ่ม)',
        en: 'Number of groups (unit: groups).',
      },
    },
    {
      id: 'education',
      th: 'สถาบันการศึกษา',
      en: 'Educational institution',
      legacy: ['Local School / Education'],
      unit: 'แห่ง',
      names: ['โรงเรียนบ้านดู่', 'วิทยาลัยอาชีวศึกษา (ระบุชื่อ)', 'ศูนย์การเรียนรู้ชุมชน'],
      tip: T(
        'โรงเรียนหรือสถานศึกษาในพื้นที่ที่ร่วมมือกับโครงการ',
        'Local schools or institutions cooperating with the project.',
      ),
      count: {
        ph: 'เช่น 3',
        th: 'จำนวนสถานศึกษาที่ร่วมมือ (หน่วย: แห่ง)',
        en: 'Number of institutions (unit: sites).',
      },
    },
    {
      id: 'private_org',
      th: 'องค์กรเอกชน',
      en: 'Private organisation',
      legacy: ['Community Enterprise / Cooperative'],
      unit: 'แห่ง',
      names: [
        'วิสาหกิจชุมชน (ระบุชื่อ)',
        'สหกรณ์การเกษตร (ระบุชื่อ)',
        'ร้านค้าในพื้นที่ (ระบุชื่อ)',
      ],
      tip: T(
        'รวมวิสาหกิจชุมชน สหกรณ์ และธุรกิจท้องถิ่น',
        'Includes community enterprises, cooperatives, local businesses.',
      ),
      count: {
        ph: 'เช่น 2',
        th: 'จำนวนองค์กรที่ร่วมมือ (หน่วย: แห่ง)',
        en: 'Number of organisations (unit: sites).',
      },
    },
  ],

  cooperationTypes: [
    {
      id: 'mou',
      th: 'บันทึกข้อตกลงความร่วมมือ (MOU)',
      en: 'Memorandum of Understanding (MOU)',
      legacy: ['บันทึกข้อตกลงความร่วมมือ (MOU)', 'Memorandum of Understanding (MOU)'],
      tip: T(
        'ควรระบุชื่อเอกสารหรือปีที่ลงนามไว้ในรายละเอียดเพิ่มเติม',
        'Note the document name or signing year in the details.',
      ),
    },
    {
      id: 'referral',
      th: 'ประสานงานและส่งต่อกลุ่มเป้าหมาย',
      en: 'Coordination & referral',
      legacy: ['การประสานงานและส่งต่อกลุ่มเป้าหมาย', 'การประสานงานและส่งต่อ'],
      tip: T(
        'ระบุว่าส่งต่อกลุ่มเป้าหมายไปที่ใด หรือรับต่อจากผู้ใด',
        'Say where target-group members are referred to or from.',
      ),
    },
    {
      id: 'publicity',
      th: 'ประชาสัมพันธ์โครงการ',
      en: 'Project publicity',
      tip: T(
        'ระบุช่องทาง เช่น เสียงตามสาย การประชุมหมู่บ้าน กลุ่มไลน์',
        'Name the channel: loudspeaker, village meeting, chat group.',
      ),
    },
    {
      id: 'venue',
      th: 'สนับสนุนสถานที่',
      en: 'Provide venue',
      tip: T(
        'ระบุสถานที่ที่ให้ใช้ และกรอกเพิ่มในช่องทรัพยากรที่สนับสนุนด้านล่าง',
        'Say which venue, and add it under Resources below.',
      ),
    },
    {
      id: 'personnel',
      th: 'สนับสนุนบุคลากร',
      en: 'Provide personnel',
      tip: T(
        'ระบุประเภทและจำนวนบุคลากรที่มาช่วย หากทราบ',
        'Give the kind and number of people, if known.',
      ),
    },
    {
      id: 'data',
      th: 'สนับสนุนข้อมูล',
      en: 'Provide data',
      tip: T(
        'ระบุประเภทข้อมูล เช่น จำนวนผู้สูงอายุในพื้นที่ ไม่ต้องใส่ข้อมูลส่วนบุคคลลงในระบบ',
        'Say what data; do not enter personal data here.',
      ),
    },
    {
      id: 'joint',
      th: 'ร่วมดำเนินกิจกรรม',
      en: 'Co-deliver activities',
      legacy: ['ภาคีเครือข่ายร่วมดำเนินงาน'],
      tip: T(
        'ระบุกิจกรรมที่ทำร่วมกันในช่องบทบาทด้านล่าง',
        'Describe the joint activities in the role box below.',
      ),
    },
    {
      id: 'monitoring',
      th: 'ติดตามและประเมินผล',
      en: 'Monitoring & evaluation',
      tip: T('ระบุว่าติดตามอะไรและบ่อยแค่ไหน', 'Say what is monitored and how often.'),
    },
  ],

  roleChips: [
    T('คัดกรองกลุ่มเป้าหมาย', 'Screen target group'),
    T('ประสานงานกับผู้สูงอายุ', 'Coordinate with elderly residents'),
    T('ประชาสัมพันธ์กิจกรรม', 'Publicise activities'),
    T('สนับสนุนการจัดกิจกรรม', 'Support event delivery'),
    T('ให้คำปรึกษา', 'Provide advice'),
    T('ติดตามผลโครงการ', 'Follow up on results'),
  ],

  resourceChips: [
    T('สถานที่จัดกิจกรรม', 'Activity venue'),
    T('เจ้าหน้าที่ / บุคลากร', 'Officers / staff'),
    T('อาสาสมัครสาธารณสุข (อสม.)', 'Health volunteers'),
    T('ข้อมูลประชากรในพื้นที่', 'Local population data'),
    T('ยานพาหนะ', 'Vehicle'),
    T('สื่อประชาสัมพันธ์ในพื้นที่', 'Local publicity channels'),
  ],
};
