/**
 * Projects Management View
 * List, filter, create, and switch projects connected to the Backend API
 * Professional university institutional standard, fully bilingual (Thai & English)
 */

import { api } from '../api.js';
import { loadProject } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/html.js';
import { t } from '../i18n.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';
import { PROJECT_CATEGORIES, CURRENCIES, PERIOD_MONTHS, ANALYSIS_YEARS, EVAL_TYPES } from '../config/options.js';

// API status value -> pill class + translated label
const STATUS_PILL = {
  draft: { cls: 'status--draft', key: 'project_status_draft', fallback: 'Draft' },
  ready: { cls: 'status--ok', key: 'project_status_ready', fallback: 'Ready' },
  archived: { cls: 'status--neutral', key: 'project_status_archived', fallback: 'Archived' },
};

const statusPill = (status) => {
  const s = STATUS_PILL[status];
  const label = s ? t(s.key, s.fallback) : escapeHtml(status || '-');
  return `<span class="status ${s ? s.cls : 'status--neutral'}">${label}</span>`;
};

let closeActiveMenu = null;

/** Small popup menu for a "..." button. Added to <body> so the table's scroll area cannot clip it. */
function openRowMenu(anchor, { label, onSelect }) {
  const sameButton = closeActiveMenu && closeActiveMenu.anchor === anchor;
  closeActiveMenu?.();
  if (sameButton) return; // a second click on the same button just closes the menu

  const menu = document.createElement('div');
  menu.className = 'row-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `<button type="button" role="menuitem" class="row-menu__item">${escapeHtml(label)}</button>`;
  document.body.appendChild(menu);

  // Right-align under the button; flip above it when there is no room below
  const rect = anchor.getBoundingClientRect();
  const below = rect.bottom + 4;
  const fitsBelow = below + menu.offsetHeight <= window.innerHeight;
  menu.style.top = `${fitsBelow ? below : Math.max(4, rect.top - menu.offsetHeight - 4)}px`;
  menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;

  const onDocClick = (e) => {
    if (!menu.contains(e.target) && !anchor.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      anchor.focus();
    }
  };
  function close() {
    menu.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
    closeActiveMenu = null;
  }
  close.anchor = anchor;
  closeActiveMenu = close;

  anchor.setAttribute('aria-expanded', 'true');
  menu.querySelector('.row-menu__item').addEventListener('click', () => {
    close();
    onSelect();
  });
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
  menu.querySelector('.row-menu__item').focus();
}

