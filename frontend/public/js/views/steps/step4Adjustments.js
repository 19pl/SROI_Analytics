/**
 * Step 4: Impact Adjustments: How Much Change Can We Defensibly Claim?
 * Clean university standard, calm and uncluttered UI.
 * Accordion flow: only ONE outcome open at a time.
 * Closed rows show: outcome name, Complete / Not assessed status, net retained %.
 * Open row has: Deadweight, Attribution, Displacement, Drop-off (with 1-line explanations),
 * Justification box (reason + source), Next outcome and Copy from previous buttons.
 * Formula in collapsed .disclosure. Multi-year override preserved.
 */

import { getState, saveAdjustment, saveYearProjections, refreshCalculations } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { stakeholderLabel } from '../../utils/stakeholderGroups.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { api } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

const FIELDS = ['deadweight', 'attribution', 'displacement', 'drop_off'];
const pctShown = (f) => (f === null || f === undefined ? '' : Math.round(Number(f) * 1e6) / 1e4);

/** net retained share from the three multiplicative deductions; null until all three entered */
function retainedFactor(vals) {
  const [dw, at, dp] = [vals.deadweight, vals.attribution, vals.displacement];
  if ([dw, at, dp].some((x) => x === null || x === undefined)) return null;
  return (1 - dw) * (1 - at) * (1 - dp);
}

/** Same rule as the backend review: all three deductions entered AND a source or justification recorded. */
function isAssessed(vals) {
  return retainedFactor(vals) !== null && Boolean((vals.justification || '').trim() || (vals.source || '').trim());
}

let activeOutcomeId = null;

