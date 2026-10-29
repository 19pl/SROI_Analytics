/**
 * Projects Management View
 * List, filter, create, and switch projects connected to the Backend API
 * Fully bilingual (Thai & English)
 */

import { api } from '../api.js';
import { loadProject } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { card } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { escapeHtml } from '../utils/html.js';
import { t } from '../i18n.js';

export async function renderProjects(root) {
  root.innerHTML = `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-lg);">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">${t('projects_title', 'Projects Workspace')}</h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            ${t('projects_subtitle', 'Manage social impact assessments and select a plan to evaluate SROI')}
          </p>
        </div>
        <button class="btn btn-primary" id="btnCreateNewProject">${icons.plus} ${t('btn_new_plan', 'New SROI Plan')}</button>
      </div>

      <!-- Filters by Organization, Faculty, and Department -->
      <div class="card" style="padding: var(--sp-md); margin-bottom: var(--sp-lg);">
        <div style="display: flex; gap: var(--sp-md); flex-wrap: wrap; align-items: flex-end;">
          <div style="flex: 1; min-width: 200px;">
            <label class="field-label" style="font-size: 0.75rem; text-transform: uppercase;">${t('filter_org', 'Organization')}</label>
            <select id="filterOrg" class="input" style="height: 36px;"></select>
          </div>
          <div style="flex: 1; min-width: 200px;">
            <label class="field-label" style="font-size: 0.75rem; text-transform: uppercase;">${t('filter_faculty', 'Faculty Filter')}</label>
            <select id="filterFaculty" class="input" style="height: 36px;">
              <option value="">${t('all_faculties', 'All Faculties & General')}</option>
            </select>
          </div>
          <div style="flex: 1; min-width: 200px;">
            <label class="field-label" style="font-size: 0.75rem; text-transform: uppercase;">${t('filter_dept', 'Department Filter')}</label>
            <select id="filterDept" class="input" style="height: 36px;">
              <option value="">${t('all_departments', 'All Departments')}</option>
            </select>
          </div>
        </div>
      </div>

      <div id="projectsTableContainer">
        <div class="muted" style="padding: var(--sp-2xl); text-align: center;">${t('loading_projects', 'Loading projects from database...')}</div>
      </div>
    </div>
  `;

  const container = document.getElementById('projectsTableContainer');
  const filterOrg = document.getElementById('filterOrg');
  const filterFaculty = document.getElementById('filterFaculty');
  const filterDept = document.getElementById('filterDept');

  let organizations = [];
  let faculties = [];
  let departments = [];

  // Load filter options
  try {
    const orgRes = await api.getOrganizations();
    organizations = orgRes.data || [];
    filterOrg.innerHTML = organizations
      .map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`)
      .join('');

    if (organizations.length > 0) {
      await loadFacultiesForOrg(Number(filterOrg.value));
    }
  } catch (e) {
    console.warn('Could not load orgs:', e);
  }

  async function loadFacultiesForOrg(orgId) {
    try {
      const res = await api.getFaculties(orgId);
      faculties = res.data || [];
      filterFaculty.innerHTML =
        `<option value="">${t('all_faculties', 'All Faculties & General')}</option>` +
        faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
      filterDept.innerHTML = `<option value="">${t('all_departments', 'All Departments')}</option>`;
    } catch (e) {
      faculties = [];
    }
  }

  async function loadDeptsForFaculty(facId) {
    if (!facId) {
      filterDept.innerHTML = `<option value="">${t('all_departments', 'All Departments')}</option>`;
      return;
    }
    try {
      const res = await api.getFacultyDepartments(facId);
      departments = res.data || [];
      filterDept.innerHTML =
        `<option value="">${t('all_departments', 'All Departments')}</option>` +
        departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    } catch (e) {
      departments = [];
    }
  }

  filterOrg.addEventListener('change', async (e) => {
    await loadFacultiesForOrg(Number(e.target.value));
    loadList();
  });

  filterFaculty.addEventListener('change', async (e) => {
    const facId = e.target.value ? Number(e.target.value) : null;
    await loadDeptsForFaculty(facId);
    loadList();
  });

  filterDept.addEventListener('change', () => loadList());

  const loadList = async () => {
    try {
      const filters = {};
      if (filterOrg.value) filters.organization_id = filterOrg.value;
      if (filterFaculty.value && !filterDept.value) filters.faculty_id = filterFaculty.value;
      if (filterDept.value) filters.department_id = filterDept.value;

      const res = await api.getProjects(filters);
      const projects = res?.data || [];

      if (projects.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--sp-2xl);">
            <h3>${t('no_projects_found', 'No projects found')}</h3>
            <p class="muted" style="margin-bottom: var(--sp-lg);">${t('create_first_plan', 'Get started by creating your first SROI assessment plan.')}</p>
            <button class="btn btn-primary" id="btnCreateFirstProject">${icons.plus} ${t('btn_new_plan', 'Create SROI Plan')}</button>
          </div>
        `;
        document.getElementById('btnCreateFirstProject')?.addEventListener('click', triggerCreateModal);
        return;
      }

      container.innerHTML = card({
        body: `
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>${t('col_project_name', 'Plan Name')}</th>
                  <th>${t('col_owner', 'Direct Owner')}</th>
                  <th>${t('field_owner_type', 'Type')}</th>
                  <th class="num">${t('field_analysis_period', 'Scope / Period')}</th>
                  <th class="num">${t('col_sroi_ratio', 'Latest SROI')}</th>
                  <th>${t('col_status', 'Status')}</th>
                  <th>${t('col_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${projects
                  .map((p) => {
                    let ownerLabel = `<span class="badge badge-planned">${t('owner_general', 'Organization-wide')}</span>`;
                    if (p.department_id) {
                      const d = departments.find((x) => x.id === p.department_id);
                      ownerLabel = `<span class="badge badge-integrated">${t('owner_dept_direct', 'Dept')}: ${escapeHtml(d ? d.name : '#' + p.department_id)}</span>`;
                    } else if (p.faculty_id) {
                      const f = faculties.find((x) => x.id === p.faculty_id);
                      ownerLabel = `<span class="badge badge-production">${t('owner_faculty_direct', 'Faculty')}: ${escapeHtml(f ? f.name : '#' + p.faculty_id)}</span>`;
                    }

                    const periodLabel = p.assessment_months
                      ? `${p.assessment_months} ${t('months', 'Months')}`
                      : `${p.analysis_period_years || 5} ${t('years', 'Years')}`;

                    const sroiText =
                      p.latest_run && p.latest_run.sroi_ratio !== null
                        ? `${Number(p.latest_run.sroi_ratio).toFixed(2)} : 1`
                        : '-';

                    return `
                  <tr data-project-id="${p.id}">
                    <td class="strong">
                      ${escapeHtml(p.name)}
                      ${p.organization_name ? `<div class="muted" style="font-size: 0.75rem;">${escapeHtml(p.organization_name)}</div>` : ''}
                    </td>
                    <td>${ownerLabel}</td>
                    <td><span class="badge badge-integrated">${escapeHtml(p.evaluation_type)}</span></td>
                    <td class="num">${periodLabel}</td>
                    <td class="num strong" style="color: var(--primary);">${sroiText}</td>
                    <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                    <td>
                      <div style="display: flex; gap: var(--sp-sm);">
                        <button class="btn btn-primary" data-open-project="${p.id}" style="height: 32px; font-size: 0.75rem;">
                          ${t('btn_open_calculator', 'Open Calculator')}
                        </button>
                        <button class="btn-icon" data-delete-project="${p.id}" title="${t('delete', 'Delete Plan')}">
                          ${icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      });

      container.querySelectorAll('[data-open-project]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const pId = Number(btn.dataset.openProject);
          await loadProject(pId);
          window.location.hash = '#/wizard/step-1';
        });
      });

      container.querySelectorAll('[data-delete-project]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pId = Number(btn.dataset.deleteProject);
          confirmModal({
            title: t('delete', 'Delete Plan'),
            message: t('confirm_delete', 'Are you sure you want to delete this SROI plan?'),
            onConfirm: async () => {
              try {
                await api.deleteProject(pId);
                loadList();
              } catch (err) {
                alert(`Failed to delete plan: ${err.message}`);
              }
            },
          });
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  const triggerCreateModal = () => {
    openCreateProjectModal({
      currentOrgId: filterOrg.value ? Number(filterOrg.value) : null,
      faculties,
      onCreated: async (newP) => {
        await loadProject(newP.id);
        window.location.hash = '#/wizard/step-1';
      },
    });
  };

  document.getElementById('btnCreateNewProject')?.addEventListener('click', triggerCreateModal);

  loadList();
}