export async function renderProjects(root) {
  if (isGuest()) {
    renderGuestPage(root, 'projects');
    return;
  }
  root.innerHTML = `
    <div class="stack-md">
      <header class="page-head">
        <div>
          <p class="muted-sm">${t('institution_badge', 'Naresuan University')}</p>
          <h1 class="page-head__title">${t('projects_title', 'Projects Workspace')}</h1>
          <p class="page-head__sub">
            ${t('projects_subtitle', 'Manage social return on investment assessments and select plans for evaluation')}
          </p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn-primary" id="btnCreateNewProject">
            ${icons.plus} ${t('btn_new_plan', 'New SROI Plan')}
          </button>
        </div>
      </header>

      <section class="panel">
        <div class="projects-filter-bar">
          <div class="field projects-filter-search">
            <label class="field-label" for="searchProjectName">${t('search', 'Search')}</label>
            <input
              type="text"
              id="searchProjectName"
              class="input"
              placeholder="${t('search_projects_placeholder', 'Search plans by title or objectives...')}"
            />
          </div>

          <div class="field projects-filter-select">
            <label class="field-label" for="filterFaculty">${t('filter_faculty', 'Faculty Filter')}</label>
            <select id="filterFaculty" class="input">
              <option value="">${t('all_faculties', 'All Faculties & General')}</option>
            </select>
          </div>

          <div class="field projects-filter-select">
            <label class="field-label" for="filterDept">${t('filter_dept', 'Department Filter')}</label>
            <select id="filterDept" class="input" disabled>
              <option value="">${t('filter_dept_pick_faculty', 'Choose a faculty first')}</option>
            </select>
          </div>
        </div>
      </section>

      <div id="projectsTableContainer" class="stack-md">
        <p class="muted-sm">${t('loading_projects', 'Loading projects from database...')}</p>
      </div>
    </div>
  `;

  const container = document.getElementById('projectsTableContainer');
  const searchInput = document.getElementById('searchProjectName');
  const filterFaculty = document.getElementById('filterFaculty');
  const filterDept = document.getElementById('filterDept');

  let organizations = [];
  let faculties = [];
  let departments = [];
  let nuOrgId = 1;
  let allProjects = [];

  // Load Organization & Faculty metadata
  try {
    const orgRes = await api.getOrganizations();
    organizations = orgRes.data || [];
    const nuOrg = organizations.find(
      (o) => o.name.toLowerCase().includes('naresuan') || o.name.includes('นเรศวร'),
    ) ||
      organizations[0] || { id: 1, name: 'มหาวิทยาลัยนเรศวร (Naresuan University)' };

    nuOrgId = nuOrg.id;
    await loadFacultiesForOrg(Number(nuOrg.id));
  } catch (e) {
    console.warn('Could not load orgs:', e);
  }

    // The department filter stays disabled until a faculty is chosen
  function resetDeptFilter() {
    filterDept.innerHTML = `<option value="">${t('filter_dept_pick_faculty', 'Choose a faculty first')}</option>`;
    filterDept.disabled = true;
  }

  async function loadFacultiesForOrg(orgId) {
    try {
      const res = await api.getFaculties(orgId);
      faculties = res.data || [];
      filterFaculty.innerHTML =
        `<option value="">${t('all_faculties', 'All Faculties & General')}</option>` +
        faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
      resetDeptFilter();
    } catch (e) {
      faculties = [];
    }
  }

  async function loadDeptsForFaculty(facId) {
    if (!facId) {
      resetDeptFilter();
      return;
    }
    try {
      const res = await api.getFacultyDepartments(facId);
      departments = res.data || [];
      filterDept.innerHTML =
        `<option value="">${t('all_departments', 'All Departments')}</option>` +
        departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      filterDept.disabled = false;
    } catch (e) {
      departments = [];
    }
  }

  filterFaculty.addEventListener('change', async (e) => {
    const facId = e.target.value ? Number(e.target.value) : null;
    await loadDeptsForFaculty(facId);
    loadList();
  });

  filterDept.addEventListener('change', () => loadList());

  searchInput?.addEventListener('input', () => {
    filterAndRenderProjects();
  });

  function filterAndRenderProjects() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    let filtered = allProjects;
    if (q) {
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)),
      );
    }
    renderTable(filtered);
  }

  const loadList = async () => {
    try {
      const filters = {};
      if (nuOrgId) filters.organization_id = nuOrgId;
      if (filterFaculty.value && !filterDept.value) filters.faculty_id = filterFaculty.value;
      if (filterDept.value) filters.department_id = filterDept.value;

      const res = await api.getProjects(filters);
      allProjects = res?.data || [];
      filterAndRenderProjects();
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

    function renderTable(projects) {
    if (projects.length === 0) {
      // Nothing exists yet -> invite to create one; filters hid everything -> just say so
      container.innerHTML =
        allProjects.length === 0
          ? `
        <div class="empty-state">
          <h2 class="empty-state__title">${t('empty_projects_title', 'No plans yet')}</h2>
          <p class="empty-state__text">${t('create_first_plan', 'Get started by creating your unit’s first SROI plan.')}</p>
          <button class="btn btn-primary" id="btnCreateFirstProject">${icons.plus} ${t('btn_new_plan', 'New SROI Plan')}</button>
        </div>`
          : `
        <div class="empty-state">
          <p class="empty-state__text">${t('no_projects_found', 'No projects found matching the search or filter criteria.')}</p>
        </div>`;
      document
        .getElementById('btnCreateFirstProject')
        ?.addEventListener('click', triggerCreateModal);
      return;
    }

    container.innerHTML = `
      <section class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_project_name', 'Plan Name')}</th>
                <th>${t('col_owner', 'Direct Owner')}</th>
                <th>${t('col_type_period', 'Type & period')}</th>
                <th class="num">${t('col_sroi_ratio', 'SROI Ratio')}</th>
                <th>${t('col_status', 'Status')}</th>
                <th aria-label="${t('col_actions', 'Actions')}"></th>
              </tr>
            </thead>
            <tbody>
              ${projects
                .map((p) => {
                  let ownerLabel = `<span class="badge badge-planned">${t('owner_general', 'University-wide')}</span>`;
                  if (p.department_id) {
                    const d = departments.find((x) => x.id === p.department_id);
                    ownerLabel = `<span class="badge badge-integrated">${t('owner_dept_direct', 'Dept')}: ${escapeHtml(d ? d.name : '#' + p.department_id)}</span>`;
                  } else if (p.faculty_id) {
                    const f = faculties.find((x) => x.id === p.faculty_id);
                    ownerLabel = `<span class="badge badge-production">${t('owner_faculty_direct', 'Faculty')}: ${escapeHtml(f ? f.name : '#' + p.faculty_id)}</span>`;
                  }

                  const typeLabel =
                    p.evaluation_type === 'forecast'
                      ? t('eval_type_forecast_short', 'Forecast')
                      : t('eval_type_evaluative_short', 'Evaluative');
                  const periodLabel = p.assessment_months
                    ? `${p.assessment_months} ${t('months', 'Months')}`
                    : `${p.analysis_period_years || 5} ${t('years', 'Years')}`;

                  const hasSroi = p.latest_run && p.latest_run.sroi_ratio !== null;
                  const sroiText = hasSroi ? `${Number(p.latest_run.sroi_ratio).toFixed(2)} : 1` : '-';

                  return `
                <tr data-project-id="${p.id}">
                  <td class="strong">
                    <div>${escapeHtml(p.name)}${p.calc_method === 'sheet' ? ` <span class="badge badge-integrated">${t('sheet_badge', 'Sheet')}</span>` : ''}</div>
                    ${p.category ? `<div class="muted-sm">${escapeHtml(p.category)}</div>` : ''}
                  </td>
                  <td>${ownerLabel}</td>
                  <td>${typeLabel} · ${periodLabel}</td>
                  <td class="num strong">${sroiText}</td>
                  <td>${statusPill(p.status)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn btn-primary" data-open-project="${p.id}">
                        ${t('open', 'Open')}
                      </button>
                      <button
                        type="button"
                        class="btn-icon"
                        data-row-menu="${p.id}"
                        aria-haspopup="menu"
                        aria-expanded="false"
                        aria-label="${t('more_actions', 'More actions')}"
                        title="${t('more_actions', 'More actions')}"
                      >&hellip;</button>
                    </div>
                  </td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    container.querySelectorAll('[data-open-project]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pId = Number(btn.dataset.openProject);
        await loadProject(pId);
        window.location.hash = '#/wizard/step-1';
      });
    });

    container.querySelectorAll('[data-row-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pId = Number(btn.dataset.rowMenu);
        openRowMenu(btn, {
          label: t('delete', 'Delete Plan'),
          onSelect: () =>
            confirmModal({
              title: t('delete', 'Delete Plan'),
              message: t('confirm_delete', 'Are you sure you want to delete this SROI plan?'),
              confirmText: t('delete', 'Delete'),
              onConfirm: async () => {
                try {
                  await api.deleteProject(pId);
                  loadList();
                } catch (err) {
                  showToast(`${t('delete_failed', 'Failed to delete plan')}: ${err.message}`, 'error');
                }
              },
            }),
        });
      });
    });
  }

  const triggerCreateModal = () => {
    openCreateProjectModal({
      currentOrgId: nuOrgId,
      faculties,
      onCreated: async (newP) => {
        await loadProject(newP.id);
        window.location.hash = newP.calc_method === 'sheet' ? '#/wizard/step-1' : '#/wizard/step-0';
      },
    });
  };

  document.getElementById('btnCreateNewProject')?.addEventListener('click', triggerCreateModal);

  loadList();
}