export function renderStep4(container) {
  const { project, outcomes, stakeholders } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__text">${t('alert_select_project_first', 'Please select or create a project first.')}</p></div>`;
    return;
  }

  const stkById = {};
  stakeholders.forEach((s) => (stkById[s.id] = stakeholderLabel(s)));

  if (!activeOutcomeId || !outcomes.some((o) => o.id === activeOutcomeId)) {
    activeOutcomeId = outcomes[0]?.id || null;
  }

  const renderAccordionItem = (o, index) => {
    const adj = o.adjustment || {};
    const isOpen = o.id === activeOutcomeId;
    const vals = {
      deadweight: adj.deadweight ?? null,
      attribution: adj.attribution ?? null,
      displacement: adj.displacement ?? null,
      drop_off: adj.drop_off ?? null,
      justification: adj.justification || '',
      source: adj.source || '',
    };
    const factor = retainedFactor(vals);
    const isComplete = isAssessed(vals);
    const factorText = isComplete ? `${(factor * 100).toFixed(1)}%` : '–';

    return `
      <div class="panel adj-accordion-item${isOpen ? ' is-open' : ''}" data-outcome-id="${o.id}">
        <div class="adj-header" data-toggle-accordion="${o.id}">
          <div class="adj-header__main">
            <div class="strong adj-header__title">${escapeHtml(o.name)}</div>
            <div class="muted-sm">${escapeHtml(stkById[o.stakeholder_id] || '')} · ${escapeHtml(o.projection_model)} · ${o.duration_years} ${t('years', 'ปี')}</div>
          </div>
          <div class="adj-header__side">
            <span class="status ${isComplete ? 'status--ok' : 'status--draft'}">
              ${isComplete ? (isTh ? 'ประเมินแล้ว' : 'Complete') : (isTh ? 'ยังไม่ได้ประเมิน' : 'Not assessed')}
            </span>
            <div class="muted-sm strong adj-factor-display">
              ${isComplete ? `${factorText} ${isTh ? 'คงเหลือ' : 'retained'}` : (isTh ? '–' : '–')}
            </div>
            <span class="adj-state" aria-live="polite"></span>
            <button type="button" class="btn-icon" aria-label="Toggle details" aria-expanded="${isOpen}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
        </div>

        <div class="adj-body form-stack" ${isOpen ? '' : 'hidden'}>
          <div class="form-row">
            <!-- 1. Deadweight -->
            <div class="field">
              <label class="field-label">${t('field_deadweight', 'Deadweight %')}</label>
              <p class="field-hint field-hint--compact">
                ${isTh ? 'การเปลี่ยนแปลงที่น่าจะเกิดขึ้นอยู่แล้วแม้ไม่มีโครงการ' : 'Change that would have happened anyway without project'}
              </p>
              <div class="pct-wrap">
                <input class="input adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="deadweight" value="${pctShown(adj.deadweight)}" placeholder="–" />
                <span class="muted-sm pct-wrap__suffix">%</span>
              </div>
            </div>

            <!-- 2. Attribution -->
            <div class="field">
              <label class="field-label">${t('field_attribution', 'Attribution %')}</label>
              <p class="field-hint field-hint--compact">
                ${isTh ? 'สัดส่วนผลลัพธ์ที่เกิดจากหน่วยงานอื่นหรือภาคีร่วม' : 'Share of change caused by other partners / factors'}
              </p>
              <div class="pct-wrap">
                <input class="input adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="attribution" value="${pctShown(adj.attribution)}" placeholder="–" />
                <span class="muted-sm pct-wrap__suffix">%</span>
              </div>
            </div>
          </div>

          <div class="form-row">
            <!-- 3. Displacement -->
            <div class="field">
              <label class="field-label">${t('field_displacement', 'Displacement %')}</label>
              <p class="field-hint field-hint--compact">
                ${isTh ? 'ผลกระทบที่ไปลดทอนประโยชน์หรือย้ายปัญหาไปสู่กลุ่มอื่น' : 'Displaced problems or harm created for other groups'}
              </p>
              <div class="pct-wrap">
                <input class="input adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="displacement" value="${pctShown(adj.displacement)}" placeholder="–" />
                <span class="muted-sm pct-wrap__suffix">%</span>
              </div>
            </div>

            <!-- 4. Drop-off -->
            <div class="field">
              <label class="field-label">${t('field_dropoff', 'Drop-off % ต่อปี')}</label>
              <p class="field-hint field-hint--compact">
                ${isTh ? 'อัตราการลดทอนของผลประโยชน์ในแต่ละปีถัดไป' : 'Annual rate at which the outcome effect fades'}
              </p>
              <div class="pct-wrap">
                <input class="input adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="drop_off" value="${pctShown(adj.drop_off)}" placeholder="–" />
                <span class="muted-sm pct-wrap__suffix">%</span>
              </div>
            </div>
          </div>

          <!-- Justification box (Reason + Source) -->
          <div class="field">
            <label class="field-label">${t('col_justification', 'คำอธิบายเหตุผลและแหล่งอ้างอิง (Justification & Source)')}</label>
            <div class="form-row">
              <input class="input adj-in adj-text" type="text" data-f="justification" value="${escapeHtml(adj.justification || '')}" placeholder="${isTh ? 'เหตุผลในการกำหนด %' : 'Reason / Rationale'}" />
              <input class="input adj-in adj-text" type="text" data-f="source" value="${escapeHtml(adj.source || '')}" placeholder="${isTh ? 'แหล่งอ้างอิง / ข้อมูลสำรวจ' : 'Citation / Source'}" />
            </div>
          </div>

          <!-- Action buttons within accordion -->
          <div class="adj-footer">
            <div class="adj-footer__group">
              <button type="button" class="btn btn-secondary btn-sm" data-copy-prev="${o.id}" ${index === 0 ? 'disabled' : ''}>
                ${isTh ? 'คัดลอกค่าจากผลลัพธ์ก่อนหน้า' : 'Copy from previous outcome'}
              </button>
              <button type="button" class="btn btn-secondary btn-sm" data-year-projections="${o.id}">
                ${t('btn_multi_year', 'รายปี')} (${isTh ? 'กำหนดแยกรายปี' : 'Overrides'})
              </button>
            </div>
            ${
              index < outcomes.length - 1
                ? `<button type="button" class="btn btn-primary btn-sm" data-next-outcome="${o.id}">
                    ${isTh ? 'ผลลัพธ์ถัดไป →' : 'Next outcome →'}
                  </button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="stack-md">
      <header class="page-head">
        <div>
          <h1 class="page-head__title">
            ${isTh ? 'ขั้นตอนที่ 4: ปรับปรุงผลกระทบส่วนเกิน (Impact Adjustments)' : 'Step 4: Impact Deductions'}
          </h1>
          <p class="page-head__sub">
            ${
              isTh
                ? 'หลักการสำคัญของ SROI คือไม่กล่าวอ้างผลงานเกินจริง หักส่วนที่น่าจะเกิดขึ้นอยู่แล้วหรือเกิดจากผู้อื่น เพื่อคำนวณผลกระทบสุทธิ'
                : 'Do not claim all observed change. Deduct what would have happened anyway or was caused by others to isolate true additionality.'
            }
          </p>
        </div>
        <div class="page-head__actions">
          <span class="muted-sm strong" id="adjProgress"></span>
        </div>
      </header>

      <!-- Collapsed Formula Disclosure -->
      <details class="disclosure">
        <summary class="disclosure__summary">
          ${isTh ? 'สูตรการคำนวณผลกระทบสุทธิและคำอธิบาย 4 ตัวแปร' : 'Adjustment Formula & Definition of the 4 Deductions'}
        </summary>
        <div class="stack-sm muted-sm">
          <div class="formula-box">
            ${t('adj_formula', 'ผลกระทบสุทธิที่ยอมรับได้ = มูลค่าขั้นต้น × (1 − Deadweight) × (1 − Attribution) × (1 − Displacement)')}
          </div>
          <p>
            <strong>1. Deadweight:</strong> ${isTh ? 'สิ่งที่น่าจะเกิดขึ้นอยู่แล้วแม้ไม่มีโครงการ' : 'What would have happened anyway without the project.'}
          </p>
          <p>
            <strong>2. Attribution:</strong> ${isTh ? 'ผลลัพธ์ที่เกิดจากการร่วมมือของหน่วยงานอื่น' : 'Contribution by other partners or external investments.'}
          </p>
          <p>
            <strong>3. Displacement:</strong> ${isTh ? 'ผลลัพธ์ที่ไปย้ายปัญหาหรือสร้างผลเสียให้กลุ่มอื่น' : 'Activities that displaced other positive activities or shifted problems.'}
          </p>
          <p>
            <strong>4. Drop-off:</strong> ${isTh ? 'อัตราการลดทอนของผลลัพธ์ในแต่ละปีถัดไป' : 'Annual rate at which the outcome effect fades over time.'}
          </p>
          <p class="field-hint">
            <strong>${isTh ? 'สำคัญ:' : 'Note:'}</strong> ${isTh ? 'ช่องว่าง (–) หมายถึง "ยังไม่ได้ประเมิน" ระบบจะไม่แปลงเป็น 0% เอง หากไม่มีการหักลบ ให้กรอกเลข 0 อย่างชัดเจน' : 'A blank field (–) remains "Not assessed" and is never silently treated as 0%. Enter 0 explicitly if no deduction applies.'}
          </p>
        </div>
      </details>

      <!-- Accordion List of Outcomes -->
      ${
        outcomes.length === 0
          ? `<div class="empty-state">
              <h3 class="empty-state__title">${isTh ? 'ยังไม่มีผลลัพธ์ให้ปรับปรุง' : 'No outcomes to adjust'}</h3>
              <p class="empty-state__text"><a href="#/wizard/step-3">${isTh ? 'กรุณาเพิ่มผลลัพธ์ในขั้นตอนที่ 3 ก่อน' : 'Please add outcomes in Step 3 first.'}</a></p>
            </div>`
          : `<div class="stack-sm" id="adjAccordionList">
              ${outcomes.map(renderAccordionItem).join('')}
            </div>`
      }

      ${wizardFooterHtml(4, {
        canProceed: true,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ตรวจสอบความถูกต้องและคำนวณ (Step 5) →'
          : 'Continue: Review & Readiness (Step 5) →',
      })}
    </div>
  `;

  const accordionList = container.querySelector('#adjAccordionList');
  if (!accordionList) return;

  const readRow = (itemEl) => {
    const out = {};
    for (const f of FIELDS) {
      const el = itemEl.querySelector(`[data-f="${f}"]`);
      if (!el) continue;
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
    out.justification = itemEl.querySelector('[data-f="justification"]')?.value.trim() || null;
    out.source = itemEl.querySelector('[data-f="source"]')?.value.trim() || null;
    return out;
  };

  const paintFactor = (itemEl) => {
    const vals = readRow(itemEl);
    const cell = itemEl.querySelector('.adj-factor-display');
    const statusPill = itemEl.querySelector('.status');
    if (!cell) return;
    if (vals.error) {
      cell.textContent = '';
      return;
    }
    const f = retainedFactor(vals);
    const isComplete = isAssessed(vals);
    cell.textContent = isComplete ? `${(f * 100).toFixed(1)}% ${isTh ? 'คงเหลือ' : 'retained'}` : '–';
    if (statusPill) {
      statusPill.className = `status ${isComplete ? 'status--ok' : 'status--draft'}`;
      statusPill.textContent = isComplete ? (isTh ? 'ประเมินแล้ว' : 'Complete') : (isTh ? 'ยังไม่ได้ประเมิน' : 'Not assessed');
    }
  };

  const paintProgress = () => {
    const done = [...accordionList.querySelectorAll('.adj-accordion-item')].filter((itemEl) => {
      const v = readRow(itemEl);
      return !v.error && isAssessed(v);
    }).length;
    const el = container.querySelector('#adjProgress');
    if (el) el.textContent = `${isTh ? 'ประเมินแล้ว' : 'Assessed'}: ${done}/${outcomes.length}`;
  };

  const setState = (itemEl, kind, msg = '') => {
    const el = itemEl.querySelector('.adj-state');
    if (!el) return;
    el.textContent = kind === 'saving' ? '…' : kind === 'saved' ? '✓' : kind === 'error' ? '!' : '';
    el.title = msg;
    el.style.color = kind === 'error' ? 'var(--negative-fg)' : 'var(--positive-fg)';
    if (kind === 'saved') setTimeout(() => el.textContent === '✓' && (el.textContent = ''), 1500);
  };

  // The footer's Next button is rendered from state.review, which only changes after a save.
  // Re-draw just the footer once the latest review is in, so the button unlocks without a page reload.
  const refreshFooter = () => {
    const oldFooter = container.querySelector('.wizard-footer');
    if (!oldFooter) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = wizardFooterHtml(4, {
      canProceed: true,
      nextLabel: isTh
        ? 'บันทึกและไปต่อ: ตรวจสอบความถูกต้องและคำนวณ (Step 5) →'
        : 'Continue: Review & Readiness (Step 5) →',
    }).trim();
    const newFooter = tpl.content.firstElementChild;
    if (!newFooter) return;
    oldFooter.replaceWith(newFooter);
    attachWizardFooterEvents(newFooter);
  };

  let chain = Promise.resolve();
  const saveRow = (itemEl, { refresh = true } = {}) => {
    const id = Number(itemEl.dataset.outcomeId);
    const vals = readRow(itemEl);
    if (vals.error) {
      setState(itemEl, 'error', vals.error);
      return Promise.resolve();
    }
    setState(itemEl, 'saving');
    chain = chain
      .then(() => saveAdjustment(id, vals, { refresh }))
      .then(() => {
        setState(itemEl, 'saved');
        if (refresh) refreshFooter();
      })
      .catch((err) => setState(itemEl, 'error', err.message));
    return chain;
  };

  // Accordion toggle handler: only ONE outcome open at a time
  const openOutcomeAccordion = (id) => {
    activeOutcomeId = id;
    accordionList.querySelectorAll('.adj-accordion-item').forEach((item) => {
      const itemOutcomeId = Number(item.dataset.outcomeId);
      const isTarget = itemOutcomeId === id;
      const body = item.querySelector('.adj-body');
      const chevronBtn = item.querySelector('[aria-label="Toggle details"]');
      if (body) body.hidden = !isTarget;
      if (chevronBtn) {
        chevronBtn.setAttribute('aria-expanded', String(isTarget));
        chevronBtn.style.transform = isTarget ? 'rotate(180deg)' : 'none';
      }
    });
  };

  accordionList.querySelectorAll('[data-toggle-accordion]').forEach((header) => {
    header.addEventListener('click', () => {
      const id = Number(header.dataset.toggleAccordion);
      if (activeOutcomeId === id) {
        // Toggle closed if clicking same open header
        openOutcomeAccordion(null);
      } else {
        openOutcomeAccordion(id);
      }
    });
  });

  const timers = new Map();
  accordionList.addEventListener('input', (e) => {
    const itemEl = e.target.closest('.adj-accordion-item');
    if (!itemEl || !e.target.matches('.adj-in')) return;
    paintFactor(itemEl);
    paintProgress();
    clearTimeout(timers.get(itemEl));
    timers.set(
      itemEl,
      setTimeout(() => saveRow(itemEl), 700),
    );
  });

  accordionList.addEventListener('change', (e) => {
    const itemEl = e.target.closest('.adj-accordion-item');
    if (!itemEl || !e.target.matches('.adj-in')) return;
    clearTimeout(timers.get(itemEl));
    saveRow(itemEl);
  });

  accordionList.addEventListener('click', (e) => {
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
      const itemEl = cp.closest('.adj-accordion-item');
      const prevEl = itemEl.previousElementSibling;
      if (!prevEl) return;
      [...FIELDS, 'justification', 'source'].forEach((f) => {
        const prevInput = prevEl.querySelector(`[data-f="${f}"]`);
        const curInput = itemEl.querySelector(`[data-f="${f}"]`);
        if (prevInput && curInput) {
          curInput.value = prevInput.value;
        }
      });
      paintFactor(itemEl);
      paintProgress();
      saveRow(itemEl);
      return;
    }

    const nextBtn = e.target.closest('[data-next-outcome]');
    if (nextBtn) {
      const currentId = Number(nextBtn.dataset.nextOutcome);
      const idx = outcomes.findIndex((o) => o.id === currentId);
      if (idx !== -1 && idx < outcomes.length - 1) {
        const nextId = outcomes[idx + 1].id;
        openOutcomeAccordion(nextId);
        const nextItem = accordionList.querySelector(`[data-outcome-id="${nextId}"]`);
        nextItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  });

  accordionList.querySelectorAll('.adj-accordion-item').forEach(paintFactor);
  paintProgress();
  refreshFooter();

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
    <div class="form-stack">
      <p class="muted-sm">
        ${isTh ? 'กำหนดจำนวนคนหรืออัตรา Drop-off แยกเฉพาะรายปีสำหรับผลลัพธ์' : 'Define annual overrides for'} <strong>"${escapeHtml(outcome.name)}"</strong>
      </p>

      <form id="yearProjForm">
        <div class="table-wrap">
          <table class="table table--compact">
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
      <div id="yearProjError" class="field-error" hidden></div>
    </div>
  `;

  openModal({
    title: `${isTh ? 'ปรับปรุงการลดทอนรายปี — ' : 'Annual Projections Override — '}${outcome.name}`,
    body: modalHtml,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
      <button type="button" class="btn btn-primary" id="btnSaveYearProj">${t('save', 'บันทึกการปรับปรุงรายปี')}</button>
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
        errBox.hidden = false;
      }
    }
  });
}