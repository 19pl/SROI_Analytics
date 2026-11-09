import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window', 'document', 'localStorage', 'Event', 'HTMLElement', 'CustomEvent', 'navigator']) {
  try { globalThis[k] = w[k] ?? globalThis[k]; } catch { Object.defineProperty(globalThis, k, { value: w[k], configurable: true }); }
}
globalThis.window = w;
w.API_BASE_URL = 'http://x/api';

// capture every API call
const calls = [];
let nextId = 100;
globalThis.fetch = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url, method: opts.method || 'GET', body });
  const data = { id: nextId++, ...(body || {}) };
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ data }), text: async () => JSON.stringify({ data }) };
};
w.fetch = globalThis.fetch;


// jsdom has no named-property access on <form> (form.name_s1); real browsers do. Emulate it for this one form.
const realGet = w.document.getElementById.bind(w.document);
w.document.getElementById = (id) => {
  const el = realGet(id);
  if (!el || id !== 'stakeholderForm') return el;
  return new Proxy(el, {
    get(t, p) {
      if (typeof p === 'string' && !(p in t)) return t.elements.namedItem(p) ?? undefined;
      const v = Reflect.get(t, p, t);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
};

const root = '/home/claude/SROI_Analytics/frontend/public/js';
const { getState } = await import(`${root}/store.js`);
const { renderStep2 } = await import(`${root}/views/steps/step2Stakeholders.js`);

const st = getState();
st.project = { id: 1, currency: 'THB', analysis_period_years: 3 };
st.stakeholders = [];
st.costs = [];

const $ = (sel) => document.querySelector(sel);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const choose = (sel, v) => { sel.value = v; sel.dispatchEvent(new w.Event('change', { bubbles: true })); };
const type = (el, text) => { // simulate typing char by char through input events
  let v = el.value;
  for (const ch of text) { v += ch; el.value = v; el.selectionStart = el.selectionEnd = v.length; el.dispatchEvent(new w.Event('input', { bubbles: true })); v = el.value; }
};
const chip = (containerId, text) => {
  const b = [...document.querySelectorAll(`#${containerId} [data-chip]`)].find((x) => x.dataset.chip === text);
  assert.ok(b, `chip "${text}" missing in #${containerId}`);
  b.click();
};
const chipTexts = (id) => [...document.querySelectorAll(`#${id} [data-chip]`)].map((b) => b.dataset.chip);
const closeAll = () => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove());
let pass = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { pass++; console.log('  ok  ', name); }, (e) => { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1; });

const container = $('#app');
renderStep2(container);

const open = (group, initialData) => {
  closeAll();
  if (initialData) container.querySelector(`[data-edit-stakeholder="${initialData.id}"]`)?.click();
  else (document.getElementById('btnTopAddStakeholder')).click();
  if (!initialData) {
    const radio = document.querySelector(`#groupChips input[value="${group}"]`);
    radio.checked = true; radio.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
};
const save = async () => { calls.length = 0; $('#btnSaveStk').click(); await new Promise((r) => setTimeout(r, 30)); return calls.find((c) => /stakeholders/.test(c.url) && ['POST', 'PUT', 'PATCH'].includes(c.method)); };

console.log('S1 regression');
await ok('S1 preset still auto-fills name + unit', () => {
  open('primary_beneficiary');
  choose($('#s1PresetSelect'), 'elderly');
  assert.equal($('#s1NameInput').value, 'ผู้สูงอายุในชุมชน');
  assert.equal($('#s1UnitInput').value, 'คน');
  choose($('#s1PresetSelect'), 'local_gov');
  assert.equal($('#s1UnitInput').value, 'แห่ง');
});
await ok('S1 saves exactly as before', async () => {
  open('primary_beneficiary');
  choose($('#s1PresetSelect'), 'elderly');
  set($('#s1EstimatedCount'), '120');
  const req = await save();
  assert.equal(req.body.name, 'ผู้สูงอายุในชุมชน');
  assert.equal(req.body.estimated_count, 120);
  assert.equal(req.body.stakeholder_group, 'primary_beneficiary');
  assert.equal(req.body.category, 'ผู้สูงอายุในชุมชน');
});

console.log('S2 — Project Implementers');
await ok('S2 starts empty: save disabled, no invented values', () => {
  open('project_operator');
  assert.equal($('#s2Category').value, '');
  assert.equal($('#s2PersonnelCount').value, '');
  assert.equal($('#s2CountUnit').value, 'คน');
  assert.equal($('#btnSaveStk').disabled, true);
});
await ok('S2 type dropdown has the 8 spec types + Other, none from S1', () => {
  const labels = [...$('#s2Category').options].map((o) => o.textContent);
  for (const need of ['คณะ / สำนัก / ภาควิชาในมหาวิทยาลัย', 'หน่วยงานภาครัฐ', 'โรงพยาบาล / สถานพยาบาล', 'ทีมวิจัย / นักวิจัย', 'อาจารย์ / บุคลากรทางการศึกษา', 'เจ้าหน้าที่โครงการ', 'อาสาสมัคร', 'องค์กรเอกชน', 'อื่นๆ (ระบุเอง)'])
    assert.ok(labels.includes(need), need);
  assert.ok(!labels.includes('ผู้สูงอายุในชุมชน'));
});
await ok('S2 selecting type shows tip, example chips, placeholder; count placeholder changes; no number filled', () => {
  choose($('#s2Category'), 'hospital');
  assert.equal($('#s2CategoryTip').hidden, false);
  assert.ok(chipTexts('s2NameInputChips').includes('โรงพยาบาลส่งเสริมสุขภาพตำบล'));
  assert.match($('#s2NameInput').placeholder, /โรงพยาบาลมหาวิทยาลัย/);
  assert.equal($('#s2PersonnelCount').placeholder, 'เช่น 6');
  assert.equal($('#s2PersonnelCount').value, '');
  assert.ok(chipTexts('s2RoleChips').includes('ให้บริการตรวจรักษาโรคตา')); // type-specific role first
  assert.ok(chipTexts('s2RoleChips').includes('ตรวจวัดสายตา')); // spec list
});
await ok('S2 name chip fills; user can edit; replacing typed text offers undo', () => {
  chip('s2NameInputChips', 'โรงพยาบาลส่งเสริมสุขภาพตำบล');
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลส่งเสริมสุขภาพตำบล');
  type($('#s2NameInput'), ' บ้านดู่');
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลส่งเสริมสุขภาพตำบล บ้านดู่');
  chip('s2NameInputChips', 'โรงพยาบาลมหาวิทยาลัย');
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลมหาวิทยาลัย');
  const undo = $('#s2NameInputChips + .smart-undo');
  assert.ok(undo && !undo.hidden, 'undo notice shown');
  undo.querySelector('button').click();
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลส่งเสริมสุขภาพตำบล บ้านดู่');
});
await ok('S2 changing the type never wipes typed name', () => {
  choose($('#s2Category'), 'research_team'); // has defaultName
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลส่งเสริมสุขภาพตำบล บ้านดู่');
  choose($('#s2Category'), 'government');
  assert.equal($('#s2NameInput').value, 'โรงพยาบาลส่งเสริมสุขภาพตำบล บ้านดู่');
});
await ok('S2 auto default name is replaced/cleared while untouched, kept once edited', () => {
  open('project_operator');
  choose($('#s2Category'), 'volunteer');
  assert.equal($('#s2NameInput').value, 'อาสาสมัครโครงการ');
  choose($('#s2Category'), 'project_staff');
  assert.equal($('#s2NameInput').value, 'เจ้าหน้าที่โครงการ');
  choose($('#s2Category'), 'government');
  assert.equal($('#s2NameInput').value, '');
  choose($('#s2Category'), 'volunteer');
  type($('#s2NameInput'), ' นิสิต');
  choose($('#s2Category'), 'project_staff');
  assert.equal($('#s2NameInput').value, 'อาสาสมัครโครงการ นิสิต');
});
await ok('S2 role chips append, toggle off, stay editable', () => {
  open('project_operator');
  chip('s2RoleChips', 'ดำเนินกิจกรรม');
  chip('s2RoleChips', 'ตรวจวัดสายตา');
  assert.equal($('#s2Role').value, 'ดำเนินกิจกรรม, ตรวจวัดสายตา');
  type($('#s2Role'), ' (ภาคสนาม)');
  assert.equal($('#s2Role').value, 'ดำเนินกิจกรรม, ตรวจวัดสายตา (ภาคสนาม)');
  chip('s2RoleChips', 'ดำเนินกิจกรรม');
  assert.equal($('#s2Role').value, 'ตรวจวัดสายตา (ภาคสนาม)');
});
await ok('S2 period chips replace; "custom" only focuses', () => {
  chip('s2OperationPeriodChips', '6 เดือน');
  assert.equal($('#s2OperationPeriod').value, '6 เดือน');
  chip('s2OperationPeriodChips', 'กำหนดเอง');
  assert.equal($('#s2OperationPeriod').value, '6 เดือน');
  assert.equal(document.activeElement, $('#s2OperationPeriod'));
});
await ok('S2 "Other" type reveals a text box and stores the typed text', async () => {
  open('project_operator');
  choose($('#s2Category'), '__other__');
  assert.equal($('#s2CategoryOther').hidden, false);
  set($('#s2CategoryOther'), 'สมาคมวิชาชีพ');
  set($('#s2NameInput'), 'สมาคมทัศนมาตรศาสตร์');
  set($('#s2Role'), 'ตัดแว่น');
  assert.equal($('#btnSaveStk').disabled, false);
  const req = await save();
  assert.equal(req.body.category, 'สมาคมวิชาชีพ');
});
await ok('S2 count accepts digits only (blocks e - . keys) and saves blank as null', async () => {
  open('project_operator');
  set($('#s2NameInput'), 'ทีม A'); set($('#s2Role'), 'บริหาร');
  for (const key of ['e', '-', '.', '+']) {
    const ev = new w.KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    $('#s2PersonnelCount').dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, true, key);
  }
  const req = await save();
  assert.equal(req.body.estimated_count, null);
  assert.equal(req.body.count_unit, 'คน');
  assert.equal(req.body.stakeholder_group, 'project_operator');
});

console.log('S3 — Project Supporters');
await ok('S3 type + support-type dropdowns match spec; support type starts unselected & required', () => {
  open('project_supporter');
  const t = [...$('#s3Category').options].map((o) => o.textContent);
  for (const need of ['หน่วยงานภาครัฐ', 'องค์กรปกครองส่วนท้องถิ่น', 'บริษัทเอกชน', 'มูลนิธิ / องค์กรไม่แสวงหากำไร', 'แหล่งทุนวิจัย', 'บุคคลทั่วไป / ผู้บริจาค', 'สถาบันการศึกษา'])
    assert.ok(t.includes(need), need);
  const s = [...$('#s3SupportType').options].map((o) => o.textContent);
  for (const need of ['เงินทุน (Financial / Grants)', 'วัสดุและอุปกรณ์', 'บุคลากร', 'สถานที่', 'บริการหรือความเชี่ยวชาญ', 'ประชาสัมพันธ์', 'สนับสนุนหลายรูปแบบ'])
    assert.ok(s.includes(need), need);
  assert.equal($('#s3SupportType').value, '');
  set($('#s3NameInput'), 'สสส.');
  assert.equal($('#btnSaveStk').disabled, true, 'needs support type');
});
await ok('S3 quantity example follows support type (spec examples)', () => {
  const cases = { financial: 'เช่น 10,000 บาท', equipment: 'เช่น แว่นสายตา 30 อัน', personnel: 'เช่น 5 คน', venue: 'เช่น 1 แห่ง' };
  for (const [id, ph] of Object.entries(cases)) {
    choose($('#s3SupportType'), id);
    assert.equal($('#s3SupportAmountOrQty').placeholder, ph, id);
    assert.equal($('#s3SupportAmountOrQty').value, '');
    assert.equal($('#s3SupportTypeTip').hidden, false);
  }
  assert.equal($('#btnSaveStk').disabled, false);
});
await ok('S3 value: numbers only, thousand separators, never pre-filled', () => {
  assert.equal($('#s3SupportValue').value, '');
  type($('#s3SupportValue'), '50000');
  assert.equal($('#s3SupportValue').value, '50,000');
  type($('#s3SupportValue'), 'abc');
  assert.equal($('#s3SupportValue').value, '50,000');
  set($('#s3SupportValue'), '1234567.8999');
  assert.equal($('#s3SupportValue').value, '1,234,567.89');
  set($('#s3SupportValue'), '1.2.3');
  assert.equal($('#s3SupportValue').value, '1.23');
});
await ok('S3 value example text is not clickable and does not fill', () => {
  assert.match($('#s3SupportValue').closest('.field').textContent, /5,000 \/ 10,000 \/ 50,000/);
  assert.equal($('#s3SupportValue').closest('.field').querySelectorAll('button').length, 0);
});
await ok('S3 detail chips toggle with "; " and remain editable', () => {
  open('project_supporter');
  chip('s3DescriptionChips', 'สนับสนุนเป็นงวด');
  chip('s3DescriptionChips', 'ต้องส่งรายงานความก้าวหน้า');
  assert.equal($('#s3Description').value, 'สนับสนุนเป็นงวด; ต้องส่งรายงานความก้าวหน้า');
  type($('#s3Description'), ' ทุก 3 เดือน');
  assert.match($('#s3Description').value, /ทุก 3 เดือน$/);
});
await ok('S3 save payload (value parsed to number, formatting stripped)', async () => {
  open('project_supporter');
  choose($('#s3Category'), 'research_fund');
  chip('s3NameInputChips', 'สำนักงานการวิจัยแห่งชาติ (วช.)');
  choose($('#s3SupportType'), 'financial');
  type($('#s3SupportValue'), '250000');
  set($('#s3SupportAmountOrQty'), '250,000 บาท');
  const req = await save();
  assert.equal(req.body.support_value, 250000);
  assert.equal(req.body.support_type, 'เงินทุน (Financial / Grants)');
  assert.equal(req.body.category, 'แหล่งทุนวิจัย');
  assert.equal(req.body.name, 'สำนักงานการวิจัยแห่งชาติ (วช.)');
  assert.equal(req.body.stakeholder_group, 'project_supporter');
});
await ok('S3 blank value saves as null (no invented value)', async () => {
  open('project_supporter');
  set($('#s3NameInput'), 'ผู้บริจาค'); choose($('#s3SupportType'), 'equipment');
  const req = await save();
  assert.equal(req.body.support_value, null);
});
await ok('S3 "Other" support type requires text', async () => {
  open('project_supporter');
  set($('#s3NameInput'), 'X'); choose($('#s3SupportType'), '__other__');
  assert.equal($('#btnSaveStk').disabled, true);
  set($('#s3SupportTypeOther'), 'ค่าเดินทาง');
  assert.equal($('#btnSaveStk').disabled, false);
  const req = await save();
  assert.equal(req.body.support_type, 'ค่าเดินทาง');
});

console.log('S4 — Other Stakeholders');
await ok('S4 dropdowns match spec; cooperation starts unselected', () => {
  open('other_agency');
  const t = [...$('#s4Category').options].map((o) => o.textContent);
  for (const need of ['องค์กรปกครองส่วนท้องถิ่น (อบต. / เทศบาล / อบจ.)', 'โรงพยาบาล / โรงพยาบาลส่งเสริมสุขภาพตำบล', 'หน่วยงานสาธารณสุข', 'ชมรมผู้สูงอายุ', 'ผู้นำชุมชน', 'องค์กรภาคประชาสังคม', 'สถาบันการศึกษา', 'องค์กรเอกชน'])
    assert.ok(t.includes(need), need);
  const c = [...$('#s4CooperationType').options].map((o) => o.textContent);
  for (const need of ['บันทึกข้อตกลงความร่วมมือ (MOU)', 'ประสานงานและส่งต่อกลุ่มเป้าหมาย', 'ประชาสัมพันธ์โครงการ', 'สนับสนุนสถานที่', 'สนับสนุนบุคลากร', 'สนับสนุนข้อมูล', 'ร่วมดำเนินกิจกรรม', 'ติดตามและประเมินผล'])
    assert.ok(c.includes(need), need);
  assert.equal($('#s4CooperationType').value, '');
  assert.equal($('#s4CountUnit').value, 'แห่ง');
});
await ok('S4 unit + count placeholder follow the type (แห่ง / คน / กลุ่ม); typed unit kept', () => {
  choose($('#s4Category'), 'elderly_club');
  assert.equal($('#s4CountUnit').value, 'คน');
  assert.equal($('#s4PersonnelCount').placeholder, 'เช่น 40');
  choose($('#s4Category'), 'civil_society');
  assert.equal($('#s4CountUnit').value, 'กลุ่ม');
  choose($('#s4Category'), 'hospital');
  assert.equal($('#s4CountUnit').value, 'แห่ง');
  set($('#s4CountUnit'), 'ชมรม'); $('#s4CountUnit').dispatchEvent(new w.Event('input', { bubbles: true }));
  choose($('#s4Category'), 'community_leader');
  assert.equal($('#s4CountUnit').value, 'ชมรม', 'user-edited unit must survive a type change');
  assert.equal($('#s4PersonnelCount').value, '');
});
await ok('S4 cooperation tip + role/resource quick select fill inputs', () => {
  choose($('#s4CooperationType'), 'mou');
  assert.equal($('#s4CooperationTypeTip').hidden, false);
  chip('s4RoleChips', 'คัดกรองกลุ่มเป้าหมาย');
  chip('s4RoleChips', 'ประสานงานกับผู้สูงอายุ');
  assert.equal($('#s4Role').value, 'คัดกรองกลุ่มเป้าหมาย, ประสานงานกับผู้สูงอายุ');
  chip('s4ResourcesProvidedChips', 'สถานที่จัดกิจกรรม');
  assert.equal($('#s4ResourcesProvided').value, 'สถานที่จัดกิจกรรม');
});
await ok('S4 saves with blank count (optional) and keeps group isolation', async () => {
  open('other_agency');
  choose($('#s4Category'), 'hospital');
  set($('#s4NameInput'), 'รพ.สต. บ้านดู่');
  choose($('#s4CooperationType'), 'referral');
  const req = await save();
  assert.equal(req.body.estimated_count, null);
  assert.equal(req.body.cooperation_type, 'ประสานงานและส่งต่อกลุ่มเป้าหมาย');
  assert.equal(req.body.category, 'โรงพยาบาล / โรงพยาบาลส่งเสริมสุขภาพตำบล');
  assert.equal(req.body.count_unit, 'แห่ง');
});

console.log('Group switching / edit / legacy records');
await ok('Switching S-group keeps what was typed in the other section', () => {
  open('project_operator');
  set($('#s2NameInput'), 'ทีมวิจัยทดสอบ'); set($('#s2Role'), 'วิจัย');
  const r = document.querySelector('#groupChips input[value="project_supporter"]'); r.checked = true; r.dispatchEvent(new w.Event('change', { bubbles: true }));
  const r2 = document.querySelector('#groupChips input[value="project_operator"]'); r2.checked = true; r2.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($('#s2NameInput').value, 'ทีมวิจัยทดสอบ');
  assert.equal($('#s2Role').value, 'วิจัย');
});
const legacy = (extra) => ({ id: 7, stakeholder_group: 'project_operator', name: 'N', group_code: 'S2.1', ...extra });
const reopen = (rec) => { st.stakeholders = [rec]; renderStep2(container); open(null, rec); };
await ok('Edit restores a new-style S2 record (all fields)', () => {
  reopen(legacy({ category: 'ทีมวิจัย / นักวิจัย', name: 'ทีม X', operation_period: '3 เดือน', estimated_count: 12, count_unit: 'คน', role_in_project: 'ดำเนินกิจกรรม', resources_used: 'รถตู้ 1 คัน', description: 'หมายเหตุ' }));
  assert.equal($('#s2Category').value, 'research_team');
  assert.equal($('#s2NameInput').value, 'ทีม X');
  assert.equal($('#s2OperationPeriod').value, '3 เดือน');
  assert.equal($('#s2PersonnelCount').value, '12');
  assert.equal($('#s2Role').value, 'ดำเนินกิจกรรม');
  assert.equal($('#s2ResourcesUsed').value, 'รถตู้ 1 คัน');
  assert.equal($('#s2Description').value, 'หมายเหตุ');
  assert.ok($('#s2RoleChips [data-chip="ดำเนินกิจกรรม"]').classList.contains('is-used'));
  assert.equal($('#btnSaveStk').disabled, false);
});
await ok('Edit keeps an unchanged OLD S2 category (English key) byte-for-byte on save', async () => {
  reopen(legacy({ category: 'Faculty / Department', role_in_project: 'r', estimated_count: 3, count_unit: 'คน' }));
  assert.equal($('#s2Category').value, 'faculty');
  const req = await save();
  assert.equal(req.method, 'PATCH');
  assert.equal(req.body.category, 'Faculty / Department');
  assert.equal(req.body.estimated_count, 3);
});
await ok('Edit: an unknown legacy value lands in "Other" with its text, nothing lost', async () => {
  reopen(legacy({ category: 'Weird Custom', role_in_project: 'r' }));
  assert.equal($('#s2Category').value, '__other__');
  assert.equal($('#s2CategoryOther').value, 'Weird Custom');
  const req = await save();
  assert.equal(req.body.category, 'Weird Custom');
});
await ok('Edit OLD S3 record (legacy support_type / category / numeric value)', async () => {
  reopen({ id: 8, stakeholder_group: 'project_supporter', name: 'สสส.', category: 'Government Agency / Fund', support_type: 'สิ่งของ / อุปกรณ์', support_value: 250000, support_amount_or_quantity: 'แว่นตา 300 อัน', description: 'งวดเดียว' });
  assert.equal($('#s3Category').value, 'government');
  assert.equal($('#s3SupportType').value, 'equipment');
  assert.equal($('#s3SupportValue').value, '250,000');
  const req = await save();
  assert.equal(req.body.support_type, 'สิ่งของ / อุปกรณ์');
  assert.equal(req.body.support_value, 250000);
  assert.equal(req.body.category, 'Government Agency / Fund');
});
await ok('Edit OLD S4 record (legacy cooperation + category)', async () => {
  reopen({ id: 9, stakeholder_group: 'other_agency', name: 'อบต.', category: 'Local Administration', cooperation_type: 'บันทึกข้อตกลงความร่วมมือ (MOU)', estimated_count: 2, count_unit: 'แห่ง', role_in_project: 'ประสาน' });
  assert.equal($('#s4Category').value, 'local_gov');
  assert.equal($('#s4CooperationType').value, 'mou');
  assert.equal($('#s4PersonnelCount').value, '2');
  assert.equal($('#s4CountUnit').value, 'แห่ง');
  const req = await save();
  assert.equal(req.body.cooperation_type, 'บันทึกข้อตกลงความร่วมมือ (MOU)');
  assert.equal(req.body.estimated_count, 2);
});
await ok('Edit old S4 with legacy-only cooperation ("คณะกรรมการร่วม / ที่ปรึกษา") keeps text via Other', () => {
  reopen({ id: 10, stakeholder_group: 'other_agency', name: 'a', cooperation_type: 'คณะกรรมการร่วม / ที่ปรึกษา' });
  assert.equal($('#s4CooperationType').value, '__other__');
  assert.equal($('#s4CooperationTypeOther').value, 'คณะกรรมการร่วม / ที่ปรึกษา');
});
await ok('Chip with max length is refused with a toast and leaves text intact', () => {
  open('project_operator');
  set($('#s2Role'), 'x'.repeat(495));
  chip('s2RoleChips', 'ดำเนินกิจกรรม');
  assert.equal($('#s2Role').value.length, 495);
});
await ok('Required vs optional markers are visible on S2–S4', () => {
  open('project_operator');
  const sec = (id) => document.getElementById(id);
  assert.ok(sec('stkSection-project_operator').querySelectorAll('.smart-opt').length >= 5);
  assert.ok(sec('stkSection-project_operator').querySelectorAll('.field-hint--primary').length === 2);
  assert.ok(sec('stkSection-project_supporter').querySelectorAll('.field-hint--primary').length === 2);
  assert.ok(sec('stkSection-other_agency').querySelectorAll('.field-hint--primary').length === 1);
});

await ok('English UI: labels, tips, chips and stored values are English', async () => {
  w.localStorage.setItem('sroi_lang', 'en');
  renderStep2(container);
  open('project_operator');
  assert.match($('label[for="s2Category"]').textContent, /Implementer Type/);
  assert.match($('label[for="s2Category"]').textContent, /optional/);
  choose($('#s2Category'), 'hospital');
  assert.match($('#s2CategoryTip').textContent, /Tip/);
  chip('s2RoleChips', 'Run activities');
  assert.equal($('#s2Role').value, 'Run activities');
  set($('#s2NameInput'), 'Team');
  const req = await save();
  assert.equal(req.body.category, 'Hospital / Health facility');
  w.localStorage.setItem('sroi_lang', 'th');
});

console.log(`\n${pass} checks passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
