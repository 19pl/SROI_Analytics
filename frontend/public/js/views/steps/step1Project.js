/**
 * Step 1: Project Details & Total Investment
 */

import { getState, updateProject, addCost, removeCost } from '../../store.js';
import { card, textField, numberField } from '../../components/ui.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';

export function renderStep1(container) {
  const { project, costs, investmentSummary } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">Please select or create a project first.</div>`;
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
      <div class="card" style="background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);">
        <div class="card-head">
          <div>
            <h2 class="card-title">Live Investment Baseline</h2>
            <p class="muted" style="font-size: 0.8125rem;">Resources and capital allocated across the project lifespan</p>
          </div>
          <span class="badge ${project.investment_basis === 'present_value' ? 'badge-integrated' : 'badge-planned'}">
            Basis: ${project.investment_basis === 'present_value' ? 'Present Value' : 'Nominal Cash'}
          </span>
        </div>
        <div class="stat-grid-4" style="margin-bottom: 0;">
          <div class="stat-card">
            <div class="stat-label">Total Investment</div>
            <div class="stat-val" style="color: var(--primary);">
              ${project.currency} ${formatBaht(summary.nominal_total || 0)}
            </div>
            <div class="stat-sub">Present Value: ${project.currency} ${formatBaht(summary.present_value_total || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cash Expenditure</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.cash_total || 0)}</div>
            <div class="stat-sub">Direct financial outlay</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">In-Kind Resources</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.in_kind_total || 0)}</div>
            <div class="stat-sub">${project.include_in_kind ? 'Included in analysis' : 'Excluded from ratio'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Analysis Horizon</div>
            <div class="stat-val">${project.analysis_period_years || 5} Years</div>
            <div class="stat-sub">Discount Rate: ${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) + '%' : 'Unset'}</div>
          </div>
        </div>
      </div>

      <!-- Project Scope Form -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Project Scope & Settings</h2>
            <p class="muted" style="font-size: 0.8125rem;">Define parameters, evaluation type, and discount rate rationale</p>
          </div>
          <button class="btn btn-secondary" id="btnSaveProjectDetails">Save Settings</button>
        </div>
        <form id="projectScopeForm" class="stack" style="gap: var(--sp-lg);">
          <div class="form-grid">
            <div class="field">
              <label class="field-label">Project Name *</label>
              <input type="text" name="name" class="input" value="${escapeHtml(project.name || '')}" required />
            </div>
            <div class="field">
              <label class="field-label">Organization / Institution</label>
              <input type="text" name="organization_name" class="input" value="${escapeHtml(project.organization_name || '')}" placeholder="e.g. Naresuan University" />
            </div>
            <div class="field">
              <label class="field-label">Project Category</label>
              <input type="text" name="category" class="input" value="${escapeHtml(project.category || '')}" placeholder="Education, Health, Community..." />
            </div>
            <div class="field">
              <label class="field-label">Country / Region</label>
              <input type="text" name="country" class="input" value="${escapeHtml(project.country || 'Thailand')}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">Evaluation Type</label>
              <select name="evaluation_type" class="input">
                <option value="forecast" ${project.evaluation_type === 'forecast' ? 'selected' : ''}>Forecast (Ex-ante prospective)</option>
                <option value="evaluative" ${project.evaluation_type === 'evaluative' ? 'selected' : ''}>Evaluative (Ex-post actuals)</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Analysis Period (Years) *</label>
              <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="${project.analysis_period_years || 5}" required />
            </div>
            <div class="field">
              <label class="field-label">Discount Rate (%) *</label>
              <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" value="${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) : '3.5'}" required />
            </div>
            <div class="field">
              <label class="field-label">Discount Rate Basis</label>
              <select name="discount_rate_basis" class="input">
                <option value="real" ${project.discount_rate_basis === 'real' ? 'selected' : ''}>Real (Inflation-adjusted)</option>
                <option value="nominal" ${project.discount_rate_basis === 'nominal' ? 'selected' : ''}>Nominal</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">Investment Valuation Basis</label>
              <select name="investment_basis" class="input">
                <option value="nominal" ${project.investment_basis === 'nominal' ? 'selected' : ''}>Nominal (Total cash expended)</option>
                <option value="present_value" ${project.investment_basis === 'present_value' ? 'selected' : ''}>Present Value (Discounted investment)</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Include In-Kind Resources?</label>
              <select name="include_in_kind" class="input">
                <option value="1" ${project.include_in_kind ? 'selected' : ''}>Yes (Include volunteer time & donations)</option>
                <option value="0" ${!project.include_in_kind ? 'selected' : ''}>No (Exclude in-kind)</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Discount Rate Source / Rationale</label>
              <input type="text" name="discount_rate_source" class="input" value="${escapeHtml(project.discount_rate_source || '')}" placeholder="e.g. Bank of Thailand benchmark" />
            </div>
            <div class="field">
              <label class="field-label">Currency</label>
              <input type="text" name="currency" class="input" value="${escapeHtml(project.currency || 'THB')}" maxlength="3" required />
            </div>
          </div>
        </form>
      </div>

      <!-- Itemized Investment Costs Table -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Itemized Project Costs</h2>
            <p class="muted" style="font-size: 0.8125rem;">Categorize initial capital, operations, delivery, and in-kind contributions</p>
          </div>
          <button class="btn btn-primary" id="btnAddCost">${icons.plus} Add Expense</button>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Type</th>
                <th class="num">Year</th>
                <th class="num">Amount (${project.currency})</th>
                <th class="num">Present Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="costTableBody">
              ${
                costs.length === 0
                  ? `<tr><td colspan="7" class="empty">No expenses added yet. Click "+ Add Expense" to begin.</td></tr>`
                  : costs
                      .map(
                        (c) => `
                <tr data-id="${c.id}">
                  <td><span class="badge badge-planned">${escapeHtml(c.category)}</span></td>
                  <td class="strong">${escapeHtml(c.description)}</td>
                  <td>${c.is_cash ? 'Cash' : '<span class="muted">In-Kind</span>'}</td>
                  <td class="num">Year ${c.year}</td>
                  <td class="num strong">${formatBaht(c.amount * (c.exchange_rate || 1))}</td>
                  <td class="num">${c.present_value !== undefined ? formatBaht(c.present_value) : '-'}</td>
                  <td>
                    <button class="btn-icon" data-remove-cost="${c.id}" title="Delete Expense">${icons.trash}</button>
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
      discount_rate: parseFloat(form.discount_rate.value) / 100,
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
        title: 'Delete Cost Entry',
        message: 'Are you sure you want to remove this cost entry?',
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
        <label class="field-label">Expense Description *</label>
        <input type="text" name="description" class="input" required placeholder="e.g. Staff and tutoring costs" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">Category *</label>
          <select name="category" class="input" required>
            <option value="capex">Initial Capital (Capex)</option>
            <option value="opex" selected>Operating Expenditure (Opex)</option>
            <option value="delivery">Program Delivery</option>
            <option value="administration">Administration & Overhead</option>
            <option value="in_kind">Volunteer & In-Kind</option>
            <option value="other">Other Resources</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Amount (${project.currency}) *</label>
          <input type="number" name="amount" min="0" step="0.01" class="input" required placeholder="50000" />
        </div>
        <div class="field">
          <label class="field-label">Incurred Year *</label>
          <input type="number" name="year" min="0" max="${project.analysis_period_years || 5}" class="input" value="0" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">Cost Nature</label>
          <select name="is_cash" class="input">
            <option value="1">Direct Cash Expenditure</option>
            <option value="0">Non-Cash / In-Kind Contribution</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Evidence / Source Citation</label>
          <input type="text" name="evidence_source" class="input" placeholder="e.g. Institutional budget FY2026" />
        </div>
      </div>
      <div id="costModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>Cancel</button>
    <button class="btn btn-primary" id="btnSaveCost">Save Expense</button>
  `;

  openModal({
    title: 'Add Project Expense',
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
    };

    if (!data.description || isNaN(data.amount)) {
      if (errBox) {
        errBox.textContent = 'Please fill in description and valid amount.';
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
