/**
 * Step 4: Impact Adjustments: How Much Change Can We Claim?
 * Fully bilingual (Thai & English)
 */

import { getState, saveAdjustment, saveYearProjections } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { api } from '../../api.js';
import { t } from '../../i18n.js';

export function renderStep4(container) {
  const { project, outcomes } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Formula Explanation Card -->
      <div class="card has-stripe" style="background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); --stripe: var(--accent);">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('adj_card_title', 'Impact Deductions & Additionality')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('adj_card_desc', 'Do not claim all observed change. Deduct deadweight, attribution, and displacement multiplicatively.')}
            </p>
          </div>
        </div>
        <div class="formula-box" style="font-weight: 600; font-size: 0.875rem;">
          ${t('adj_formula', 'Adjusted Impact = Gross Value × (1 − Deadweight) × (1 − Attribution) × (1 − Displacement)')}
        </div>
        <div class="muted" style="font-size: 0.8125rem; margin-top: var(--sp-xs);">
          ${t('adj_note', '* Note: Percentages are entered as integers (e.g. 20 for 20%), converted to fractions for calculation.')}
        </div>
      </div>

      <!-- Adjustments Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('adj_matrix_title', 'Outcome Adjustment Matrix')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('adj_matrix_desc', 'Configure Deadweight, Attribution, Displacement, and Annual Drop-off for each outcome')}
            </p>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_outcome_name', 'Outcome')}</th>
                <th class="num">${t('field_deadweight', 'Deadweight %')}</th>
                <th class="num">${t('field_attribution', 'Attribution %')}</th>
                <th class="num">${t('field_displacement', 'Displacement %')}</th>
                <th class="num">${t('field_dropoff', 'Annual Drop-off %')}</th>
                <th class="num">${t('col_net_retained', 'Net Retained Factor')}</th>
                <th>${t('col_justification', 'Justification')}</th>
                <th>${t('col_actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${
                outcomes.length === 0
                  ? `<tr><td colspan="8" class="empty">${t('no_outcomes_yet', 'No outcomes to adjust. Please add outcomes in Step 3.')}</td></tr>`
                  : outcomes
                      .map((o) => {
                        const adj = o.adjustment || {};
                        const dw = adj.deadweight !== null && adj.deadweight !== undefined ? adj.deadweight * 100 : 0;
                        const at = adj.attribution !== null && adj.attribution !== undefined ? adj.attribution * 100 : 0;
                        const dp = adj.displacement !== null && adj.displacement !== undefined ? adj.displacement * 100 : 0;
                        const doff = adj.drop_off !== null && adj.drop_off !== undefined ? adj.drop_off * 100 : 0;

                        const factor = (1 - dw / 100) * (1 - at / 100) * (1 - dp / 100);
                        const factorPct = (factor * 100).toFixed(1);

                        return `
                  <tr data-outcome-id="${o.id}">
                    <td class="strong">
                      <div style="color: var(--on-background);">${escapeHtml(o.name)}</div>
                      <div class="muted" style="font-size: 0.75rem;">${escapeHtml(o.projection_model)} | ${o.duration_years} ${t('years', 'yrs')}</div>
                    </td>
                    <td class="num">
                      <span class="badge ${dw > 0 ? 'badge-planned' : 'badge-mock'}">${dw}%</span>
                    </td>
                    <td class="num">
                      <span class="badge ${at > 0 ? 'badge-planned' : 'badge-mock'}">${at}%</span>
                    </td>
                    <td class="num">
                      <span class="badge ${dp > 0 ? 'badge-planned' : 'badge-mock'}">${dp}%</span>
                    </td>
                    <td class="num">
                      <span class="badge ${doff > 0 ? 'badge-planned' : 'badge-mock'}">${doff}%</span>
                    </td>
                    <td class="num strong" style="color: var(--primary);">
                      ${factorPct}%
                    </td>
                    <td style="max-width: 200px; font-size: 0.75rem;">
                      ${
                        adj.justification
                          ? escapeHtml(adj.justification)
                          : `<span class="muted" style="color: var(--warning);">⚠️ ${t('stat_unset', 'No justification cited')}</span>`
                      }
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn btn-secondary" data-edit-adj="${o.id}" style="height: 30px; font-size: 0.75rem; padding: 0 8px;">
                          ${t('btn_edit_adj', 'Adjust')}
                        </button>
                        <button class="btn btn-secondary" data-year-projections="${o.id}" style="height: 30px; font-size: 0.75rem; padding: 0 8px;" title="${t('btn_multi_year', 'Annual Projections Override')}">
                          ${t('btn_multi_year', 'Annual')}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-edit-adj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.editAdj);
      const target = outcomes.find((o) => o.id === oId);
      if (target) {
        openAdjustmentModal({
          project,
          outcome: target,
          onSaved: () => renderStep4(container),
        });
      }
    });
  });

  container.querySelectorAll('[data-year-projections]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.yearProjections);
      const target = outcomes.find((o) => o.id === oId);
      if (target) {
        openYearProjectionsModal({
          project,
          outcome: target,
          onSaved: () => renderStep4(container),
        });
      }
    });
  });
}

function openAdjustmentModal({ project, outcome, onSaved }) {
  const adj = outcome.adjustment || {};
  const dwVal = adj.deadweight !== null && adj.deadweight !== undefined ? adj.deadweight * 100 : 0;
  const atVal = adj.attribution !== null && adj.attribution !== undefined ? adj.attribution * 100 : 0;
  const dpVal = adj.displacement !== null && adj.displacement !== undefined ? adj.displacement * 100 : 0;
  const doVal = adj.drop_off !== null && adj.drop_off !== undefined ? adj.drop_off * 100 : 0;

  const formHtml = `
    <form id="adjustmentForm" class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        ${t('col_outcome_name', 'Adjusting outcome')}: <strong>${escapeHtml(outcome.name)}</strong>
      </p>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_deadweight', 'A. Deadweight (%)')} *</label>
          <input type="number" name="deadweight" min="0" max="100" step="0.5" class="input" value="${dwVal}" required />
          <span class="muted" style="font-size: 0.6875rem;">What would have happened anyway?</span>
        </div>
        <div class="field">
          <label class="field-label">${t('field_attribution', 'B. Attribution (%)')} *</label>
          <input type="number" name="attribution" min="0" max="100" step="0.5" class="input" value="${atVal}" required />
          <span class="muted" style="font-size: 0.6875rem;">Caused by other contributors?</span>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_displacement', 'C. Displacement (%)')} *</label>
          <input type="number" name="displacement" min="0" max="100" step="0.5" class="input" value="${dpVal}" required />
          <span class="muted" style="font-size: 0.6875rem;">Displaced benefits from elsewhere?</span>
        </div>
        <div class="field">
          <label class="field-label">${t('field_dropoff', 'D. Annual Drop-off (%)')} *</label>
          <input type="number" name="drop_off" min="0" max="100" step="0.5" class="input" value="${doVal}" required />
          <span class="muted" style="font-size: 0.6875rem;">Annual decline in persistence?</span>
        </div>
      </div>

      <div class="field">
        <label class="field-label">${t('field_rationale', 'Evidence Source / Citation')} *</label>
        <input type="text" name="source" class="input" value="${escapeHtml(adj.source || '')}" required placeholder="${t('ph_evidence_source', 'e.g. Comparison group benchmark, Historical dropout rate')}" />
      </div>

      <div class="field">
        <label class="field-label">${t('col_justification', 'Methodological Justification')} *</label>
        <textarea name="justification" class="input" rows="2" required placeholder="${t('ph_adj_justification', 'Explain why these specific percentages represent plausible additionality')}">${escapeHtml(adj.justification || '')}</textarea>
      </div>

      <div class="field">
        <label class="field-label">${t('field_change_reason', 'Reason for Change (Audit Trail)')}</label>
        <input type="text" name="change_reason" class="input" placeholder="${t('ph_change_reason', 'e.g. Updated based on Q3 cohort evaluation data')}" />
      </div>

      <div id="adjModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    <button class="btn btn-primary" id="btnSaveAdjustment">${t('save', 'Save Adjustments')}</button>
  `;

  openModal({
    title: `${t('modal_edit_adj_title', 'Impact Adjustments')} — ${outcome.name}`,
    body: formHtml,
    size: 'lg',
    footer,
  });

  document.getElementById('btnSaveAdjustment')?.addEventListener('click', async () => {
    const form = document.getElementById('adjustmentForm');
    const errBox = document.getElementById('adjModalError');
    if (!form) return;

    const data = {
      deadweight: parseFloat(form.deadweight.value) / 100,
      attribution: parseFloat(form.attribution.value) / 100,
      displacement: parseFloat(form.displacement.value) / 100,
      drop_off: parseFloat(form.drop_off.value) / 100,
      source: form.source.value.trim(),
      justification: form.justification.value.trim(),
    };

    if (isNaN(data.deadweight) || isNaN(data.attribution) || isNaN(data.displacement) || isNaN(data.drop_off)) {
      if (errBox) {
        errBox.textContent = t('required', 'Please enter valid percentage values between 0 and 100.');
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      await saveAdjustment(outcome.id, data);
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
