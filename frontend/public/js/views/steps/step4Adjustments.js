/**
 * Step 4: Impact Adjustments: How Much Change Can We Defensibly Claim?
 * Guided, beginner-friendly experience for university employees.
 * Explains Deadweight, Attribution, Displacement, and Drop-off with realistic examples.
 * Fully bilingual (Thai & English).
 */

import { getState, saveAdjustment, saveYearProjections, refreshCalculations } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { stakeholderLabel } from '../../utils/stakeholderGroups.js';
import { escapeHtml } from '../../utils/html.js';
import { api } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

const FIELDS = ['deadweight', 'attribution', 'displacement', 'drop_off'];
const pctShown = (f) => (f === null || f === undefined ? '' : Math.round(Number(f) * 1e6) / 1e4);

/** net retained share from the three multiplicative deductions; null until all three have been entered (never assume 0 %) */
function retainedFactor(vals) {
  const [dw, at, dp] = [vals.deadweight, vals.attribution, vals.displacement];
  if ([dw, at, dp].some((x) => x === null || x === undefined)) return null;
  return (1 - dw) * (1 - at) * (1 - dp);
}

export function renderStep4(container) {
  const { project, outcomes, stakeholders } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }
  const stkById = {};
  stakeholders.forEach((s) => (stkById[s.id] = stakeholderLabel(s)));

  const rowHtml = (o) => {
    const adj = o.adjustment || {};
    return `
      <tr data-outcome-id="${o.id}">
        <td class="strong">
          <div style="color: var(--on-background);">${escapeHtml(o.name)}</div>
          <div class="muted" style="font-size: 0.75rem;">${escapeHtml(stkById[o.stakeholder_id] || '')} · ${escapeHtml(o.projection_model)} · ${o.duration_years} ${t('years', 'ปี')}</div>
        </td>
        ${FIELDS.map(
          (f) =>
            `<td class="num"><span class="pct-wrap"><input class="input input-cell adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="${f}" value="${pctShown(adj[f])}" placeholder="–" aria-label="${f}" /><i>%</i></span></td>`,
        ).join('')}
        <td class="num strong adj-factor" style="color: var(--primary);"></td>
        <td><input class="input input-cell adj-in adj-text" type="text" data-f="justification" value="${escapeHtml(adj.justification || '')}" placeholder="${t('in_adj_reason_ph', 'เหตุผลในการกำหนด %')}" /></td>
        <td><input class="input input-cell adj-in adj-text" type="text" data-f="source" value="${escapeHtml(adj.source || '')}" placeholder="${t('in_adj_source_ph', 'แหล่งอ้างอิง')}" /></td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-icon" data-copy-prev="${o.id}" title="${t('in_adj_copy_prev', 'คัดลอกค่าจากแถวด้านบน')}">⤓</button>
            <button class="btn btn-secondary" data-year-projections="${o.id}" style="height: 30px; font-size: 0.75rem; padding: 0 8px;" title="${t('btn_multi_year', 'รายปี')}">${t('btn_multi_year', 'รายปี')}</button>
            <span class="adj-state" aria-live="polite"></span>
          </div>
        </td>
      </tr>`;
  };

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Guidance Header -->
      <div class="alert alert-info in-banner" style="background: rgba(25, 118, 210, 0.08); border-left: 4px solid var(--primary); padding: var(--sp-md);">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--primary); display: block; margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 4: ปรับปรุงผลกระทบส่วนเกิน (Impact Deductions & Additionality)' : 'Step 4: Impact Deductions & Additionality'}
          </strong>
          <span style="font-size: 0.8125rem; color: var(--on-background);">
            ${
              isTh
                ? 'หลักการสำคัญของ SROI คือ "ไม่กล่าวอ้างผลงานเกินจริง" เราจึงต้องหักส่วนที่น่าจะเกิดขึ้นอยู่แล้ว หรือเกิดจากหน่วยงานอื่นออกไป เพื่อคำนวณผลกระทบสุทธิที่เกิดจากโครงการนี้จริง'
                : 'Do not claim all observed change. Deduct what would have happened anyway or was caused by others to isolate your project’s true additionality.'
            }
          </span>
        </div>
      </div>

      <!-- 4 Concepts Educational Grid -->
      <div class="card">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title">${isTh ? '💡 4 ตัวปรับปรุงผลกระทบที่คุณต้องรู้ (SROI Impact Deductions)' : '💡 The 4 Impact Adjustments Explained'}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'ตอบคำถาม 4 ข้อง่ายๆ เพื่อประเมินสัดส่วนร้อยละ (%) สำหรับแต่ละผลลัพธ์:' : 'Ask these 4 practical questions to determine the percentages:'}
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--sp-md); margin-bottom: var(--sp-md);">
          <!-- Concept 1: Deadweight -->
          <div style="background: var(--surface-soft); padding: 12px; border-radius: var(--radius-md); border-left: 3px solid #1976d2;">
            <strong style="font-size: 0.875rem; color: #1976d2; display: block; margin-bottom: 4px;">
              1. Deadweight (เกิดอยู่แล้ว)
            </strong>
            <p style="font-size: 0.75rem; color: var(--on-background); margin-bottom: 6px; line-height: 1.4;">
              <em>"${isTh ? 'การเปลี่ยนแปลงนี้จะเกิดขึ้นอยู่แล้วหรือไม่ แม้ไม่มีโครงการ?' : 'Would this have happened anyway without your project?'}"</em>
            </p>
            <div style="font-size: 0.6875rem; color: var(--muted); background: var(--surface); padding: 4px 6px; border-radius: var(--radius-sm);">
              ${isTh ? 'ตัวอย่าง: ผู้เข้าร่วม 10% มีแนวโน้มพัฒนาทักษะได้เองอยู่แล้ว → 10%' : 'e.g. 10% of participants would improve on their own → 10%'}
            </div>
          </div>

          <!-- Concept 2: Attribution -->
          <div style="background: var(--surface-soft); padding: 12px; border-radius: var(--radius-md); border-left: 3px solid #388e3c;">
            <strong style="font-size: 0.875rem; color: #388e3c; display: block; margin-bottom: 4px;">
              2. Attribution (เกิดจากผู้อื่น)
            </strong>
            <p style="font-size: 0.75rem; color: var(--on-background); margin-bottom: 6px; line-height: 1.4;">
              <em>"${isTh ? 'มีหน่วยงานหรือผู้อื่นร่วมสร้างผลลัพธ์นี้ด้วยหรือไม่?' : 'Did other organizations also contribute to this change?'}"</em>
            </p>
            <div style="font-size: 0.6875rem; color: var(--muted); background: var(--surface); padding: 4px 6px; border-radius: var(--radius-sm);">
              ${isTh ? 'ตัวอย่าง: มี รพ.สต. ร่วมจัดกิจกรรมสนับสนุน 25% → 25%' : 'e.g. Community clinic supported 25% of effort → 25%'}
            </div>
          </div>

          <!-- Concept 3: Displacement -->
          <div style="background: var(--surface-soft); padding: 12px; border-radius: var(--radius-md); border-left: 3px solid #f57c00;">
            <strong style="font-size: 0.875rem; color: #f57c00; display: block; margin-bottom: 4px;">
              3. Displacement (ย้ายปัญหา)
            </strong>
            <p style="font-size: 0.75rem; color: var(--on-background); margin-bottom: 6px; line-height: 1.4;">
              <em>"${isTh ? 'โครงการสร้างผลเสียหรือย้ายปัญหาไปที่อื่นหรือไม่?' : 'Did the benefit displace problems or harm others elsewhere?'}"</em>
            </p>
            <div style="font-size: 0.6875rem; color: var(--muted); background: var(--surface); padding: 4px 6px; border-radius: var(--radius-sm);">
              ${isTh ? 'ตัวอย่าง: หากไม่มียอดขายตกหรือผลกระทบทางลบต่อภายนอก → 0%' : 'e.g. If no external negative displacement occurs → 0%'}
            </div>
          </div>

          <!-- Concept 4: Drop-off -->
          <div style="background: var(--surface-soft); padding: 12px; border-radius: var(--radius-md); border-left: 3px solid #7b1fa2;">
            <strong style="font-size: 0.875rem; color: #7b1fa2; display: block; margin-bottom: 4px;">
              4. Drop-off (ลดทอนรายปี)
            </strong>
            <p style="font-size: 0.75rem; color: var(--on-background); margin-bottom: 6px; line-height: 1.4;">
              <em>"${isTh ? 'ผลลัพธ์นี้ค่อยๆ เลือนหายหรือลดลงในแต่ละปีอย่างไร?' : 'Does the outcome effect fade over subsequent years?'}"</em>
            </p>
            <div style="font-size: 0.6875rem; color: var(--muted); background: var(--surface); padding: 4px 6px; border-radius: var(--radius-sm);">
              ${isTh ? 'ตัวอย่าง: ความรู้ลดลงปีละ 15% หากไม่มีการฝึกฝนต่อ → 15%' : 'e.g. Knowledge fades by 15% per year without practice → 15%'}
            </div>
          </div>
        </div>

        <div class="formula-box" style="font-weight: 600; font-size: 0.8125rem;">
          ${t('adj_formula', 'ผลกระทบสุทธิที่ยอมรับได้ = มูลค่าขั้นต้น × (1 − Deadweight) × (1 − Attribution) × (1 − Displacement)')}
        </div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: var(--sp-xs);">
          💡 <strong>${isTh ? 'ข้อสังเกตสำคัญ:' : 'Important Rule:'}</strong> ${isTh ? 'ช่องว่าง (–) หมายถึง "ยังไม่ได้ประเมิน" ระบบจะไม่แอบแปลงเป็น 0% เอง หากผลลัพธ์ใดไม่มีการหักลบ ให้กรอกเลข 0 อย่างชัดเจน' : 'A blank cell (–) means "not assessed yet" and is never treated as 0%. If no deduction applies, enter 0 explicitly.'}
        </div>
      </div>

      <!-- Adjustments Matrix Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('adj_matrix_title', 'ตารางปรับปรุงผลกระทบ (Outcome Adjustment Matrix)')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'พิมพ์ตัวเลขเปอร์เซ็นต์ (0 - 100) ลงในตารางได้โดยตรง — ข้อมูลจะบันทึกให้อัตโนมัติ' : 'Type directly into the table — every change is saved automatically.'}
            </p>
          </div>
          <span class="adj-progress muted" id="adjProgress"></span>
        </div>

        ${
          outcomes.length === 0
            ? `<div class="in-empty muted" style="padding: var(--sp-xl); text-align: center;">
                <div style="font-size: 1.5rem; margin-bottom: 6px;">📝</div>
                <div class="strong" style="margin-bottom: 4px;">${isTh ? 'ยังไม่มีผลลัพธ์ให้ปรับปรุง' : 'No outcomes to adjust'}</div>
                <div style="font-size: 0.8125rem;"><a href="#/wizard/step-3">${isTh ? 'กรุณาเพิ่มผลลัพธ์ในขั้นตอนที่ 3 ก่อน' : 'Please add outcomes in Step 3 first'}</a></div>
              </div>`
            : `
        <div class="adj-bulk">
          <div class="adj-bulk-title">
            <b>${isTh ? 'ต้องการใส่ค่าเดียวกันให้หลายผลลัพธ์?' : 'Same values for multiple outcomes?'}</b>
            <span class="muted">${isTh ? 'กรอกในแถบนี้ แล้วกด "ใส่ในช่องที่ยังว่าง" — ข้อมูลเดิมจะไม่ถูกทับ' : 'Fill empty boxes in one click without overwriting existing data.'}</span>
          </div>
          <div class="adj-bulk-row">
            ${FIELDS.map((f) => `<label class="field"><span class="field-label">${t('field_' + (f === 'drop_off' ? 'dropoff' : f), f)}</span><span class="pct-wrap"><input class="input" type="number" min="0" max="100" step="0.5" data-bulk="${f}" placeholder="–" /><i>%</i></span></label>`).join('')}
            <label class="field adj-bulk-wide"><span class="field-label">${t('col_justification', 'เหตุผลประกอบ')}</span><input class="input" type="text" data-bulk="justification" placeholder="${isTh ? 'เหตุผล' : 'Justification'}" /></label>
            <label class="field adj-bulk-wide"><span class="field-label">${t('in_adj_source_ph', 'แหล่งอ้างอิง')}</span><input class="input" type="text" data-bulk="source" placeholder="${isTh ? 'ที่มา' : 'Source'}" /></label>
            <button class="btn btn-secondary" id="btnBulkFill" type="button">${isTh ? 'ใส่ในช่องที่ยังว่าง' : 'Fill empty boxes'}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table adj-table">
            <thead>
              <tr>
                <th>${t('col_outcome_name', 'ผลลัพธ์')}</th>
                <th class="num">${t('field_deadweight', 'Deadweight %')}</th>
                <th class="num">${t('field_attribution', 'Attribution %')}</th>
                <th class="num">${t('field_displacement', 'Displacement %')}</th>
                <th class="num">${t('field_dropoff', 'Drop-off ต่อปี %')}</th>
                <th class="num">${t('col_net_retained', 'สัดส่วนสุทธิที่คงเหลือ')}</th>
                <th>${t('col_justification', 'เหตุผล')}</th>
                <th>${t('in_adj_source_ph', 'แหล่งข้อมูล')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="adjBody">${outcomes.map(rowHtml).join('')}</tbody>
          </table>
        </div>`
        }
      </div>

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(4, {
        canProceed: true,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ตรวจสอบความถูกต้องและคำนวณ (Step 5) →'
          : 'Continue: Review & Readiness (Step 5) →',
      })}
    </div>
  `;

  const body = container.querySelector('#adjBody');
  if (!body) return;

  const readRow = (tr) => {
    const out = {};
    for (const f of FIELDS) {
      const el = tr.querySelector(`[data-f="${f}"]`);
      el.classList.remove('is-invalid');
      if (el.value.trim() === '') {
        out[f] = null;
        continue;
      }
      const n = Number(el.value);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        el.classList.add('is-invalid');
        return { error: t('in_adj_range', 'กรุณาระบุเปอร์เซ็นต์ระหว่าง 0 ถึง 100') };
      }
      out[f] = n / 100;
    }
    out.justification = tr.querySelector('[data-f="justification"]').value.trim() || null;
    out.source = tr.querySelector('[data-f="source"]').value.trim() || null;
    return out;
  };

  const paintFactor = (tr) => {
    const vals = readRow(tr);
    const cell = tr.querySelector('.adj-factor');
    if (vals.error) {
      cell.textContent = '';
      return;
    }
    const f = retainedFactor(vals);
    cell.innerHTML =
      f === null
        ? `<span class="muted">${t('in_adj_incomplete', 'ยังไม่ประเมิน')}</span>`
        : `${(f * 100).toFixed(1)}%`;
  };

  const paintProgress = () => {
    const done = [...body.querySelectorAll('tr')].filter((tr) => {
      const v = readRow(tr);
      return !v.error && retainedFactor(v) !== null;
    }).length;
    const el = container.querySelector('#adjProgress');
    if (el) el.textContent = `${isTh ? 'ประเมินแล้ว' : 'Assessed'}: ${done}/${outcomes.length}`;
  };

  const setState = (tr, kind, msg = '') => {
    const el = tr.querySelector('.adj-state');
    el.textContent = kind === 'saving' ? '…' : kind === 'saved' ? '✓' : kind === 'error' ? '⚠' : '';
    el.title = msg;
    el.style.color = kind === 'error' ? 'var(--negative)' : 'var(--positive)';
    if (kind === 'saved') setTimeout(() => el.textContent === '✓' && (el.textContent = ''), 1500);
  };

  let chain = Promise.resolve();
  const saveRow = (tr, { refresh = true } = {}) => {
    const id = Number(tr.dataset.outcomeId);
    const vals = readRow(tr);
    if (vals.error) {
      setState(tr, 'error', vals.error);
      return Promise.resolve();
    }
    setState(tr, 'saving');
    chain = chain
      .then(() => saveAdjustment(id, vals, { refresh }))
      .then(() => setState(tr, 'saved'))
      .catch((err) => setState(tr, 'error', err.message));
    return chain;
  };

  const timers = new Map();
  body.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || !e.target.matches('.adj-in')) return;
    paintFactor(tr);
    paintProgress();
    clearTimeout(timers.get(tr));
    timers.set(
      tr,
      setTimeout(() => saveRow(tr), 700),
    );
  });
  body.addEventListener('change', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || !e.target.matches('.adj-in')) return;
    clearTimeout(timers.get(tr));
    saveRow(tr);
  });

  body.addEventListener('click', (e) => {
    const yp = e.target.closest('[data-year-projections]');
    if (yp) {
      const target = outcomes.find((o) => o.id === Number(yp.dataset.yearProjections));
      if (target)
        openYearProjectionsModal({
          project,
          outcome: target,
          onSaved: () => renderStep4(container),
        });
      return;
    }
    const cp = e.target.closest('[data-copy-prev]');
    if (cp) {
      const tr = cp.closest('tr');
      const prev = tr.previousElementSibling;
      if (!prev) return;
      [...FIELDS, 'justification', 'source'].forEach((f) => {
        tr.querySelector(`[data-f="${f}"]`).value = prev.querySelector(`[data-f="${f}"]`).value;
      });
      paintFactor(tr);
      paintProgress();
      saveRow(tr);
    }
  });

  container.querySelector('#btnBulkFill')?.addEventListener('click', async () => {
    const bulk = {};
    container
      .querySelectorAll('[data-bulk]')
      .forEach((el) => (bulk[el.dataset.bulk] = el.value.trim()));
    const changedRows = [];
    body.querySelectorAll('tr').forEach((tr) => {
      let changed = false;
      Object.entries(bulk).forEach(([f, v]) => {
        if (v === '') return;
        const el = tr.querySelector(`[data-f="${f}"]`);
        if (el && el.value.trim() === '') {
          el.value = v;
          changed = true;
        }
      });
      if (changed) changedRows.push(tr);
    });
    changedRows.forEach(paintFactor);
    paintProgress();
    await Promise.all(changedRows.map((tr) => saveRow(tr, { refresh: false })));
    await refreshCalculations();
  });

  body.querySelectorAll('tr').forEach(paintFactor);
  paintProgress();

  attachWizardFooterEvents(container);
}

