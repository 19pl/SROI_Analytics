/**
 * Step 4: Impact Adjustments: How Much Change Can We Claim?
 * Fully bilingual (Thai & English)
 */

import { getState, saveAdjustment, saveYearProjections, refreshCalculations } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { stakeholderLabel } from '../../utils/stakeholderGroups.js';

import { escapeHtml } from '../../utils/html.js';
import { api } from '../../api.js';
import { t } from '../../i18n.js';

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
          <div class="muted" style="font-size: 0.75rem;">${escapeHtml(stkById[o.stakeholder_id] || '')} · ${escapeHtml(o.projection_model)} · ${o.duration_years} ${t('years', 'yrs')}</div>
        </td>
        ${FIELDS.map(
          (f) => `<td class="num"><span class="pct-wrap"><input class="input input-cell adj-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-f="${f}" value="${pctShown(adj[f])}" placeholder="–" aria-label="${f}" /><i>%</i></span></td>`,
        ).join('')}
        <td class="num strong adj-factor" style="color: var(--primary);"></td>
        <td><input class="input input-cell adj-in adj-text" type="text" data-f="justification" value="${escapeHtml(adj.justification || '')}" placeholder="${t('in_adj_reason_ph', 'Why these percentages?')}" /></td>
        <td><input class="input input-cell adj-in adj-text" type="text" data-f="source" value="${escapeHtml(adj.source || '')}" placeholder="${t('in_adj_source_ph', 'Source')}" /></td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-icon" data-copy-prev="${o.id}" title="${t('in_adj_copy_prev', 'Copy values from the row above')}">⤓</button>
            <button class="btn btn-secondary" data-year-projections="${o.id}" style="height: 30px; font-size: 0.75rem; padding: 0 8px;" title="${t('btn_multi_year', 'Annual')}">${t('btn_multi_year', 'Annual')}</button>
            <span class="adj-state" aria-live="polite"></span>
          </div>
        </td>
      </tr>`;
  };

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <div class="card has-stripe" style="background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); --stripe: var(--accent);">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('adj_card_title', 'Impact Deductions & Additionality')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('adj_card_desc', 'Do not claim all observed change. Deduct deadweight, attribution, and displacement multiplicatively.')}</p>
          </div>
        </div>
        <div class="formula-box" style="font-weight: 600; font-size: 0.875rem;">
          ${t('adj_formula', 'Adjusted Impact = Gross Value × (1 − Deadweight) × (1 − Attribution) × (1 − Displacement)')}
        </div>
        <div class="muted" style="font-size: 0.8125rem; margin-top: var(--sp-xs);">
          ${t('adj_note', '* Note: Percentages are entered as integers (e.g. 20 for 20%), converted to fractions for calculation.')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('adj_matrix_title', 'Outcome Adjustment Matrix')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('in_adj_desc', 'Type straight into the table — every change is saved automatically. An empty box means “not assessed yet” (it is never counted as 0 %).')}</p>
          </div>
          <span class="adj-progress muted" id="adjProgress"></span>
        </div>

        ${
          outcomes.length === 0
            ? `<p class="in-empty muted">${t('no_outcomes_yet', 'No outcomes to adjust. Please add outcomes in Step 3.')}</p>`
            : `
        <div class="adj-bulk">
          <div class="adj-bulk-title"><b>${t('in_adj_bulk', 'Same values for many outcomes?')}</b>
            <span class="muted">${t('in_adj_bulk_hint', 'Enter them once and fill only the boxes that are still empty — nothing you already typed is overwritten.')}</span></div>
          <div class="adj-bulk-row">
            ${FIELDS.map((f) => `<label class="field"><span class="field-label">${t('field_' + (f === 'drop_off' ? 'dropoff' : f), f)}</span><span class="pct-wrap"><input class="input" type="number" min="0" max="100" step="0.5" data-bulk="${f}" placeholder="–" /><i>%</i></span></label>`).join('')}
            <label class="field adj-bulk-wide"><span class="field-label">${t('col_justification', 'Justification')}</span><input class="input" type="text" data-bulk="justification" /></label>
            <label class="field adj-bulk-wide"><span class="field-label">${t('in_adj_source_ph', 'Source')}</span><input class="input" type="text" data-bulk="source" /></label>
            <button class="btn btn-secondary" id="btnBulkFill" type="button">${t('in_adj_bulk_btn', 'Fill empty boxes')}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table adj-table">
            <thead>
              <tr>
                <th>${t('col_outcome_name', 'Outcome')}</th>
                <th class="num">${t('field_deadweight', 'Deadweight %')}</th>
                <th class="num">${t('field_attribution', 'Attribution %')}</th>
                <th class="num">${t('field_displacement', 'Displacement %')}</th>
                <th class="num">${t('field_dropoff', 'Annual Drop-off %')}</th>
                <th class="num">${t('col_net_retained', 'Net Retained Factor')}</th>
                <th>${t('col_justification', 'Justification')}</th>
                <th>${t('in_adj_source_ph', 'Source')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="adjBody">${outcomes.map(rowHtml).join('')}</tbody>
          </table>
        </div>`
        }
      </div>
    </div>
  `;

  const body = container.querySelector('#adjBody');
  if (!body) return;

  /** read one row's boxes → payload (fractions or null) or { error } */
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
        return { error: t('in_adj_range', 'Enter a percentage between 0 and 100.') };
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
    cell.innerHTML = f === null ? `<span class="muted">${t('in_adj_incomplete', 'not assessed')}</span>` : `${(f * 100).toFixed(1)}%`;
  };

  const paintProgress = () => {
    const done = [...body.querySelectorAll('tr')].filter((tr) => {
      const v = readRow(tr);
      return !v.error && retainedFactor(v) !== null;
    }).length;
    const el = container.querySelector('#adjProgress');
    if (el) el.textContent = `${t('in_adj_progress', 'Assessed')}: ${done}/${outcomes.length}`;
  };

  const setState = (tr, kind, msg = '') => {
    const el = tr.querySelector('.adj-state');
    el.textContent = kind === 'saving' ? '…' : kind === 'saved' ? '✓' : kind === 'error' ? '⚠' : '';
    el.title = msg;
    el.style.color = kind === 'error' ? 'var(--negative)' : 'var(--positive)';
    if (kind === 'saved') setTimeout(() => el.textContent === '✓' && (el.textContent = ''), 1500);
  };

  // one save at a time, in order, so quick edits across rows never race each other
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
      if (target) openYearProjectionsModal({ project, outcome: target, onSaved: () => renderStep4(container) });
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
    container.querySelectorAll('[data-bulk]').forEach((el) => (bulk[el.dataset.bulk] = el.value.trim()));
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
}

