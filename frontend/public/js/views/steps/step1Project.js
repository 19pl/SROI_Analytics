/**
 * Step 1: Project Details & Total Investment
 * Fully bilingual (Thai & English)
 */

import { getState, updateProject, addCost, updateCost, addStakeholder, removeCost } from '../../store.js';
import { card, textField, numberField } from '../../components/ui.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { GROUPS, groupByKey, groupLabel, nextGroupCode, stakeholderOptionsHtml } from '../../utils/stakeholderGroups.js';
import { t } from '../../i18n.js';

export function renderStep1(container) {
  const { project, costs, stakeholders, investmentSummary } = getState();
  const stkById = {};
  stakeholders.forEach((x) => (stkById[x.id] = x));
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
        <p class="in-tip">💡 ${t('in_step1_tip', 'Funding from S2/S3/S4 (faculty, supporters, agencies) can be entered together with the stakeholder in Step 2 — it shows up here automatically.')} <a href="#/wizard/step-2">${t('in_go_step2', 'Go to Step 2')}</a></p>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_cost_cat', 'Category')}</th>
                <th>${t('col_cost_desc', 'Description')}</th>
                <th>${t('in_funder', 'Funder / source')}</th>
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
                  ? `<tr><td colspan="8" class="empty">${t('no_costs_yet', 'No cost items recorded yet. Click "Add Cost Item" to add inputs.')}</td></tr>`
                  : costs
                      .map(
                        (c) => `
                <tr data-id="${c.id}">
                  <td><span class="badge badge-planned">${escapeHtml(c.category)}</span></td>
                  <td class="strong">
                    ${escapeHtml(c.description)}
                    ${c.period_label ? `<span class="badge badge-integrated" style="font-size: 0.6875rem; margin-left: 6px;">${escapeHtml(c.period_label)}</span>` : ''}
                  </td>
                  <td>${c.stakeholder_id && stkById[c.stakeholder_id] ? `<span class="badge badge-integrated">${escapeHtml(stkById[c.stakeholder_id].group_code || '')}</span> ${escapeHtml(stkById[c.stakeholder_id].name)}` : '<span class="muted">–</span>'}</td>
                  <td>${c.is_cash ? 'Cash' : `<span class="muted">${t('cost_cat_inkind', 'In-Kind')}</span>`}</td>
                  <td class="num">${t('year', 'Year')} ${c.year}</td>
                  <td class="num strong">${formatBaht(c.amount * (c.exchange_rate || 1))}</td>
                  <td class="num">${c.present_value !== undefined ? formatBaht(c.present_value) : '-'}</td>
                  <td>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-icon" data-edit-cost="${c.id}" title="${t('edit', 'Edit')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button class="btn-icon" data-remove-cost="${c.id}" title="${t('delete', 'Delete Expense')}">${icons.trash}</button>
                    </div>
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

  container.querySelectorAll('[data-edit-cost]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = costs.find((c) => c.id === Number(btn.dataset.editCost));
      if (target) openAddCostModal({ project, initialData: target, onAdded: () => renderStep1(container) });
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

function openAddCostModal({ project, initialData = null, onAdded }) {
  const { stakeholders } = getState();
  const isEdit = !!initialData;
  const v = (k, d = '') => (initialData && initialData[k] !== null && initialData[k] !== undefined ? initialData[k] : d);
  const funderGroups = GROUPS.filter((g) => g.fundsByDefault);

  const formHtml = `
    <form id="addCostForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
      <div class="field">
        <label class="field-label">${t('col_cost_desc', 'Expense Description')} *</label>
        <input type="text" name="description" class="input" required value="${escapeHtml(v('description'))}" placeholder="e.g. Staff and tutoring costs" />
      </div>

      <div class="field">
        <label class="field-label">${t('in_funder', 'Funder / source')} <span class="muted">(${t('in_funder_hint', 'who provides it — optional')})</span></label>
        <select name="stakeholder_id" class="input">
          <option value="">${t('in_funder_none', '— not specified —')}</option>
          ${stakeholderOptionsHtml(stakeholders, v('stakeholder_id', ''), escapeHtml)}
          <option value="__new__">${t('in_funder_new', '＋ Add a new stakeholder…')}</option>
        </select>
      </div>
      <div class="in-grid" id="newFunderBox" hidden>
        <label class="field in-w6"><span class="field-label">${t('in_funder_new_name', 'New stakeholder name')} *</span>
          <input class="input" name="new_name" /></label>
        <label class="field in-w6"><span class="field-label">${t('in_group_pick', 'Group')}</span>
          <select class="input" name="new_group">${funderGroups.map((g) => `<option value="${g.key}" ${g.key === 'project_supporter' ? 'selected' : ''}>${escapeHtml(groupLabel(g))}</option>`).join('')}</select></label>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_cost_cat', 'Category')} *</label>
          <select name="category" class="input" required>
            ${[
              ['capex', t('cost_cat_capital', 'Initial Capital (Capex)')],
              ['opex', t('cost_cat_operational', 'Operating Expenditure (Opex)')],
              ['delivery', 'Program Delivery'],
              ['administration', t('cost_cat_personnel', 'Administration & Personnel')],
              ['in_kind', t('cost_cat_inkind', 'Volunteer & In-Kind')],
              ['other', 'Other Resources'],
            ]
              .map(([k, l]) => `<option value="${k}" ${(v('category', 'opex')) === k ? 'selected' : ''}>${l}</option>`)
              .join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('col_cost_amount', 'Amount')} (${project.currency}) *</label>
          <input type="text" inputmode="decimal" name="amount" class="input" required value="${v('amount')}" placeholder="50000" />
        </div>
        <div class="field">
          <label class="field-label">${t('col_cost_year', 'Incurred Year')} *</label>
          <input type="number" name="year" min="0" max="${project.analysis_period_years || 5}" class="input" value="${v('year', 0)}" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_cost_type', 'Cost Nature')}</label>
          <select name="is_cash" class="input">
            <option value="1" ${initialData && !initialData.is_cash ? '' : 'selected'}>Direct Cash Expenditure</option>
            <option value="0" ${initialData && !initialData.is_cash ? 'selected' : ''}>${t('cost_cat_inkind', 'Non-Cash / In-Kind Contribution')}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('field_rationale', 'Evidence / Source Citation')}</label>
          <input type="text" name="evidence_source" class="input" value="${escapeHtml(v('evidence_source'))}" placeholder="e.g. Institutional budget FY2026" />
        </div>
        <div class="field">
          <label class="field-label">${t('unit', 'Period Label')} (Optional)</label>
          <input type="text" name="period_label" class="input" value="${escapeHtml(v('period_label'))}" placeholder="e.g. Y0, Y1, 6 months" />
        </div>
      </div>
      <div id="costModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    ${isEdit ? '' : `<button class="btn btn-secondary" id="btnSaveCostNext">${t('in_save_add', 'Save & add next')}</button>`}
    <button class="btn btn-primary" id="btnSaveCost">${t('save', 'Save Expense')}</button>
  `;

  openModal({
    title: isEdit ? t('modal_edit_cost_title', 'Edit Investment Cost') : t('modal_add_cost_title', 'Add Investment Cost'),
    body: formHtml,
    footer,
  });

  const form = document.getElementById('addCostForm');
  const errBox = document.getElementById('costModalError');
  const box = document.getElementById('newFunderBox');
  const showErr = (m) => {
    errBox.textContent = m;
    errBox.style.display = 'block';
  };

  form.stakeholder_id.addEventListener('change', () => {
    box.hidden = form.stakeholder_id.value !== '__new__';
    if (!box.hidden) form.new_name.focus();
  });
  // the category and the cash/in-kind choice must agree (the server forces in-kind to non-cash anyway)
  form.category.addEventListener('change', () => {
    if (form.category.value === 'in_kind') form.is_cash.value = '0';
  });
  form.is_cash.addEventListener('change', () => {
    if (form.is_cash.value === '0' && form.category.value !== 'in_kind') form.category.value = 'in_kind';
  });

  const save = async (andNext) => {
    errBox.style.display = 'none';
    const amount = parseFloat(String(form.amount.value).replace(/[,\s]/g, ''));
    const desc = form.description.value.trim();
    if (!desc || Number.isNaN(amount) || amount < 0) {
      showErr(t('required', 'Please fill in description and valid amount.'));
      return;
    }
    const btns = document.querySelectorAll('#btnSaveCost, #btnSaveCostNext');
    btns.forEach((b) => (b.disabled = true));
    try {
      let funderId = form.stakeholder_id.value === '' ? null : form.stakeholder_id.value === '__new__' ? '__new__' : Number(form.stakeholder_id.value);
      if (funderId === '__new__') {
        const name = form.new_name.value.trim();
        if (!name) throw new Error(t('required', 'Please enter a stakeholder name.'));
        const g = groupByKey(form.new_group.value);
        const created = await addStakeholder({
          name,
          stakeholder_group: g.key,
          group_code: nextGroupCode(getState().stakeholders, g),
          count_unit: g.unit,
          category: 'Government agencies',
        });
        funderId = created.id;
      }
      const data = {
        description: desc,
        category: form.category.value,
        amount,
        currency: project.currency,
        year: parseInt(form.year.value, 10),
        is_cash: form.is_cash.value === '1',
        evidence_source: form.evidence_source.value.trim(),
        period_label: form.period_label.value.trim() || null,
        stakeholder_id: funderId,
      };
      if (isEdit) await updateCost(initialData.id, data);
      else await addCost(data);
      closeModal();
      onAdded();
      if (andNext) {
        openAddCostModal({ project, onAdded });
        // keep the funder and year of the line just saved — the next line is usually from the same source
        const f = document.getElementById('addCostForm');
        if (f && funderId) {
          f.stakeholder_id.value = String(funderId);
          f.year.value = data.year;
        }
      }
    } catch (err) {
      showErr(err.message);
      btns.forEach((b) => (b.disabled = false));
    }
  };
  document.getElementById('btnSaveCost')?.addEventListener('click', () => save(false));
  document.getElementById('btnSaveCostNext')?.addEventListener('click', () => save(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.description.focus();
}
