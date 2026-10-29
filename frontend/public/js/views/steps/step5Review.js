/**
 * Step 5: Calculation Review & Scenario Analysis
 * Fully bilingual (Thai & English)
 */

import { getState, setActiveScenario, addScenario } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht, formatRatio } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';
import { t } from '../../i18n.js';

export function renderStep5(container) {
  const { project, review, activeScenarioId } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const isReady = review?.ready ?? false;
  const blockers = review?.blockers || [];
  const warnings = review?.warnings || [];
  const completion = review?.completion || {};

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Calculation Readiness Banner -->
      <div class="card" style="border-left: 6px solid ${isReady ? 'var(--positive)' : 'var(--negative)'};">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title">
              ${isReady ? t('ready_to_calc', '✅ Ready to Calculate') : t('blockers_identified', '⚠️ Calculation Blockers Identified')}
            </h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${
                isReady
                  ? t('ready_desc', 'All mandatory baseline parameters are satisfied. Review audit warnings and test scenarios below.')
                  : t('blockers_desc', 'Please resolve the following required inputs before generating final results.')
              }
            </p>
          </div>
          <a class="btn btn-primary" href="#/wizard/step-6" ${!isReady ? 'style="opacity: 0.6; pointer-events: none;"' : ''}>
            ${t('btn_proceed_dash', 'Proceed to Dashboard →')}
          </a>
        </div>

        ${
          blockers.length > 0
            ? `
          <div class="stack" style="gap: var(--sp-xs); margin-top: var(--sp-md);">
            ${blockers
              .map(
                (b) => `
              <div class="review-item blocker">
                <span style="font-weight: 700; color: var(--negative);">BLOCKER:</span>
                <div>${escapeHtml(b.message)} <span class="muted" style="font-size: 0.75rem;">(${escapeHtml(b.path)})</span></div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }

        ${
          warnings.length > 0
            ? `
          <div class="stack" style="gap: var(--sp-xs); margin-top: var(--sp-md);">
            <div style="font-size: 0.8125rem; font-weight: 600; color: var(--warning); margin-bottom: 2px;">
              Methodology & Audit Warnings (${warnings.length}):
            </div>
            ${warnings
              .map(
                (w) => `
              <div class="review-item warning">
                <span style="color: var(--warning); font-weight: 700;">⚠️</span>
                <div>${escapeHtml(w.message)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>

      <!-- Per-Step Completion Checklist -->
      <div class="card">
        <div class="card-head">
          <h3 class="card-title" style="font-size: 1rem;">${t('checklist_title', 'Data Completeness Checklist')}</h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--sp-md);">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
            <span style="color: ${completion.costs ? 'var(--positive)' : 'var(--muted)'}; font-weight: 700;">
              ${completion.costs ? '✓' : '○'}
            </span>
            <span>${t('chk_costs', 'Step 1: Project Investment')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
            <span style="color: ${completion.stakeholders ? 'var(--positive)' : 'var(--muted)'}; font-weight: 700;">
              ${completion.stakeholders ? '✓' : '○'}
            </span>
            <span>${t('chk_stk', 'Step 2: Stakeholders')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
            <span style="color: ${completion.outcomes ? 'var(--positive)' : 'var(--muted)'}; font-weight: 700;">
              ${completion.outcomes ? '✓' : '○'}
            </span>
            <span>${t('chk_outcomes', 'Step 3: Outcomes & Proxies')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
            <span style="color: ${completion.adjustments ? 'var(--positive)' : 'var(--muted)'}; font-weight: 700;">
              ${completion.adjustments ? '✓' : '○'}
            </span>
            <span>${t('chk_adj', 'Step 4: Adjustments')}</span>
          </div>
        </div>
      </div>

      <!-- Scenario Analysis Controls -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('scenarios_title', 'Scenario Testing')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('step5_subheading', 'Compare Conservative, Base case, and Optimistic assumptions to understand uncertainty ranges')}
            </p>
          </div>
          <button class="btn btn-secondary" id="btnAddScenario">${t('btn_add_scenario', '+ New Scenario')}</button>
        </div>

        <div id="scenarioComparisonContainer">
          <div class="muted">${t('loading', 'Loading scenario comparison...')}</div>
        </div>
      </div>

      <!-- Tornado Sensitivity Analysis -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('tornado_analysis', 'Tornado Sensitivity Analysis')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('step5_desc', 'Identifies which individual assumptions create the largest swings in the final result')}
            </p>
          </div>
        </div>

        <div id="sensitivityContainer">
          <div class="muted">${t('loading', 'Loading sensitivity analysis...')}</div>
        </div>
      </div>
    </div>
  `;

  // Load Scenario Comparison
  api.getScenarioComparison(project.id).then((res) => {
    const list = res?.data || [];
    const target = document.getElementById('scenarioComparisonContainer');
    if (!target) return;

    if (list.length === 0) {
      target.innerHTML = `<div class="muted" style="padding: 16px;">${t('no_data', 'No scenarios configured yet.')}</div>`;
      return;
    }

    target.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>${t('col_scenario', 'Scenario')}</th>
              <th>${t('col_eval_type', 'Type')}</th>
              <th class="num">${t('col_sroi_ratio', 'SROI Ratio')}</th>
              <th class="num">${t('col_present_value', 'Present Value')}</th>
              <th class="num">${t('col_investment', 'Investment')}</th>
              <th class="num">${t('card_net_social_value', 'Net Social Value')}</th>
              <th>${t('col_actions', 'Action')}</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((sc) => {
                const isSelected = sc.id === activeScenarioId || (!activeScenarioId && sc.is_base);
                return `
                <tr style="${isSelected ? 'background: var(--primary-soft);' : ''}">
                  <td class="strong">${escapeHtml(sc.name)}</td>
                  <td><span class="badge badge-planned">${escapeHtml(sc.kind)}</span></td>
                  <td class="num strong" style="color: var(--primary); font-size: 1.125rem;">
                    ${sc.sroi_ratio !== null ? `${sc.sroi_ratio.toFixed(2)} : 1` : '-'}
                  </td>
                  <td class="num">${project.currency} ${formatBaht(sc.present_value)}</td>
                  <td class="num">${project.currency} ${formatBaht(sc.investment)}</td>
                  <td class="num strong">${project.currency} ${formatBaht(sc.net_social_value)}</td>
                  <td>
                    ${
                      isSelected
                        ? `<span class="badge badge-production">Active</span>`
                        : `<button class="btn btn-secondary" data-select-scenario="${sc.id}" style="height: 28px; font-size: 0.75rem;">Switch</button>`
                    }
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    target.querySelectorAll('[data-select-scenario]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const scId = Number(btn.dataset.selectScenario);
        await setActiveScenario(scId);
        renderStep5(container);
      });
    });
  });

  // Load Tornado Sensitivity Analysis
  api.getSensitivity(project.id).then((res) => {
    const rows = res?.data?.rows || [];
    const target = document.getElementById('sensitivityContainer');
    if (!target) return;

    if (rows.length === 0) {
      target.innerHTML = `<div class="muted" style="padding: 16px;">${t('no_data', 'Sensitivity analysis requires at least one monetized outcome.')}</div>`;
      return;
    }

    target.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>${t('col_outcome_name', 'Outcome / Context')}</th>
              <th class="num">Low Value Ratio</th>
              <th class="num">High Value Ratio</th>
              <th class="num">Swing (${t('col_present_value', 'Present Value')})</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .slice(0, 10)
              .map(
                (r) => `
              <tr>
                <td class="strong">${escapeHtml(r.parameter)}</td>
                <td>${escapeHtml(r.label || '-')}</td>
                <td class="num">${r.sroi_ratio_low !== null ? `${r.sroi_ratio_low.toFixed(2)}:1` : '-'}</td>
                <td class="num">${r.sroi_ratio_high !== null ? `${r.sroi_ratio_high.toFixed(2)}:1` : '-'}</td>
                <td class="num strong" style="color: var(--primary);">
                  ${project.currency} ${formatBaht(r.swing_present_value)}
                </td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  // Add Scenario Button
  document.getElementById('btnAddScenario')?.addEventListener('click', () => {
    openAddScenarioModal({
      project,
      onSaved: () => renderStep5(container),
    });
  });
}

function openAddScenarioModal({ project, onSaved }) {
  const formHtml = `
    <form id="scenarioForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('col_scenario', 'Scenario Name')} *</label>
        <input type="text" name="name" class="input" required placeholder="e.g. Conservative Cohort Retention" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'Scenario Kind')} *</label>
          <select name="kind" class="input" required>
            <option value="conservative">${t('scenario_conservative', 'Conservative Scenario')}</option>
            <option value="optimistic">${t('scenario_optimistic', 'Optimistic Scenario')}</option>
            <option value="custom">${t('scenario_custom', 'Custom Policy Scenario')}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('field_discount_rate', 'Global Discount Rate Override (%)')}</label>
          <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" placeholder="${t('ph_scenario_rate', 'Leave blank to use base rate')}" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">${t('description', 'Description & Rationale')}</label>
        <textarea name="description" class="input" rows="2" placeholder="${t('ph_scenario_desc', 'Document the purpose of this sensitivity scenario')}"></textarea>
      </div>
      <div id="scenarioModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: t('btn_add_scenario', 'Create Alternative Scenario'),
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="btnSaveScenario">${t('save', 'Create Scenario')}</button>
    `,
  });

  document.getElementById('btnSaveScenario')?.addEventListener('click', async () => {
    const form = document.getElementById('scenarioForm');
    const errBox = document.getElementById('scenarioModalError');
    if (!form) return;

    const rateVal = form.discount_rate.value ? parseFloat(form.discount_rate.value) / 100 : null;

    const data = {
      name: form.name.value.trim(),
      kind: form.kind.value,
      description: form.description.value.trim(),
      assumptions: {
        global: rateVal !== null ? { discount_rate: rateVal } : {},
        outcomes: {},
      },
    };

    if (!data.name) {
      if (errBox) {
        errBox.textContent = t('required', 'Please enter a scenario name.');
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      await addScenario(data);
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
