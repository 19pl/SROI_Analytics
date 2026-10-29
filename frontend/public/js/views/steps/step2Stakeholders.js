/**
 * Step 2: Stakeholder Mapping: Who Is Affected?
 * Fully bilingual (Thai & English)
 */

import { getState, addStakeholder, updateStakeholder, removeStakeholder } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { t } from '../../i18n.js';

export function renderStep2(container) {
  const { project, stakeholders } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('stk_workspace_title', 'Stakeholder Workspace')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('stk_workspace_desc', 'Identify individuals, groups, or entities that experience material changes (positive or negative)')}
            </p>
          </div>
          <button class="btn btn-primary" id="btnAddStakeholder">${icons.plus} ${t('btn_add_stakeholder', 'Add Stakeholder Group')}</button>
        </div>

        ${
          stakeholders.length === 0
            ? `
          <div style="padding: var(--sp-2xl); text-align: center; border: 2px dashed var(--outline); border-radius: var(--radius-lg);">
            <p class="strong" style="margin-bottom: var(--sp-xs); font-size: 1rem;">${t('no_stk_yet', 'No stakeholders mapped yet')}</p>
            <p class="muted" style="font-size: 0.875rem; margin-bottom: var(--sp-lg);">
              ${t('no_stk_sub', 'SROI begins with people. Add the primary groups affected by this project (e.g., Students, Families, Community).')}
            </p>
            <button class="btn btn-primary" id="btnAddStakeholderEmpty">${icons.plus} ${t('btn_map_first_stk', 'Map First Stakeholder')}</button>
          </div>
        `
            : `
          <div class="stakeholder-grid">
            ${stakeholders
              .map(
                (s) => `
              <div class="stakeholder-card" data-id="${s.id}">
                <div class="stakeholder-card-header">
                  <div>
                    <span class="stakeholder-card-title">
                      ${s.group_code ? `<span class="badge badge-integrated" style="margin-right: 4px;">${escapeHtml(s.group_code)}</span>` : ''}
                      ${escapeHtml(s.name)}
                    </span>
                    <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                      ${s.stakeholder_group ? `<span class="badge badge-production" style="font-size: 0.6875rem;">${escapeHtml(s.stakeholder_group.replace(/_/g, ' '))}</span>` : ''}
                      <span class="badge badge-planned" style="font-size: 0.6875rem;">${escapeHtml(s.category || 'Stakeholder')}</span>
                    </div>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    <button class="btn-icon" data-edit-stakeholder="${s.id}" title="${t('edit', 'Edit Stakeholder')}">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button class="btn-icon" data-remove-stakeholder="${s.id}" title="${t('delete', 'Delete Stakeholder')}">
                      ${icons.trash}
                    </button>
                  </div>
                </div>

                <div style="font-size: 0.8125rem; color: var(--muted); margin: 4px 0;">
                  ${escapeHtml(s.description || 'No description provided.')}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.75rem; background: var(--surface-soft); padding: 8px; border-radius: var(--radius-sm);">
                  <div>
                    <span class="muted">${t('stk_reach', 'Estimated Reach:')}</span><br />
                    <strong>${s.estimated_count !== null && s.estimated_count !== undefined ? Number(s.estimated_count).toLocaleString() + ' ' + t('people', 'people') : t('stat_unset', 'Unspecified')}</strong>
                  </div>
                  <div>
                    <span class="muted">${t('stk_role', 'Role:')}</span><br />
                    <strong>${escapeHtml(s.role_in_project || t('stk_beneficiary', 'Beneficiary'))}</strong>
                  </div>
                </div>

                ${
                  s.expected_positive
                    ? `<div style="font-size: 0.75rem; color: var(--positive); margin-top: 4px;">
                        <strong>${t('stk_expected_benefits', '+ Expected Benefits:')}</strong> ${escapeHtml(s.expected_positive)}
                       </div>`
                    : ''
                }

                ${
                  s.expected_negative
                    ? `<div style="font-size: 0.75rem; color: var(--negative); margin-top: 4px;">
                        <strong>${t('stk_potential_harms', '- Potential Harms:')}</strong> ${escapeHtml(s.expected_negative)}
                       </div>`
                    : ''
                }

                ${
                  s.overlap_notes
                    ? `<div style="font-size: 0.6875rem; color: var(--warning); border-top: 1px dashed var(--outline); padding-top: 4px; margin-top: 4px;">
                        ${t('stk_overlap_warning', '⚠️ Double-Counting Safeguard:')} ${escapeHtml(s.overlap_notes)}
                       </div>`
                    : ''
                }
              </div>
            `,
              )
              .join('')}
          </div>
        `
        }
      </div>
    </div>
  `;

  const triggerAdd = () => {
    openStakeholderModal({
      onSaved: () => renderStep2(container),
    });
  };

  document.getElementById('btnAddStakeholder')?.addEventListener('click', triggerAdd);
  document.getElementById('btnAddStakeholderEmpty')?.addEventListener('click', triggerAdd);

  container.querySelectorAll('[data-edit-stakeholder]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sId = Number(btn.dataset.editStakeholder);
      const target = stakeholders.find((s) => s.id === sId);
      if (target) {
        openStakeholderModal({
          initialData: target,
          onSaved: () => renderStep2(container),
        });
      }
    });
  });

  container.querySelectorAll('[data-remove-stakeholder]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sId = Number(btn.dataset.removeStakeholder);
      confirmModal({
        title: t('delete', 'Delete Stakeholder'),
        message: t('confirm_delete', 'Are you sure you want to delete this stakeholder? Any associated outcomes will need to be re-assigned.'),
        onConfirm: async () => {
          try {
            await removeStakeholder(sId);
            renderStep2(container);
          } catch (err) {
            alert(`Cannot delete stakeholder: ${err.message}`);
          }
        },
      });
    });
  });
}

function openStakeholderModal({ initialData = null, onSaved }) {
  const isEdit = !!initialData;
  const categories = [
    'Students and learners',
    'Teachers and educational staff',
    'Local communities',
    'Employees and volunteers',
    'Beneficiary households',
    'Local businesses',
    'Government agencies',
    'Ecosystems and environmental resources',
  ];

  const formHtml = `
    <form id="stakeholderForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('field_stk_name', 'Stakeholder Name *')}</label>
        <input type="text" name="name" class="input" value="${escapeHtml(initialData?.name || '')}" required placeholder="e.g. Participating University Students" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_stk_group', 'Stakeholder Classification (Excel S1–S4 Structure)')}</label>
          <select name="stakeholder_group" class="input">
            <option value="" ${!initialData?.stakeholder_group ? 'selected' : ''}>Unspecified Group</option>
            <option value="primary_beneficiary" ${initialData?.stakeholder_group === 'primary_beneficiary' ? 'selected' : ''}>S1: Primary Beneficiary (ผู้รับประโยชน์หลัก)</option>
            <option value="project_operator" ${initialData?.stakeholder_group === 'project_operator' ? 'selected' : ''}>S2: Project Operator / Faculty (ผู้ดำเนินโครงการ)</option>
            <option value="project_supporter" ${initialData?.stakeholder_group === 'project_supporter' ? 'selected' : ''}>S3: Project Supporter / Funder (ผู้สนับสนุนโครงการ)</option>
            <option value="other_agency" ${initialData?.stakeholder_group === 'other_agency' ? 'selected' : ''}>S4: Other External Agency (หน่วยงานอื่นๆ)</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('field_stk_code', 'Group Code')}</label>
          <input type="text" name="group_code" class="input" value="${escapeHtml(initialData?.group_code || '')}" placeholder="e.g. S1, S1.1, S2, S3" />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_cost_cat', 'Category')}</label>
          <select name="category" class="input">
            ${categories
              .map(
                (c) => `<option value="${c}" ${initialData?.category === c ? 'selected' : ''}>${c}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">${t('field_stk_count', 'Estimated Reach (Count)')}</label>
          <input type="number" name="estimated_count" min="0" class="input" value="${initialData?.estimated_count ?? ''}" placeholder="e.g. 200" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">${t('field_stk_role', 'Role in Project')}</label>
        <input type="text" name="role_in_project" class="input" value="${escapeHtml(initialData?.role_in_project || '')}" placeholder="e.g. Direct Beneficiary, Delivery Partner, Funder" />
      </div>
      <div class="field">
        <label class="field-label">${t('field_stk_desc', 'Description & Background')}</label>
        <textarea name="description" class="input" rows="2" placeholder="${t('ph_stk_desc', 'Who are they and how are they engaged?')}">${escapeHtml(initialData?.description || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_expected_benefits', 'Expected Positive Outcomes')}</label>
          <input type="text" name="expected_positive" class="input" value="${escapeHtml(initialData?.expected_positive || '')}" placeholder="e.g. Improved academic scores" />
        </div>
        <div class="field">
          <label class="field-label">${t('field_potential_harms', 'Potential Harms / Negative Changes')}</label>
          <input type="text" name="expected_negative" class="input" value="${escapeHtml(initialData?.expected_negative || '')}" placeholder="e.g. Study fatigue, travel cost" />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_rationale', 'Evidence / Consultation Source')}</label>
          <input type="text" name="evidence_source" class="input" value="${escapeHtml(initialData?.evidence_source || '')}" placeholder="e.g. Student Focus Group Survey 2026" />
        </div>
        <div class="field">
          <label class="field-label">${t('field_overlap_notes', 'Overlap Safeguard Notes')}</label>
          <input type="text" name="overlap_notes" class="input" value="${escapeHtml(initialData?.overlap_notes || '')}" placeholder="e.g. Avoid double-counting savings with Families" />
        </div>
      </div>
      <div id="stakeholderModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    <button class="btn btn-primary" id="btnSaveStakeholder">${isEdit ? t('save', 'Update Stakeholder') : t('save', 'Save Stakeholder')}</button>
  `;

  openModal({
    title: isEdit ? t('modal_edit_stakeholder_title', 'Edit Stakeholder Group') : t('modal_add_stakeholder_title', 'Add Stakeholder Group'),
    body: formHtml,
    footer,
  });

  document.getElementById('btnSaveStakeholder')?.addEventListener('click', async () => {
    const form = document.getElementById('stakeholderForm');
    const errBox = document.getElementById('stakeholderModalError');
    if (!form) return;

    const data = {
      name: form.name.value.trim(),
      stakeholder_group: form.stakeholder_group.value || null,
      group_code: form.group_code.value.trim() || null,
      category: form.category.value,
      estimated_count: form.estimated_count.value ? parseInt(form.estimated_count.value, 10) : null,
      role_in_project: form.role_in_project.value.trim(),
      description: form.description.value.trim(),
      expected_positive: form.expected_positive.value.trim(),
      expected_negative: form.expected_negative.value.trim(),
      evidence_source: form.evidence_source.value.trim(),
      overlap_notes: form.overlap_notes.value.trim(),
    };

    if (!data.name) {
      if (errBox) {
        errBox.textContent = t('required', 'Please enter a stakeholder name.');
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      if (isEdit) {
        await updateStakeholder(initialData.id, data);
      } else {
        await addStakeholder(data);
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