function openYearProjectionsModal({ project, outcome, onSaved }) {
  const years = project.analysis_period_years || 5;
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const rows = [];
  for (let y = 1; y <= years; y++) {
    rows.push(`
      <tr>
        <td class="strong">${t('year', 'ปีที่')} ${y}</td>
        <td>
          <input type="number" step="1" min="0" class="input input-cell" name="qty_${y}" placeholder="${isTh ? 'ค่าเริ่มต้น' : 'Default'} (${outcome.quantity})" />
        </td>
        <td>
          <input type="number" step="0.5" min="0" max="100" class="input input-cell" name="dropoff_${y}" placeholder="${isTh ? 'ค่าเริ่มต้น %' : 'Default %'}" />
        </td>
      </tr>
    `);
  }

  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        ${isTh ? `กำหนดจำนวนคนหรืออัตรา Drop-off แยกเฉพาะรายปีสำหรับผลลัพธ์` : 'Define annual overrides for'} <strong>"${escapeHtml(outcome.name)}"</strong>
      </p>

      <form id="yearProjForm">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('year', 'ปี')}</th>
                <th>${t('col_quantity', 'จำนวนเฉพาะปีนั้น (Override)')}</th>
                <th>${t('field_dropoff', 'Drop-off เฉพาะปีนั้น (%)')}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        </div>
      </form>
      <div id="yearProjError" class="alert alert-danger" style="display: none;"></div>
    </div>
  `;

  openModal({
    title: `${isTh ? 'ปรับปรุงการลดทอนรายปี — ' : 'Annual Projections Override — '}${outcome.name}`,
    body: modalHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
      <button class="btn btn-primary" id="btnSaveYearProj">${t('save', 'บันทึกการปรับปรุงรายปี')}</button>
    `,
  });

  api.getYearProjections(project.id, outcome.id).then((res) => {
    const list = res?.data || [];
    const form = document.getElementById('yearProjForm');
    if (!form) return;
    list.forEach((p) => {
      const qInput = form[`qty_${p.year}`];
      const dInput = form[`dropoff_${p.year}`];
      if (qInput && p.quantity !== null) qInput.value = p.quantity;
      if (dInput && p.drop_off !== null) dInput.value = p.drop_off * 100;
    });
  });

  document.getElementById('btnSaveYearProj')?.addEventListener('click', async () => {
    const form = document.getElementById('yearProjForm');
    const errBox = document.getElementById('yearProjError');
    if (!form) return;

    const projections = [];
    for (let y = 1; y <= years; y++) {
      const qVal = form[`qty_${y}`].value ? parseFloat(form[`qty_${y}`].value) : null;
      const dVal = form[`dropoff_${y}`].value ? parseFloat(form[`dropoff_${y}`].value) / 100 : null;

      if (qVal !== null || dVal !== null) {
        projections.push({
          year: y,
          quantity: qVal,
          drop_off: dVal,
        });
      }
    }

    try {
      await saveYearProjections(outcome.id, projections);
      closeModal();
      onSaved();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
