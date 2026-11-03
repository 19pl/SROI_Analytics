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
  const formHtml = `
    <form id="createProjectForm" class="stack" style="gap: var(--sp-md);">
      <div class="field" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface-soft); border-radius: var(--radius-sm); border: 1px solid var(--outline);">
        <span style="font-size: 0.75rem; font-weight: 600; color: var(--muted);">${t('institution_label', 'Institution')}:</span>
        <strong style="font-size: 0.875rem;">🏛️ ${t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)')}</strong>
      </div>

      <div class="field">
        <label class="field-label">${t('sheet_mode_label', 'รูปแบบการทำงาน (Assessment Method)')}</label>
        <select name="calc_method" class="input">
          <option value="wizard" selected>${t('sheet_mode_wizard', 'ระบบแนะนำทีละขั้นตอน (Guided Assistant) — แนะนำสำหรับผู้เริ่มต้น')}</option>
          <option value="sheet">${t('sheet_mode_sheet', 'ตารางคำนวณแบบสเปรดชีต (Sheet Mode) — สำหรับผู้มีไฟล์ Excel แล้ว')}</option>
        </select>
        <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
          💡 ระบบแนะนำทีละขั้นตอนจะช่วยอธิบายความหมายของแต่ละช่อง แนะนำการแปลงกิจกรรมเป็นผลลัพธ์ และตรวจสอบความถูกต้องให้อัตโนมัติ
        </span>
      </div>

      <div class="field">
        <label class="field-label">${t('field_plan_name', 'Plan / Project Name *')}</label>
        <input type="text" name="name" class="input" required placeholder="${t('field_plan_name_placeholder', 'e.g. Community Skills Development Initiative 2025')}" />
      </div>

      <!-- Plan Ownership Model (Faculty vs Department vs Org) -->
      <div class="field" style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-sm); border: 1px solid var(--outline);">
        <label class="field-label" style="font-weight: 700; margin-bottom: 4px;">${t('field_owner_type', 'Direct Ownership Level')} *</label>
        <p class="muted" style="font-size: 0.75rem; margin-bottom: 8px;">
          ${t('alert_double_count_safe', 'Anti-double-counting safeguard active: Each plan is directly owned by exactly one entity level.')}
        </p>
        <div style="display: flex; gap: var(--sp-md); margin-bottom: 10px; flex-wrap: wrap;">
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="radio" name="ownerType" value="faculty" checked /> ${t('owner_faculty_direct', 'Faculty Direct Owner')}
          </label>
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="radio" name="ownerType" value="department" /> ${t('owner_dept_direct', 'Department Direct Owner')}
          </label>
          <label style="font-size: 0.8125rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="radio" name="ownerType" value="org" /> ${t('owner_general', 'General / No Faculty')}
          </label>
        </div>

        <div id="facultySelectWrap" class="field">
          <label class="field-label" style="font-size: 0.75rem; font-weight: 600;">${t('field_faculty', 'Assigned Faculty')}</label>
          <select id="modalFacultySelect" class="input">
            ${faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            ${faculties.length === 0 ? '<option value="">No faculties available</option>' : ''}
          </select>
        </div>

        <div id="deptSelectWrap" class="field" style="display: none; margin-top: var(--sp-sm);">
          <label class="field-label" style="font-size: 0.75rem; font-weight: 600;">${t('field_department', 'Assigned Department')}</label>
          <select id="modalDeptSelect" class="input">
            <option value="">Select a faculty first</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_category', 'Project Category')}</label>
          <input type="text" name="category" class="input" placeholder="${t('field_category_ph', 'Education, Health, Community, Technology...')}" />
        </div>
        <div class="field">
          <label class="field-label">${t('field_eval_type', 'Evaluation Type')}</label>
          <select name="evaluation_type" class="input">
            <option value="forecast">${t('eval_type_forecast', 'Forecast (Ex-ante prospective)')}</option>
            <option value="evaluative" selected>${t('eval_type_evaluative', 'Evaluative (Ex-post actuals)')}</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_currency', 'Currency')}</label>
          <input type="text" name="currency" class="input" value="THB" maxlength="3" required />
        </div>
        <div class="field">
          <label class="field-label">${t('field_analysis_period', 'Analysis Horizon (Years) *')}</label>
          <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="1" required />
        </div>
        <div class="field">
          <label class="field-label">${t('field_assessment_scope', 'Assessment Scope (Months)')}</label>
          <select name="assessment_months" class="input">
            <option value="">${t('scope_full_year', 'Full Year (12 months / standard)')}</option>
            <option value="6">${t('scope_6_months', '6 Months (Interim)')}</option>
            <option value="9">${t('scope_9_months', '9 Months (Interim)')}</option>
            <option value="12">${t('scope_12_months', '12 Months (Fiscal Year)')}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label class="field-label">${t('field_discount_rate', 'Annual Discount Rate (%) *')}</label>
        <input type="number" name="discount_rate" min="0" max="100" step="0.1" class="input" value="0.0" />
      </div>

      <div class="field">
        <label class="field-label">${t('field_plan_desc', 'Project Description / Objectives')}</label>
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
  });
}