function openCreateProjectModal({ currentOrgId, faculties, onCreated }) {
  const formHtml = `
    <form id="createProjectForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('field_plan_name', 'Plan / Project Name')} *</label>
        <input type="text" name="name" class="input" required placeholder="${t('field_plan_name_placeholder', 'e.g. Hydrotherapy Building Rehabilitation SROI')}" />
      </div>

      <!-- Plan Ownership Model (Faculty vs Department vs Org) -->
      <div class="field" style="background: var(--surface-soft); padding: var(--sp-sm); border-radius: 4px; border: 1px solid var(--outline);">
        <label class="field-label" style="font-weight: 600; margin-bottom: 4px;">${t('field_owner_type', 'Direct Plan Owner')} *</label>
        <p class="muted" style="font-size: 0.75rem; margin-bottom: 6px;">
          ${t('alert_double_count_safe', 'Choose whether this plan belongs directly to a Faculty or to an Academic Department.')}
        </p>
        <div style="display: flex; gap: var(--sp-sm); margin-bottom: 8px;">
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 4px;">
            <input type="radio" name="ownerType" value="faculty" checked /> ${t('owner_faculty_direct', 'Faculty Direct')}
          </label>
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 4px;">
            <input type="radio" name="ownerType" value="department" /> ${t('owner_dept_direct', 'Department')}
          </label>
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 4px;">
            <input type="radio" name="ownerType" value="org" /> ${t('owner_general', 'Organization General')}
          </label>
        </div>

        <div id="facultySelectWrap" class="field">
          <label class="field-label" style="font-size: 0.75rem;">${t('field_faculty', 'Faculty')}</label>
          <select id="modalFacultySelect" class="input">
            ${faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            ${faculties.length === 0 ? '<option value="">No faculties available</option>' : ''}
          </select>
        </div>

        <div id="deptSelectWrap" class="field" style="display: none;">
          <label class="field-label" style="font-size: 0.75rem;">${t('field_department', 'Department')}</label>
          <select id="modalDeptSelect" class="input">
            <option value="">Select a faculty first</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('category', 'Category')}</label>
          <input type="text" name="category" class="input" placeholder="Health, Education, Community..." />
        </div>
        <div class="field">
          <label class="field-label">Evaluation Type</label>
          <select name="evaluation_type" class="input">
            <option value="forecast">Forecast (Ex-ante prospective)</option>
            <option value="evaluative" selected>Evaluative (Ex-post actuals)</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('currency', 'Currency')}</label>
          <input type="text" name="currency" class="input" value="THB" maxlength="3" required />
        </div>
        <div class="field">
          <label class="field-label">${t('field_analysis_period', 'Analysis Horizon (Years)')}</label>
          <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="1" required />
        </div>
        <div class="field">
          <label class="field-label">Assessment Scope</label>
          <select name="assessment_months" class="input">
            <option value="">Full Year (12 months / standard)</option>
            <option value="6">6 Months (Interim)</option>
            <option value="9">9 Months (Interim)</option>
            <option value="12">12 Months (Fiscal Year)</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label class="field-label">${t('field_discount_rate', 'Discount Rate (%)')}</label>
        <input type="number" name="discount_rate" min="0" max="100" step="0.1" class="input" value="0.0" />
      </div>

      <div class="field">
        <label class="field-label">${t('description', 'Description')}</label>
        <textarea name="description" class="input" rows="2" placeholder="${t('field_plan_desc', 'Brief summary of plan objectives')}"></textarea>
      </div>

      <div id="newProjectModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: t('modal_new_project_title', 'Create New SROI Assessment Plan'),
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="btnSubmitNewProject">${t('save', 'Create Plan')}</button>
    `,
  });

  const facultyWrap = document.getElementById('facultySelectWrap');
  const deptWrap = document.getElementById('deptSelectWrap');
  const modalFacSelect = document.getElementById('modalFacultySelect');
  const modalDeptSelect = document.getElementById('modalDeptSelect');

  async function loadModalDepts(facId) {
    if (!facId) return;
    try {
      const res = await api.getFacultyDepartments(facId);
      const depts = res.data || [];
      modalDeptSelect.innerHTML =
        depts.length > 0
          ? depts.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')
          : '<option value="">No departments in this faculty</option>';
    } catch (e) {
      modalDeptSelect.innerHTML = '<option value="">Failed to load departments</option>';
    }
  }

  modalFacSelect?.addEventListener('change', (e) => {
    loadModalDepts(Number(e.target.value));
  });

  if (modalFacSelect?.value) {
    loadModalDepts(Number(modalFacSelect.value));
  }

  document.querySelectorAll('input[name="ownerType"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'faculty') {
        facultyWrap.style.display = 'block';
        deptWrap.style.display = 'none';
      } else if (val === 'department') {
        facultyWrap.style.display = 'block';
        deptWrap.style.display = 'block';
      } else {
        facultyWrap.style.display = 'none';
        deptWrap.style.display = 'none';
      }
    });
  });

  document.getElementById('btnSubmitNewProject')?.addEventListener('click', async () => {
    const form = document.getElementById('createProjectForm');
    const errBox = document.getElementById('newProjectModalError');
    if (!form) return;

    const ownerType = document.querySelector('input[name="ownerType"]:checked')?.value;
    let faculty_id = null;
    let department_id = null;

    if (ownerType === 'faculty') {
      faculty_id = modalFacSelect?.value ? Number(modalFacSelect.value) : null;
    } else if (ownerType === 'department') {
      department_id = modalDeptSelect?.value ? Number(modalDeptSelect.value) : null;
    }

    const data = {
      name: form.name.value.trim(),
      category: form.category.value.trim(),
      evaluation_type: form.evaluation_type.value,
      currency: form.currency.value.trim().toUpperCase(),
      analysis_period_years: parseInt(form.analysis_period_years.value, 10),
      discount_rate: form.discount_rate.value ? parseFloat(form.discount_rate.value) / 100 : 0.0,
      description: form.description.value.trim(),
      faculty_id,
      department_id,
      assessment_months: form.assessment_months.value ? parseInt(form.assessment_months.value, 10) : null,
    };

    if (currentOrgId) {
      data.organization_id = currentOrgId;
    }

    if (!data.name || !data.currency) {
      if (errBox) {
        errBox.textContent = 'Please fill in plan name and currency.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      const res = await api.createProject(data);
      closeModal();
      onCreated(res.data);
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
