import { badge, card, icons, numberField, textField } from '../components/ui.js';
import { addOutcome, getResult, getScenario, patchScenario, removeOutcome, updateOutcome } from '../store.js';
import { clamp, escapeHtml, formatBaht, formatBahtCompact, formatRatio } from '../utils/sroi.js';

const numCols = [
  { key: 'quantity', label: 'จำนวน (คน)', max: 1e9 },
  { key: 'proxyValue', label: 'มูลค่า/คน/ปี (บาท)', max: 1e9 },
  { key: 'deadweight', label: 'Deadweight %', max: 100 },
  { key: 'attribution', label: 'Attribution %', max: 100 },
  { key: 'dropOff', label: 'Drop-off %', max: 100 },
];
const projectLimits = { investment: [0, 1e12], years: [1, 10], discountRate: [0, 20] };

const rowHtml = (o) => `<tr data-id="${o.id}">
  <td><input class="input input-cell input-wide" data-outcome="name" value="${escapeHtml(o.name)}" aria-label="ผลลัพธ์" /></td>
  <td><input class="input input-cell input-wide" data-outcome="stakeholder" value="${escapeHtml(o.stakeholder)}" aria-label="กลุ่มผู้ได้รับผลกระทบ" /></td>
  ${numCols.map((c) => `<td><input class="input input-cell" type="number" min="0" max="${c.max}" data-outcome="${c.key}" value="${o[c.key]}" aria-label="${c.label}" /></td>`).join('')}
  <td class="num strong" data-pv></td>
  <td><button class="btn-icon" data-remove title="ลบผลลัพธ์" aria-label="ลบผลลัพธ์">${icons.trash}</button></td></tr>`;