function openYearProjectionsModal({ project, outcome, onSaved }) {
  const years = project.analysis_period_years || 5;

  const rows = [];
  for (let y = 1; y <= years; y++) {
    rows.push(`
      <tr>
        <td class="strong">${t('year', 'Year')} ${y}</td>
        <td>
          <input type="number" step="1" min="0" class="input input-cell" name="qty_${y}" placeholder="${t('ph_qty_default', 'Default')} (${outcome.quantity})" />
        </td>
        <td>
          <input type="number" step="0.5" min="0" max="100" class="input input-cell" name="dropoff_${y}" placeholder="${t('ph_dropoff_default', 'Default %')}" />
        </td>
      </tr>
    `);
  }

  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        ${t('modal_projections_title', 'Define annual quantity overrides or specific drop-off rates per individual year for')} <strong>"${escapeHtml(outcome.name)}"</strong>.
      </p>

      <form id="yearProjForm">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('year', 'Year')}</th>
                <th>${t('col_quantity', 'Quantity Override')}</th>
                <th>${t('field_dropoff', 'Drop-off Override (%)')}</th>
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
    title: `${t('modal_projections_title', 'Annual Projections Override')} — ${outcome.name}`,
    body: modalHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="btnSaveYearProj">${t('save', 'Save Overrides')}</button>
    `,
  });

  // Preload existing projections
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
