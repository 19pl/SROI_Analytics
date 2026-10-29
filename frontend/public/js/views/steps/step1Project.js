/**
 * Step 1: Project Details & Total Investment
 * Fully bilingual (Thai & English)
 */

import { getState, updateProject, addCost, removeCost } from '../../store.js';
import { card, textField, numberField } from '../../components/ui.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { t } from '../../i18n.js';

export function renderStep1(container) {
  const { project, costs, investmentSummary } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const summary = investmentSummary || {
    nominal_total: 0,
    present_value_total: 0,
    cash_total: 0,
    in_kind_total: 0,
    by_category: {},
  };

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Live Investment Summary Card -->
      <div class="card has-stripe" style="background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); --stripe: var(--accent);">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('live_inv_baseline', 'Live Investment Baseline')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('live_inv_desc', 'Resources and capital allocated across the project lifespan')}</p>
          </div>
          <span class="badge ${project.investment_basis === 'present_value' ? 'badge-integrated' : 'badge-planned'}">
            ${t('inv_basis_label', 'Basis')}: ${project.investment_basis === 'present_value' ? t('inv_basis_pv', 'Present Value') : t('inv_basis_nominal', 'Nominal Cash')}
          </span>
        </div>
        <div class="stat-grid-4" style="margin-bottom: 0;">
          <div class="stat-card">
            <div class="stat-label">${t('stat_total_inv', 'Total Investment')}</div>
            <div class="stat-val" style="color: var(--primary);">
              ${project.currency} ${formatBaht(summary.nominal_total || 0)}
            </div>
            <div class="stat-sub">${t('col_present_value', 'Present Value')}: ${project.currency} ${formatBaht(summary.present_value_total || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_cash_exp', 'Cash Expenditure')}</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.cash_total || 0)}</div>
            <div class="stat-sub">${t('stat_direct_outlay', 'Direct financial outlay')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_inkind', 'In-Kind Resources')}</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.in_kind_total || 0)}</div>
            <div class="stat-sub">${project.include_in_kind ? t('stat_inkind_included', 'Included in analysis') : t('stat_inkind_excluded', 'Excluded from ratio')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_horizon', 'Analysis Horizon')}</div>
            <div class="stat-val">${project.analysis_period_years || 5} ${t('years', 'Years')}</div>
            <div class="stat-sub">${t('stat_discount_rate', 'Discount Rate')}: ${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) + '%' : t('stat_unset', 'Unset')}</div>
          </div>
        </div>
      </div>

      <!-- Project Scope Form -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('scope_card_title', 'Project Scope & Baseline Parameters')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('scope_card_desc', 'Define evaluation type, evaluation horizon, discount rate, and analytical assumptions')}</p>
          </div>
          <button class="btn btn-secondary" id="btnSaveProjectDetails">${t('btn_save_settings', 'Save Settings')}</button>
        </div>
        <form id="projectScopeForm" class="stack" style="gap: var(--sp-lg);">
          <div class="form-grid">
            <div class="field">
              <label class="field-label">${t('field_project_name', 'Project / Plan Name *')}</label>
              <input type="text" name="name" class="input" value="${escapeHtml(project.name || '')}" required />
            </div>
            <div class="field">
              <label class="field-label">${t('field_org_name', 'Institution / Organization')}</label>
              <input type="text" name="organization_name" class="input" value="${escapeHtml(project.organization_name || '')}" placeholder="e.g. Naresuan University" />
            </div>
            <div class="field">
              <label class="field-label">${t('field_category', 'Project Category')}</label>
              <input type="text" name="category" class="input" value="${escapeHtml(project.category || '')}" placeholder="${t('field_category_ph', 'Education, Health, Community...')}" />
            </div>
            <div class="field">
              <label class="field-label">${t('field_country', 'Country / Region')}</label>
              <input type="text" name="country" class="input" value="${escapeHtml(project.country || 'Thailand')}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">${t('field_eval_type', 'Evaluation Type')}</label>
              <select name="evaluation_type" class="input">
                <option value="forecast" ${project.evaluation_type === 'forecast' ? 'selected' : ''}>${t('eval_type_forecast', 'Forecast (Ex-ante prospective)')}</option>
                <option value="evaluative" ${project.evaluation_type === 'evaluative' ? 'selected' : ''}>${t('eval_type_evaluative', 'Evaluative (Ex-post actuals)')}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">${t('field_analysis_period', 'Analysis Horizon (Years) *')}</label>
              <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="${project.analysis_period_years || 5}" required />
            </div>
            <div class="field">
              <label class="field-label">${t('field_discount_rate', 'Annual Discount Rate (%) *')}</label>
              <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" value="${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) : ''}" placeholder="0.0 or 3.5" required />
            </div>
            <div class="field">
              <label class="field-label">${t('field_assessment_scope', 'Assessment Scope (Months)')}</label>
              <select name="assessment_months" class="input">
                <option value="" ${!project.assessment_months ? 'selected' : ''}>${t('scope_full_year', 'Full Year (12 months / standard)')}</option>
                <option value="6" ${project.assessment_months === 6 ? 'selected' : ''}>${t('scope_6_months', '6 Months (Interim)')}</option>
                <option value="9" ${project.assessment_months === 9 ? 'selected' : ''}>${t('scope_9_months', '9 Months (Interim)')}</option>
                <option value="12" ${project.assessment_months === 12 ? 'selected' : ''}>${t('scope_12_months', '12 Months (Fiscal Year)')}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">${t('field_discount_basis', 'Discount Rate Basis')}</label>
              <select name="discount_rate_basis" class="input">
                <option value="real" ${project.discount_rate_basis === 'real' ? 'selected' : ''}>${t('discount_basis_real', 'Real (Inflation-adjusted)')}</option>
                <option value="nominal" ${project.discount_rate_basis === 'nominal' ? 'selected' : ''}>${t('discount_basis_nominal', 'Nominal')}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">${t('field_inv_basis', 'Investment Valuation Basis')}</label>
              <select name="investment_basis" class="input">
                <option value="nominal" ${project.investment_basis === 'nominal' ? 'selected' : ''}>${t('inv_basis_nominal', 'Nominal Cash')}</option>
                <option value="present_value" ${project.investment_basis === 'present_value' ? 'selected' : ''}>${t('inv_basis_pv', 'Present Value (Discounted investment)')}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">${t('field_include_inkind', 'Include In-Kind Resources?')}</label>
              <select name="include_in_kind" class="input">
                <option value="1" ${project.include_in_kind ? 'selected' : ''}>${t('opt_yes_inkind', 'Yes (Include volunteer time & donations)')}</option>
                <option value="0" ${!project.include_in_kind ? 'selected' : ''}>${t('opt_no_inkind', 'No (Cash expenditures only)')}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">${t('field_rationale', 'Discount Rate Source / Rationale')}</label>
              <input type="text" name="discount_rate_source" class="input" value="${escapeHtml(project.discount_rate_source || '')}" placeholder="${t('field_rationale_ph', 'e.g. Bank of Thailand benchmark')}" />
            </div>
            <div class="field">
              <label class="field-label">${t('field_currency', 'Currency')}</label>
              <input type="text" name="currency" class="input" value="${escapeHtml(project.currency || 'THB')}" maxlength="3" required />
            </div>
          </div>
        </form>
      </div>

      <!-- Itemized Investment Costs Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('inv_items_title', 'Investment & Cost Registry')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('inv_items_desc', 'Itemized financial outlays and resource inputs')}</p>
          </div>
          <button class="btn btn-primary" id="btnAddCost">${icons.plus} ${t('btn_add_cost', 'Add Cost Item')}</button>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_cost_cat', 'Category')}</th>
                <th>${t('col_cost_desc', 'Description')}</th>
                <th>${t('col_cost_type', 'Type')}</th>
                <th class="num">${t('col_cost_year', 'Year')}</th>
                <th class="num">${t('col_cost_amount', 'Amount')} (${project.currency})</th>
                <th class="num">${t('col_cost_pv', 'Present Value')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="costTableBody">
              ${
                costs.length === 0
                  ? `<tr><td colspan="7" class="empty">${t('no_costs_yet', 'No cost items recorded yet. Click "Add Cost Item" to add inputs.')}</td></tr>`
                  : costs
                      .map(
                        (c) => `
                <tr data-id="${c.id}">
                  <td><span class="badge badge-planned">${escapeHtml(c.category)}</span></td>
                  <td class="strong">
                    ${escapeHtml(c.description)}
                    ${c.period_label ? `<span class="badge badge-integrated" style="font-size: 0.6875rem; margin-left: 6px;">${escapeHtml(c.period_label)}</span>` : ''}
                  </td>
                  <td>${c.is_cash ? 'Cash' : `<span class="muted">${t('cost_cat_inkind', 'In-Kind')}</span>`}</td>
                  <td class="num">${t('year', 'Year')} ${c.year}</td>
                  <td class="num strong">${formatBaht(c.amount * (c.exchange_rate || 1))}</td>
                  <td class="num">${c.present_value !== undefined ? formatBaht(c.present_value) : '-'}</td>
                  <td>
                    <button class="btn-icon" data-remove-cost="${c.id}" title="${t('delete', 'Delete Expense')}">${icons.trash}</button>
                  </td>
                </tr>
              `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  document.getElementById('btnSaveProjectDetails')?.addEventListener('click', async () => {
    const form = document.getElementById('projectScopeForm');
    if (!form) return;

    const changes = {
      name: form.name.value.trim(),
      organization_name: form.organization_name.value.trim(),
      category: form.category.value.trim(),
      country: form.country.value.trim(),
      evaluation_type: form.evaluation_type.value,
      analysis_period_years: parseInt(form.analysis_period_years.value, 10),
      assessment_months: form.assessment_months.value ? parseInt(form.assessment_months.value, 10) : null,
      discount_rate: form.discount_rate.value !== '' ? parseFloat(form.discount_rate.value) / 100 : null,
      discount_rate_basis: form.discount_rate_basis.value,
      investment_basis: form.investment_basis.value,
      include_in_kind: form.include_in_kind.value === '1',
      discount_rate_source: form.discount_rate_source.value.trim(),
      currency: form.currency.value.trim().toUpperCase(),
    };

    try {
      await updateProject(changes);
      renderStep1(container);
    } catch (err) {
      alert(`Error updating project: ${err.message}`);
    }
  });

  document.getElementById('btnAddCost')?.addEventListener('click', () => {
    openAddCostModal({
      project,
      onAdded: () => renderStep1(container),
    });
  });

  container.querySelectorAll('[data-remove-cost]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const costId = Number(btn.dataset.removeCost);
      confirmModal({
        title: t('delete', 'Delete Cost Entry'),
        message: t('confirm_delete', 'Are you sure you want to remove this cost entry?'),
        onConfirm: async () => {
          await removeCost(costId);
          renderStep1(container);
        },
      });
    });
  });
}