export function renderCalculator(root) {
  const s = getScenario();
  root.innerHTML = `<div>
    <div style="margin-bottom: 4px;">
      <span class="badge badge-development" style="font-weight: 700;">NU SROI มหาวิทยาลัยนเรศวร</span>
    </div>
    <h1 class="page-title">คำนวณ SROI</h1>
    <p class="muted page-sub" id="scenarioName"></p>
    <div class="calc-grid">
      <div class="stack">
        ${card({ title: 'ข้อมูลโครงการ', description: 'กรอกเงินลงทุนและระยะเวลาที่ต้องการวัดผล', body: `<div class="form-grid">
          ${textField({ key: 'name', label: 'ชื่อโครงการ', value: s.name })}
          ${numberField({ key: 'investment', label: 'เงินลงทุนรวม', suffix: 'บาท', value: s.investment, step: 10000 })}
          <div class="field">
            <span class="field-label">ระยะเวลาวัดผล</span>
            <span class="field-control">
              <input class="input" type="number" data-field="years" value="${s.years}" min="1" max="5" />
              <span class="field-suffix">ปี</span>
            </span>
            <input type="range" class="field-range-slider" data-field="years" min="1" max="5" value="${s.years}" step="1" title="แถบเลื่อนปรับระยะเวลา 1-5 ปี" />
          </div>
          ${numberField({ key: 'discountRate', label: 'อัตราคิดลด', suffix: '%', value: s.discountRate, max: 20, step: 0.5 })}</div>` })}
        ${card({ title: 'ผลลัพธ์ทางสังคม', description: 'แต่ละแถวคือการเปลี่ยนแปลงที่เกิดกับกลุ่มผู้ได้รับผลกระทบ',
          action: `<button class="btn btn-primary" data-add>${icons.plus}เพิ่มผลลัพธ์</button>`,
          body: `<div class="table-wrap"><table class="table"><thead><tr><th>ผลลัพธ์</th><th>กลุ่มผู้ได้รับผลกระทบ</th>
            ${numCols.map((c) => `<th>${c.label}</th>`).join('')}<th class="num">มูลค่าปัจจุบัน</th><th></th></tr></thead><tbody id="outcomeBody"></tbody></table></div>` })}
      </div>
      <div class="stack sticky"><div id="summary"></div><div id="chart"></div></div>
    </div></div>`;
  const el = root.firstElementChild;

  const renderRows = () => {
    const body = el.querySelector('#outcomeBody');
    body.innerHTML = getScenario().outcomes.length
      ? getScenario().outcomes.map(rowHtml).join('')
      : '<tr><td colspan="9" class="empty">ยังไม่มีผลลัพธ์ กด “เพิ่มผลลัพธ์” เพื่อเริ่มคำนวณ</td></tr>';
  };

  // อัปเดตเฉพาะส่วนที่ขึ้นกับผลคำนวณ เพื่อไม่ให้ช่องที่กำลังพิมพ์เสียโฟกัส
  const updateResults = () => {
    const sc = getScenario(), r = getResult(), worth = r.ratio >= 1, max = Math.max(...r.yearlyPV, 1);
    el.querySelector('#scenarioName').textContent = sc.name;
    r.rows.forEach(({ outcome, presentValue }) => {
      const cell = el.querySelector(`tr[data-id="${outcome.id}"] [data-pv]`);
      if (cell) cell.textContent = formatBaht(presentValue);
    });

    el.querySelector('#summary').innerHTML = `
      <section class="card summary-card-nu">
        <!-- Banner สีส้มไล่เฉด สไตล์ต้นแบบ NU SROI -->
        <div class="sroi-banner-nu ${worth ? 'is-worthy' : 'is-deficit'}">
          <div class="sroi-banner-info">
            <span class="sroi-banner-sub">ผลตอบแทนทางสังคม (SROI)</span>
            <div class="sroi-banner-ratio">
              ${r.ratio.toFixed(2)} <small>เท่าของต้นทุน</small>
            </div>
          </div>
          <span class="sroi-banner-badge">${worth ? 'คุ้มค่าการลงทุน' : 'ต่ำกว่าเงินลงทุน'}</span>
        </div>

        <!-- 3 กล่องตัวเลขสรุป -->
        <div class="summary-metrics-grid">
          <div class="summary-metric-card">
            <span class="metric-title">มูลค่าปัจจุบันรวม</span>
            <span class="metric-num">${formatBaht(r.totalPV)}</span>
          </div>
          <div class="summary-metric-card">
            <span class="metric-title">เงินลงทุน</span>
            <span class="metric-num">${formatBaht(sc.investment)}</span>
          </div>
          <div class="summary-metric-card">
            <span class="metric-title">อัตราคิดลด</span>
            <span class="metric-num">${sc.discountRate}%</span>
          </div>
        </div>

        <!-- แถบ NPV พร้อมไอคอนเทรนด์ -->
        <div class="summary-npv-strip ${r.npv >= 0 ? 'is-pos' : 'is-neg'}">
          <span class="npv-icon">${icons.trendUp}</span>
          <div class="npv-details">
            <span class="npv-label">มูลค่าปัจจุบันสุทธิ (NPV)</span>
            <span class="npv-val">${r.npv >= 0 ? '+' : ''}${formatBaht(r.npv)}</span>
          </div>
        </div>
      </section>`;

    el.querySelector('#chart').innerHTML = card({
      title: 'มูลค่าปัจจุบันรายปี',
      description: 'หลังหัก Deadweight, Attribution, Drop-off และคิดลดแล้ว',
      body: `<div class="chart chart-nu" role="img" aria-label="กราฟแท่งมูลค่าปัจจุบันรายปี">${r.yearlyPV.map((v, i) => {
        const isPeak = v === max && max > 0;
        return `<div class="chart-col">
          <span class="chart-value" title="${formatBaht(v)}">${formatBahtCompact(v)}</span>
          <div class="chart-bar ${isPeak ? 'is-peak' : ''}" style="height:${(v / max) * 100}%" title="ปี ${i + 1}: ${formatBaht(v)}"></div>
          <span class="chart-label ${isPeak ? 'strong' : ''}">ปี ${i + 1}</span>
        </div>`;
      }).join('')}</div>`,
    });
  };

  el.addEventListener('input', (e) => {
    const t = e.target, rowId = t.closest('tr')?.dataset.id;
    if (t.dataset.field) {
      const k = t.dataset.field;
      const val = k === 'name' ? t.value : clamp(Number(t.value) || 0, ...projectLimits[k]);
      patchScenario({ [k]: val });
      if (k === 'years') {
        el.querySelectorAll('[data-field="years"]').forEach((input) => {
          if (input !== t) input.value = val;
        });
      }
    } else if (t.dataset.outcome && rowId) {
      const k = t.dataset.outcome;
      updateOutcome(rowId, { [k]: t.type === 'number' ? clamp(Number(t.value) || 0, 0, Number(t.max)) : t.value });
    } else return;
    updateResults();
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { addOutcome(); renderRows(); updateResults(); }
    const rm = e.target.closest('[data-remove]');
    if (rm) { removeOutcome(rm.closest('tr').dataset.id); renderRows(); updateResults(); }
  });

  renderRows();
  updateResults();
}