function openCreateProjectModal({ currentOrgId, faculties, onCreated }) {
  let currentStep = 1;

  const formHtml = `
    <form id="createProjectForm" class="form-stack" novalidate>
      <div class="field-hint" id="modalStepIndicator" style="font-weight: 600; color: var(--primary);">
        ${t('modal_step_1_indicator', 'Step 1 of 3: Plan basics')}
      </div>

      <!-- Step 1: Plan basics -->
      <div id="modalStep1" class="form-stack">
        <div class="field">
          <label class="field-label" for="planNameInput">${t('field_plan_name', 'Plan / Project Name')} *</label>
          <input type="text" id="planNameInput" name="name" class="input" required placeholder="${t('field_plan_name_placeholder', 'e.g. Community Skills Development Initiative 2025')}" />
        </div>

        <div class="field">
          <label class="field-label" for="modalOwnerTypeSelect">${t('field_owner_type', 'Who owns this plan?')} *</label>
          <select id="modalOwnerTypeSelect" name="ownerType" class="input">
            <option value="faculty" selected>${t('owner_faculty_direct', 'Faculty Direct Owner')}</option>
            <option value="department">${t('owner_dept_direct', 'Department Direct Owner')}</option>
            <option value="org">${t('owner_general', 'University-wide / No Faculty')}</option>
          </select>
        </div>

        <div id="facultySelectWrap" class="field">
          <label class="field-label" for="modalFacultySelect">${t('field_faculty', 'Assigned Faculty')} *</label>
          <select id="modalFacultySelect" class="input">
            ${faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            ${faculties.length === 0 ? '<option value="">No faculties available</option>' : ''}
          </select>
        </div>

        <div id="deptSelectWrap" class="field" style="display: none;">
          <label class="field-label" for="modalDeptSelect">${t('field_department', 'Assigned Department')} *</label>
          <select id="modalDeptSelect" class="input">
            <option value="">Select a faculty first</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label">${t('sheet_mode_label', 'Assessment Method')}</label>
          <div class="form-row" style="gap: var(--sp-sm);">
            <div class="panel method-card is-active" data-method="wizard" style="cursor: pointer; padding: var(--sp-md); border: 2px solid var(--primary);">
              <strong style="display: block; font-size: 0.875rem; margin-bottom: 4px;">${t('sheet_mode_wizard_title', 'Guided Assistant')}</strong>
              <span class="field-hint">${t('sheet_mode_wizard_desc', 'Step-by-step guidance, recommended for beginners')}</span>
            </div>
            <div class="panel method-card" data-method="sheet" style="cursor: pointer; padding: var(--sp-md); border: 1px solid var(--outline);">
              <strong style="display: block; font-size: 0.875rem; margin-bottom: 4px;">${t('sheet_mode_sheet_title', 'Sheet Mode')}</strong>
              <span class="field-hint">${t('sheet_mode_sheet_desc', 'Spreadsheet-style entry for existing Excel models')}</span>
            </div>
          </div>
          <input type="hidden" name="calc_method" value="wizard" />
        </div>
      </div>

      <!-- Step 2: Evaluation -->
      <div id="modalStep2" class="form-stack" style="display: none;">
        <div class="field">
          <label class="field-label" for="modalEvalTypeSelect">${t('field_eval_type', 'Evaluation Type')}</label>
          <select id="modalEvalTypeSelect" name="evaluation_type" class="input">
            <option value="evaluative" selected>${t('eval_type_evaluative', 'Evaluative (Ex-post actuals)')} — ${t('eval_type_evaluative_desc', 'Assess real results after project completion')}</option>
            <option value="forecast">${t('eval_type_forecast', 'Forecast (Ex-ante prospective)')} — ${t('eval_type_forecast_desc', 'Forecast prospective impact before starting')}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="modalScopeSelect">${t('field_assessment_scope', 'Assessment Period')}</label>
          <select id="modalScopeSelect" name="assessment_months" class="input">
            <option value="">${t('scope_full_year', 'Full Year (12 months / standard)')}</option>
            <option value="6">${t('scope_6_months', '6 Months (Interim)')}</option>
            <option value="9">${t('scope_9_months', '9 Months (Interim)')}</option>
            <option value="12">${t('scope_12_months', '12 Months (Fiscal Year)')}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="modalHorizonSelect">${t('field_analysis_period', 'Analysis Horizon (Years)')} *</label>
          <select id="modalHorizonSelect" class="input">
            <option value="1" selected>1 ${t('years', 'Year')}</option>
            <option value="2">2 ${t('years', 'Years')}</option>
            <option value="3">3 ${t('years', 'Years')}</option>
            <option value="4">4 ${t('years', 'Years')}</option>
            <option value="5">5 ${t('years', 'Years')}</option>
            <option value="6">6 ${t('years', 'Years')}</option>
            <option value="7">7 ${t('years', 'Years')}</option>
            <option value="8">8 ${t('years', 'Years')}</option>
            <option value="9">9 ${t('years', 'Years')}</option>
            <option value="10">10 ${t('years', 'Years')}</option>
            <option value="Other">${t('other_specify', 'Other (specify)')}</option>
          </select>
          <div id="horizonOtherWrap" style="margin-top: var(--sp-xs); display: none;">
            <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="1" placeholder="${t('specify_years', 'Specify years (1–100)')}" />
          </div>
        </div>
      </div>

      <!-- Step 3: Optional details -->
      <div id="modalStep3" class="form-stack" style="display: none;">
        <div class="field">
          <label class="field-label" for="modalCategorySelect">${t('field_category', 'Project Category')}</label>
          <select id="modalCategorySelect" class="input">
            <option value="">${t('select_category', '— Select Category —')}</option>
            <option value="Education">${t('cat_education', 'Education')}</option>
            <option value="Health">${t('cat_health', 'Health')}</option>
            <option value="Community">${t('cat_community', 'Community')}</option>
            <option value="Technology">${t('cat_technology', 'Technology')}</option>
            <option value="Agriculture">${t('cat_agriculture', 'Agriculture')}</option>
            <option value="Environment">${t('cat_environment', 'Environment')}</option>
            <option value="Other">${t('other_specify', 'Other (specify)')}</option>
          </select>
          <div id="categoryOtherWrap" style="margin-top: var(--sp-xs); display: none;">
            <input type="text" id="modalCategoryCustom" class="input" placeholder="${t('specify_category', 'Specify custom category')}" />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="modalDesc">${t('field_plan_desc', 'Project Description / Objectives')}</label>
          <textarea id="modalDesc" name="description" class="input" rows="2" placeholder="${t('field_plan_desc_placeholder', 'Brief summary of plan objectives')}"></textarea>
        </div>

        <details class="disclosure" style="margin-top: var(--sp-xs);">
          <summary class="disclosure__summary">${t('advanced_settings', 'Advanced Settings')}</summary>
          <div class="form-stack" style="margin-top: var(--sp-md);">
            <div class="field">
              <label class="field-label" for="modalCurrencySelect">${t('field_currency', 'Currency')}</label>
              <select id="modalCurrencySelect" class="input">
                <option value="THB" selected>THB (Thai Baht)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="Other">${t('other_specify', 'Other (specify)')}</option>
              </select>
              <div id="currencyOtherWrap" style="margin-top: var(--sp-xs); display: none;">
                <input type="text" id="modalCurrencyCustom" class="input" maxlength="3" placeholder="GBP" />
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="modalDiscountRate">${t('field_discount_rate', 'Annual Discount Rate (%)')}</label>
              <input type="number" id="modalDiscountRate" name="discount_rate" min="0" max="100" step="0.1" class="input" value="0.0" />
            </div>
          </div>
        </details>
      </div>

      <div id="newProjectModalError" class="field-error" style="display: none; padding: var(--sp-sm); background: var(--negative-bg); border-radius: var(--radius-sm);"></div>
    </form>
  `;

  openModal({
    title: t('modal_new_project_title', 'Create New SROI Assessment Plan'),
    body: formHtml,
    footer: `
      <div id="modalFooterActions" style="display: flex; gap: var(--sp-sm); width: 100%; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button type="button" class="btn btn-primary" id="btnModalNext">${t('next', 'Next →')}</button>
      </div>
    `,
  });

  const form = document.getElementById('createProjectForm');
  const errBox = document.getElementById('newProjectModalError');
  const facultyWrap = document.getElementById('facultySelectWrap');
  const deptWrap = document.getElementById('deptSelectWrap');
  const modalFacSelect = document.getElementById('modalFacultySelect');
  const modalDeptSelect = document.getElementById('modalDeptSelect');
  const ownerTypeSelect = document.getElementById('modalOwnerTypeSelect');
  const horizonSelect = document.getElementById('modalHorizonSelect');
  const horizonOtherWrap = document.getElementById('horizonOtherWrap');
  const categorySelect = document.getElementById('modalCategorySelect');
  const categoryOtherWrap = document.getElementById('categoryOtherWrap');
  const currencySelect = document.getElementById('modalCurrencySelect');
  const currencyOtherWrap = document.getElementById('currencyOtherWrap');
  const stepIndicator = document.getElementById('modalStepIndicator');
  const footerActions = document.getElementById('modalFooterActions');

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

  ownerTypeSelect?.addEventListener('change', (e) => {
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

  // Method selectable cards
  document.querySelectorAll('.method-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.method-card').forEach((c) => {
        c.classList.remove('is-active');
        c.style.border = '1px solid var(--outline)';
      });
      card.classList.add('is-active');
      card.style.border = '2px solid var(--primary)';
      form.calc_method.value = card.dataset.method;
    });
  });

  // Horizon Other handler
  horizonSelect?.addEventListener('change', (e) => {
    horizonOtherWrap.style.display = e.target.value === 'Other' ? 'block' : 'none';
  });

  // Category Other handler
  categorySelect?.addEventListener('change', (e) => {
    categoryOtherWrap.style.display = e.target.value === 'Other' ? 'block' : 'none';
  });

  // Currency Other handler
  currencySelect?.addEventListener('change', (e) => {
    currencyOtherWrap.style.display = e.target.value === 'Other' ? 'block' : 'none';
  });

  function updateStepUI() {
    if (errBox) errBox.style.display = 'none';
    const s1 = document.getElementById('modalStep1');
    const s2 = document.getElementById('modalStep2');
    const s3 = document.getElementById('modalStep3');
    if (s1) s1.style.display = currentStep === 1 ? 'grid' : 'none';
    if (s2) s2.style.display = currentStep === 2 ? 'grid' : 'none';
    if (s3) s3.style.display = currentStep === 3 ? 'grid' : 'none';

    if (stepIndicator) {
      if (currentStep === 1) stepIndicator.textContent = t('modal_step_1_indicator', 'Step 1 of 3: Plan basics');
      else if (currentStep === 2) stepIndicator.textContent = t('modal_step_2_indicator', 'Step 2 of 3: Evaluation');
      else stepIndicator.textContent = t('modal_step_3_indicator', 'Step 3 of 3: Optional details');
    }

    if (footerActions) {
      if (currentStep === 1) {
        footerActions.innerHTML = `
          <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
          <button type="button" class="btn btn-primary" id="btnModalNext">${t('next', 'Next →')}</button>
        `;
      } else if (currentStep === 2) {
        footerActions.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btnModalBack">← ${t('back', 'Back')}</button>
          <button type="button" class="btn btn-primary" id="btnModalNext">${t('next', 'Next →')}</button>
        `;
      } else {
        footerActions.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btnModalBack">← ${t('back', 'Back')}</button>
          <button type="button" class="btn btn-primary" id="btnSubmitNewProject">${t('save', 'Create Plan')}</button>
        `;
      }
      bindStepButtons();
    }
  }

  function bindStepButtons() {
    document.getElementById('btnModalNext')?.addEventListener('click', () => {
      if (currentStep === 1) {
        const nameVal = form.name.value.trim();
        if (!nameVal) {
          if (errBox) {
            errBox.textContent = t('required_plan_name', 'Please enter a plan name.');
            errBox.style.display = 'block';
          }
          return;
        }
        currentStep = 2;
        updateStepUI();
      } else if (currentStep === 2) {
        currentStep = 3;
        updateStepUI();
      }
    });

    document.getElementById('btnModalBack')?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep -= 1;
        updateStepUI();
      }
    });

    document.getElementById('btnSubmitNewProject')?.addEventListener('click', submitPlan);
  }

  async function submitPlan() {
    if (!form) return;

    const ownerType = ownerTypeSelect?.value;
    let faculty_id = null;
    let department_id = null;

    if (ownerType === 'faculty') {
      faculty_id = modalFacSelect?.value ? Number(modalFacSelect.value) : null;
    } else if (ownerType === 'department') {
      department_id = modalDeptSelect?.value ? Number(modalDeptSelect.value) : null;
    }

    let yearsVal = horizonSelect?.value || '1';
    if (yearsVal === 'Other') {
      yearsVal = form.analysis_period_years.value;
    }

    let catVal = categorySelect?.value || '';
    if (catVal === 'Other') {
      catVal = document.getElementById('modalCategoryCustom')?.value.trim() || '';
    }

    let curVal = currencySelect?.value || 'THB';
    if (curVal === 'Other') {
      curVal = document.getElementById('modalCurrencyCustom')?.value.trim().toUpperCase() || 'THB';
    }

    const data = {
      name: form.name.value.trim(),
      category: catVal,
      evaluation_type: form.evaluation_type.value,
      currency: curVal,
      analysis_period_years: parseInt(yearsVal, 10) || 1,
      discount_rate: form.discount_rate.value ? parseFloat(form.discount_rate.value) / 100 : 0.0,
      description: form.description.value.trim(),
      faculty_id,
      department_id,
      assessment_months: form.assessment_months.value
        ? parseInt(form.assessment_months.value, 10)
        : null,
      calc_method: form.calc_method.value,
    };

    if (currentOrgId) {
      data.organization_id = currentOrgId;
    }

    if (!data.name || !data.currency) {
      if (errBox) {
        errBox.textContent = t('required', 'Please fill in required fields.');
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
  }

  bindStepButtons();
}