function openAddCostModal({ project, onAdded }) {
  const formHtml = `
    <form id="addCostForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('col_cost_desc', 'Expense Description')} *</label>
        <input type="text" name="description" class="input" required placeholder="e.g. Staff and tutoring costs" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_cost_cat', 'Category')} *</label>
          <select name="category" class="input" required>
            <option value="capex">${t('cost_cat_capital', 'Initial Capital (Capex)')}</option>
            <option value="opex" selected>${t('cost_cat_operational', 'Operating Expenditure (Opex)')}</option>
            <option value="delivery">${t('cost_cat_operational', 'Program Delivery')}</option>
            <option value="administration">${t('cost_cat_personnel', 'Administration & Personnel')}</option>
            <option value="in_kind">${t('cost_cat_inkind', 'Volunteer & In-Kind')}</option>
            <option value="other">${t('all', 'Other Resources')}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('col_cost_amount', 'Amount')} (${project.currency}) *</label>
          <input type="number" name="amount" min="0" step="0.01" class="input" required placeholder="50000" />
        </div>
        <div class="field">
          <label class="field-label">${t('col_cost_year', 'Incurred Year')} *</label>
          <input type="number" name="year" min="0" max="${project.analysis_period_years || 5}" class="input" value="0" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_cost_type', 'Cost Nature')}</label>
          <select name="is_cash" class="input">
            <option value="1">Direct Cash Expenditure</option>
            <option value="0">${t('cost_cat_inkind', 'Non-Cash / In-Kind Contribution')}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('field_rationale', 'Evidence / Source Citation')}</label>
          <input type="text" name="evidence_source" class="input" placeholder="e.g. Institutional budget FY2026" />
        </div>
        <div class="field">
          <label class="field-label">${t('unit', 'Period Label')} (Optional)</label>
          <input type="text" name="period_label" class="input" placeholder="e.g. Y0, Y1, 6 months" />
        </div>
      </div>
      <div id="costModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    <button class="btn btn-primary" id="btnSaveCost">${t('save', 'Save Expense')}</button>
  `;

  openModal({
    title: t('modal_add_cost_title', 'Add Investment Cost'),
    body: formHtml,
    footer,
  });

  document.getElementById('btnSaveCost')?.addEventListener('click', async () => {
    const form = document.getElementById('addCostForm');
    const errBox = document.getElementById('costModalError');
    if (!form) return;

    const data = {
      description: form.description.value.trim(),
      category: form.category.value,
      amount: parseFloat(form.amount.value),
      currency: project.currency,
      year: parseInt(form.year.value, 10),
      is_cash: form.is_cash.value === '1',
      evidence_source: form.evidence_source.value.trim(),
      period_label: form.period_label.value.trim() || null,
    };

    if (!data.description || isNaN(data.amount)) {
      if (errBox) {
        errBox.textContent = t('required', 'Please fill in description and valid amount.');
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      await addCost(data);
      closeModal();
      onAdded();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
