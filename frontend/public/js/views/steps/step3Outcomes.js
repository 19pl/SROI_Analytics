/**
 * Step 3: Outcome & Financial Proxy Mapping: What Changed?
 */

import { getState, addOutcome, updateOutcome, removeOutcome } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { openProxyLibraryModal } from '../../components/proxyModal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';

export function renderStep3(container) {
  const { project, stakeholders, outcomes } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">Please select or create a project first.</div>`;
    return;
  }

  const stakeById = {};
  stakeholders.forEach((s) => (stakeById[s.id] = s.name));

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Education Banner distinguishing Activity vs Output vs Outcome -->
      <div class="alert alert-info" style="align-items: center; justify-content: space-between;">
        <div>
          <strong>Theory of Change:</strong> 
          Measure <em>outcomes</em> (real change experienced by people), not just <em>activities</em> or <em>outputs</em> (e.g. hours delivered).
        </div>
        <button class="btn btn-primary" id="btnAddOutcome">${icons.plus} Build Outcome</button>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Outcome & Financial Proxy Registry</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              Translate measured changes into defensible monetary proxies
            </p>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Outcome / Change</th>
                <th>Stakeholder</th>
                <th>Polarity</th>
                <th class="num">Quantity</th>
                <th class="num">Financial Proxy</th>
                <th class="num">Annual Gross Value</th>
                <th>Evidence Quality</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                outcomes.length === 0
                  ? `<tr><td colspan="8" class="empty">No outcomes created yet. Click "Build Outcome" to map your first change.</td></tr>`
                  : outcomes
                      .map((o) => {
                        const sign = o.polarity === 'negative' ? -1 : 1;
                        const gross = o.proxy_value !== null ? o.quantity * o.proxy_value * sign : null;
                        const stkName = stakeById[o.stakeholder_id] || `Stakeholder #${o.stakeholder_id}`;

                        return `
                  <tr data-id="${o.id}">
                    <td>
                      <div class="strong">${escapeHtml(o.name)}</div>
                      ${o.indicator ? `<span class="muted" style="font-size: 0.75rem;">Indicator: ${escapeHtml(o.indicator)}</span>` : ''}
                    </td>
                    <td>
                      <span class="badge badge-planned">${escapeHtml(stkName)}</span>
                    </td>
                    <td>
                      <span class="polarity-badge ${o.polarity === 'negative' ? 'polarity-negative' : 'polarity-positive'}">
                        ${o.polarity === 'negative' ? '- Harm / Negative' : '+ Benefit'}
                      </span>
                    </td>
                    <td class="num">${Number(o.quantity).toLocaleString()}</td>
                    <td class="num">
                      ${
                        o.proxy_value !== null
                          ? `${project.currency} ${formatBaht(o.proxy_value)} <small class="muted">/${escapeHtml(o.proxy_unit || 'unit')}</small>`
                          : '<span class="muted">Unmonetized</span>'
                      }
                    </td>
                    <td class="num strong" style="color: ${o.polarity === 'negative' ? 'var(--negative)' : 'var(--positive)'};">
                      ${gross !== null ? `${project.currency} ${formatBaht(gross)}` : '-'}
                    </td>
                    <td>
                      <span class="badge badge-${o.evidence_quality === 'measured' ? 'production' : o.evidence_quality === 'external' ? 'integrated' : 'planned'}">
                        ${escapeHtml(o.evidence_quality)}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn-icon" data-edit-outcome="${o.id}" title="Edit Outcome">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="btn-icon" data-evidence-outcome="${o.id}" title="Manage Evidence & Attachments">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <button class="btn-icon" data-remove-outcome="${o.id}" title="Delete Outcome">
                          ${icons.trash}
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

  document.getElementById('btnAddOutcome')?.addEventListener('click', () => {
    if (stakeholders.length === 0) {
      alert('Please add at least one stakeholder in Step 2 before mapping outcomes.');
      return;
    }
    openOutcomeModal({
      project,
      stakeholders,
      onSaved: () => renderStep3(container),
    });
  });

  container.querySelectorAll('[data-edit-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.editOutcome);
      const target = outcomes.find((o) => o.id === oId);
      if (target) {
        openOutcomeModal({
          project,
          stakeholders,
          initialData: target,
          onSaved: () => renderStep3(container),
        });
      }
    });
  });

  container.querySelectorAll('[data-evidence-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.evidenceOutcome);
      const target = outcomes.find((o) => o.id === oId);
      if (target) {
        openEvidenceModal({
          project,
          outcome: target,
        });
      }
    });
  });

  container.querySelectorAll('[data-remove-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.removeOutcome);
      confirmModal({
        title: 'Delete Outcome',
        message: 'Are you sure you want to delete this outcome and its adjustments?',
        onConfirm: async () => {
          await removeOutcome(oId);
          renderStep3(container);
        },
      });
    });
  });
}

function openOutcomeModal({ project, stakeholders, initialData = null, onSaved }) {
  const isEdit = !!initialData;

  const formHtml = `
    <form id="outcomeBuilderForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">1. What Changed? (Outcome Name) *</label>
        <input type="text" name="name" class="input" value="${escapeHtml(initialData?.name || '')}" required placeholder="e.g. Students achieve higher academic attainment" />
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">2. Who Experienced the Change? *</label>
          <select name="stakeholder_id" class="input" required>
            ${stakeholders
              .map(
                (s) => `
              <option value="${s.id}" ${initialData?.stakeholder_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
            `,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Polarity (Benefit or Harm?) *</label>
          <select name="polarity" class="input">
            <option value="positive" ${initialData?.polarity === 'positive' || !initialData ? 'selected' : ''}>+ Positive Impact (Benefit)</option>
            <option value="negative" ${initialData?.polarity === 'negative' ? 'selected' : ''}>- Negative Impact (Monetized Harm)</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">Indicator of Change</label>
          <input type="text" name="indicator" class="input" value="${escapeHtml(initialData?.indicator || '')}" placeholder="e.g. Standardized test score percentile" />
        </div>
        <div class="field">
          <label class="field-label">Baseline (Before)</label>
          <input type="text" name="baseline" class="input" value="${escapeHtml(initialData?.baseline || '')}" placeholder="e.g. 52% passing rate" />
        </div>
        <div class="field">
          <label class="field-label">Observed Result (After)</label>
          <input type="text" name="observed_result" class="input" value="${escapeHtml(initialData?.observed_result || '')}" placeholder="e.g. 78% passing rate" />
        </div>
      </div>

      <div class="card" style="background: var(--surface-soft); padding: var(--sp-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
          <strong style="font-size: 0.875rem;">3. Financial Proxy Valuation</strong>
          <button type="button" class="btn btn-secondary" id="btnPickProxyFromLib" style="height: 32px; font-size: 0.75rem;">
            🔍 Browse Proxy Library
          </button>
        </div>

        <div class="form-grid">
          <div class="field">
            <label class="field-label">Affected Units (Quantity) *</label>
            <input type="number" name="quantity" min="0" step="1" class="input" value="${initialData?.quantity ?? 100}" required />
          </div>
          <div class="field">
            <label class="field-label">Monetary Proxy Value (${project.currency})</label>
            <input type="number" name="proxy_value" min="0" step="0.01" class="input" value="${initialData?.proxy_value ?? 2500}" placeholder="Leave blank if unmonetized" />
          </div>
          <div class="field">
            <label class="field-label">Unit of Measure</label>
            <input type="text" name="proxy_unit" class="input" value="${escapeHtml(initialData?.proxy_unit || 'student / year')}" placeholder="e.g. participant / year" />
          </div>
        </div>

        <div class="field" style="margin-top: var(--sp-sm);">
          <label class="field-label">Financial Proxy Source & Rationale *</label>
          <input type="text" name="proxy_source" class="input" value="${escapeHtml(initialData?.proxy_source || '')}" required placeholder="e.g. Ministry of Education Tutoring Equivalent Benchmark 2026" />
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">Duration (Years)</label>
          <input type="number" name="duration_years" min="1" max="${project.analysis_period_years || 5}" class="input" value="${initialData?.duration_years || 3}" />
        </div>
        <div class="field">
          <label class="field-label">Projection Model</label>
          <select name="projection_model" class="input">
            <option value="cohort" ${initialData?.projection_model === 'cohort' ? 'selected' : ''}>Single Cohort (persists over time)</option>
            <option value="recurring_cohorts" ${initialData?.projection_model === 'recurring_cohorts' ? 'selected' : ''}>Recurring Cohorts (new entrants yearly)</option>
            <option value="independent" ${initialData?.projection_model === 'independent' ? 'selected' : ''}>Independent (annual measured quantities)</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Evidence Quality</label>
          <select name="evidence_quality" class="input">
            <option value="measured" ${initialData?.evidence_quality === 'measured' ? 'selected' : ''}>Measured (Empirical data collected)</option>
            <option value="external" ${initialData?.evidence_quality === 'external' ? 'selected' : ''}>External (Research citations)</option>
            <option value="estimated" ${initialData?.evidence_quality === 'estimated' ? 'selected' : ''}>Estimated (Extrapolated)</option>
            <option value="assumed" ${initialData?.evidence_quality === 'assumed' ? 'selected' : ''}>Assumed (Hypothetical judgment)</option>
          </select>
        </div>
      </div>

      <div id="outcomeModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>Cancel</button>
    <button class="btn btn-primary" id="btnSaveOutcome">${isEdit ? 'Update Outcome' : 'Save Outcome'}</button>
  `;

  openModal({
    title: isEdit ? 'Edit Outcome & Proxy' : 'Build New Social Outcome',
    body: formHtml,
    size: 'lg',
    footer,
  });

  document.getElementById('btnPickProxyFromLib')?.addEventListener('click', () => {
    openProxyLibraryModal({
      onSelectProxy: (selectedProxy) => {
        const form = document.getElementById('outcomeBuilderForm');
        if (form) {
          form.proxy_value.value = selectedProxy.value;
          form.proxy_unit.value = selectedProxy.unit;
          form.proxy_source.value = selectedProxy.source;
        }
      },
    });
  });

  document.getElementById('btnSaveOutcome')?.addEventListener('click', async () => {
    const form = document.getElementById('outcomeBuilderForm');
    const errBox = document.getElementById('outcomeModalError');
    if (!form) return;

    const proxyVal = form.proxy_value.value ? parseFloat(form.proxy_value.value) : null;

    const data = {
      name: form.name.value.trim(),
      stakeholder_id: parseInt(form.stakeholder_id.value, 10),
      polarity: form.polarity.value,
      indicator: form.indicator.value.trim(),
      baseline: form.baseline.value.trim(),
      observed_result: form.observed_result.value.trim(),
      quantity: parseFloat(form.quantity.value) || 0,
      proxy_value: proxyVal,
      proxy_unit: form.proxy_unit.value.trim(),
      proxy_source: form.proxy_source.value.trim(),
      duration_years: parseInt(form.duration_years.value, 10) || 1,
      projection_model: form.projection_model.value,
      evidence_quality: form.evidence_quality.value,
    };

    if (!data.name || isNaN(data.quantity)) {
      if (errBox) {
        errBox.textContent = 'Please enter an outcome name and valid quantity.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      if (isEdit) {
        await updateOutcome(initialData.id, data);
      } else {
        await addOutcome(data);
      }
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

function openEvidenceModal({ project, outcome }) {
  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        Attach research citations, surveys, URLs, or documents verifying outcome <strong>"${escapeHtml(outcome.name)}"</strong>.
      </p>

      <form id="addEvidenceForm" class="stack" style="gap: var(--sp-sm); background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md);">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">Evidence Title *</label>
            <input type="text" name="title" class="input" required placeholder="e.g. Student Progress Survey Results 2026" />
          </div>
          <div class="field">
            <label class="field-label">Kind *</label>
            <select name="kind" class="input">
              <option value="survey">Survey Findings</option>
              <option value="citation">Academic / Research Citation</option>
              <option value="url">Web URL</option>
              <option value="internal">Internal Evaluation Report</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Reference / URL</label>
          <input type="text" name="reference" class="input" placeholder="e.g. https://journal.org/paper-123 or DOI" />
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-primary" id="btnSubmitEvidence" style="height: 32px; font-size: 0.75rem;">
            + Attach Evidence
          </button>
        </div>
      </form>

      <div style="margin-top: var(--sp-md);">
        <h4 style="font-size: 0.875rem; margin-bottom: var(--sp-sm);">Attached Evidence</h4>
        <div id="evidenceListContainer" class="stack" style="gap: var(--sp-xs);">
          <div class="muted">Loading attached evidence...</div>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: `Evidence Sources — ${outcome.name}`,
    body: modalHtml,
    size: 'lg',
    footer: `<button class="btn btn-secondary" data-modal-close>Close</button>`,
  });

  const loadEvidence = async () => {
    const list = document.getElementById('evidenceListContainer');
    if (!list) return;

    try {
      const res = await api.getEvidence(project.id, 'outcome', outcome.id);
      const items = res?.data || [];
      if (items.length === 0) {
        list.innerHTML = `<div class="muted" style="font-size: 0.8125rem;">No evidence items attached yet.</div>`;
        return;
      }

      list.innerHTML = items
        .map(
          (item) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface); border: 1px solid var(--outline); border-radius: var(--radius-sm);">
          <div>
            <strong>${escapeHtml(item.title)}</strong> 
            <span class="badge badge-planned" style="font-size: 0.6875rem;">${escapeHtml(item.kind)}</span>
            ${item.reference ? `<div class="muted" style="font-size: 0.75rem;">${escapeHtml(item.reference)}</div>` : ''}
          </div>
          <button class="btn-icon" data-del-evidence="${item.id}" title="Remove">${icons.trash}</button>
        </div>
      `,
        )
        .join('');

      list.querySelectorAll('[data-del-evidence]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api.deleteEvidence(project.id, Number(btn.dataset.delEvidence));
          loadEvidence();
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  document.getElementById('btnSubmitEvidence')?.addEventListener('click', async () => {
    const form = document.getElementById('addEvidenceForm');
    if (!form || !form.title.value.trim()) return;

    try {
      await api.post(`/projects/${project.id}/evidence`, {
        entity_type: 'outcome',
        entity_id: outcome.id,
        title: form.title.value.trim(),
        kind: form.kind.value,
        reference: form.reference.value.trim(),
      });
      form.reset();
      loadEvidence();
    } catch (err) {
      alert(`Failed to attach evidence: ${err.message}`);
    }
  });

  loadEvidence();
}
