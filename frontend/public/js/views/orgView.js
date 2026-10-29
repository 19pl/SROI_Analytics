import { api, getCurrentUser } from '../api.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from '../components/icons.js';
import { t } from '../i18n.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';

export async function renderOrg(root) {
  if (isGuest()) {
    renderGuestPage(root, 'org');
    return;
  }
  const user = getCurrentUser();

  root.innerHTML = `
    <div class="stack" style="gap: var(--sp-lg);">
      <!-- Page Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-md); flex-wrap: wrap;">
        <div>
          <h1 class="page-title" style="margin-bottom: 4px;">${t('org_title', 'Faculties & Departments Hierarchy')}</h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            ${t('org_subtitle', 'Manage university organizational structure and configure SROI plan ownership at Naresuan University')}
          </p>
        </div>
        <div style="display: flex; gap: var(--sp-sm);">
          <button class="btn btn-primary" id="btnNewFaculty">${icons.plus} ${t('btn_add_faculty', 'Add Faculty')}</button>
        </div>
      </div>

      <!-- Institutional Banner & Quick Overview -->
      <div class="card has-stripe" style="background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); padding: var(--sp-lg); --stripe: var(--accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-md);">
          <div style="display: flex; align-items: center; gap: var(--sp-md);">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; font-size: 1.5rem; flex-shrink: 0;">
              🏛️
            </div>
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted); letter-spacing: 0.05em;">
                ${t('institution_label', 'Academic Institution')}
              </div>
              <div style="font-size: 1.125rem; font-weight: 700; color: var(--on-background);" id="orgDisplayName">
                ${t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)')}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: var(--sp-lg); flex-wrap: wrap;">
            <div style="text-align: right;">
              <div class="muted" style="font-size: 0.75rem;">${t('stat_total_faculties', 'Total Faculties')}</div>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);" id="statFacCount">-</div>
            </div>
            <div style="text-align: right;">
              <div class="muted" style="font-size: 0.75rem;">${t('stat_total_departments', 'Total Departments')}</div>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--on-background);" id="statDeptCount">-</div>
            </div>
            <div style="text-align: right;">
              <div class="muted" style="font-size: 0.75rem;">${t('org_members_title', 'Organization Members')}</div>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--on-background);" id="statMemCount">-</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div id="orgContentArea">
        <div class="muted" style="padding: var(--sp-2xl); text-align: center;">${t('loading', 'Loading organizational data...')}</div>
      </div>
    </div>
  `;

  const contentArea = document.getElementById('orgContentArea');
  const statFacCount = document.getElementById('statFacCount');
  const statDeptCount = document.getElementById('statDeptCount');
  const statMemCount = document.getElementById('statMemCount');
  const orgDisplayName = document.getElementById('orgDisplayName');

  let organizations = [];
  let currentOrgId = 1;
  let allFaculties = [];
  let allMembers = [];

  async function loadOrgs() {
    try {
      const res = await api.getOrganizations();
      organizations = res.data || [];
      const nuOrg = organizations.find((o) =>
        o.name.toLowerCase().includes('naresuan') || o.name.includes('นเรศวร')
      ) || organizations[0] || { id: 1, name: 'มหาวิทยาลัยนเรศวร (Naresuan University)' };

      currentOrgId = Number(nuOrg.id);
      if (orgDisplayName) {
        orgDisplayName.textContent = nuOrg.name;
      }
      await loadOrgStructure(currentOrgId);
    } catch (err) {
      contentArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadOrgStructure(orgId) {
    contentArea.innerHTML = `<div class="muted" style="padding: var(--sp-2xl); text-align: center;">${t('loading', 'Loading faculties and departments...')}</div>`;
    try {
      const [facRes, memRes] = await Promise.all([
        api.getFaculties(orgId),
        api.getOrgMembers(orgId),
      ]);

      const faculties = facRes.data || [];
      const members = memRes.data || [];

      // For each faculty, fetch departments
      const facWithDepts = await Promise.all(
        faculties.map(async (f) => {
          try {
            const dRes = await api.getFacultyDepartments(f.id);
            return { ...f, departments: dRes.data || [] };
          } catch (e) {
            return { ...f, departments: [] };
          }
        }),
      );

      allFaculties = facWithDepts;
      allMembers = members;

      // Update stat counters
      const totalDepts = allFaculties.reduce((acc, f) => acc + (f.departments ? f.departments.length : 0), 0);
      if (statFacCount) statFacCount.textContent = allFaculties.length;
      if (statDeptCount) statDeptCount.textContent = totalDepts;
      if (statMemCount) statMemCount.textContent = allMembers.length;

      renderStructureView(orgId, allFaculties, allMembers);
    } catch (err) {
      contentArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderStructureView(orgId, faculties, members) {
    contentArea.innerHTML = `
      <div class="stack" style="gap: var(--sp-xl);">
        <!-- Faculties Section -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-md); flex-wrap: wrap; gap: var(--sp-sm);">
            <div>
              <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--on-background);">
                ${t('fac_and_dept_count', 'Faculties & Departments')} (${faculties.length})
              </h2>
            </div>
            <div style="display: flex; gap: var(--sp-sm); align-items: center;">
              <input
                type="text"
                id="searchFacultyInput"
                class="input"
                placeholder="${t('search_faculties_placeholder', 'Search faculties...')}"
                style="height: 34px; font-size: 0.8125rem; width: 220px;"
              />
              <button class="btn btn-secondary" id="btnSubAddFaculty" style="height: 34px; font-size: 0.8125rem;">
                ${icons.plus} ${t('btn_add_faculty', 'Add Faculty')}
              </button>
            </div>
          </div>

          <div id="facultyCardsList">
            ${renderFacultyCards(faculties)}
          </div>
        </div>

        <!-- Organization Members Table -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-md);">
            <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--on-background);">
              ${t('org_members_title', 'Organization Members')} (${members.length})
            </h2>
            <button class="btn btn-secondary" id="btnAddMember" style="height: 34px; font-size: 0.8125rem;">
              ${icons.plus} ${t('btn_add_member', 'Add Member')}
            </button>
          </div>
          <div class="card" style="padding: 0; overflow: hidden;">
            <table class="table">
              <thead>
                <tr>
                  <th>${t('col_member_name', 'Name')}</th>
                  <th>${t('col_member_email', 'Email')}</th>
                  <th>${t('col_member_role', 'Role')}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  members.length === 0
                    ? `<tr><td colspan="3" class="empty">${t('no_data', 'No members found.')}</td></tr>`
                    : members
                        .map(
                          (m) => `
                        <tr>
                          <td class="strong">${escapeHtml(m.name)}</td>
                          <td>${escapeHtml(m.email)}</td>
                          <td><span class="badge badge-integrated">${escapeHtml(m.role)}</span></td>
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

    bindFacultyEvents(orgId);

    // Search filter for faculties
    const searchInput = document.getElementById('searchFacultyInput');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = faculties.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
      );
      const container = document.getElementById('facultyCardsList');
      if (container) {
        container.innerHTML = renderFacultyCards(filtered);
        bindFacultyEvents(orgId);
      }
    });

    document.getElementById('btnSubAddFaculty')?.addEventListener('click', () => openCreateFacultyModal(orgId));
    document.getElementById('btnEmptyAddFac')?.addEventListener('click', () => openCreateFacultyModal(orgId));
    document.getElementById('btnAddMember')?.addEventListener('click', () => openAddMemberModal(orgId));
  }

  function renderFacultyCards(faculties) {
    if (faculties.length === 0) {
      return `
        <div class="card" style="padding: var(--sp-2xl); text-align: center;">
          <p class="muted" style="margin-bottom: var(--sp-md);">${t('no_faculties_yet', 'No faculties created yet in this institution.')}</p>
          <button class="btn btn-primary" id="btnEmptyAddFac">${icons.plus} ${t('btn_create_first_fac', 'Create First Faculty')}</button>
        </div>
      `;
    }

    return `
      <div class="stack" style="gap: var(--sp-md);">
        ${faculties
          .map(
            (f) => `
          <div class="card has-stripe" style="padding: var(--sp-md); transition: box-shadow 150ms var(--ease); --stripe: var(--accent);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-sm); gap: var(--sp-sm); flex-wrap: wrap;">
              <div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 2px; color: var(--on-background);">
                  ${escapeHtml(f.name)}
                </h3>
                ${f.description ? `<p class="muted" style="font-size: 0.8125rem; margin-bottom: 0;">${escapeHtml(f.description)}</p>` : ''}
              </div>

              <div style="display: flex; gap: var(--sp-xs); flex-wrap: wrap;">
                <a class="btn btn-secondary" href="#/faculty-report?id=${f.id}" style="font-size: 0.75rem; height: 30px; font-weight: 600;">
                  ${t('conso_report', 'Consolidated Report ↗')}
                </a>

                <button class="btn btn-secondary" data-add-dept="${f.id}" data-fac-name="${escapeHtml(f.name)}" style="font-size: 0.75rem; height: 30px;">
                  + ${t('departments_in_fac', 'Department')}
                </button>

                <button class="btn btn-secondary" data-edit-fac="${f.id}" data-fac-name="${escapeHtml(f.name)}" data-fac-desc="${escapeHtml(f.description || '')}" style="font-size: 0.75rem; height: 30px;">
                  ${t('btn_rename', 'Rename')}
                </button>

                <button class="btn-icon" data-delete-fac="${f.id}" title="${t('btn_delete', 'Delete Faculty')}">
                  ${icons.trash}
                </button>
              </div>
            </div>

            <!-- Departments under this faculty -->
            <div style="background: var(--surface-soft); border: 1px solid var(--outline); border-radius: var(--radius-sm); padding: var(--sp-sm); margin-top: var(--sp-sm);">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: var(--sp-xs); letter-spacing: 0.04em;">
                ${t('departments_in_fac', 'Departments')} (${f.departments ? f.departments.length : 0})
              </div>

              ${
                !f.departments || f.departments.length === 0
                  ? `<div class="muted" style="font-size: 0.8125rem; font-style: italic;">
                      ${t('no_departments_yet', 'No departments yet. SROI plans can be owned directly by this faculty.')}
                    </div>`
                  : `
                    <div class="stack" style="gap: var(--sp-xs);">
                      ${f.departments
                        .map(
                          (d) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--sp-sm); flex-wrap: wrap; padding: 6px 12px; background: var(--surface-card); color: var(--on-background); border-radius: var(--radius-xs); border: 1px solid var(--outline);">
                          <div>
                            <strong style="font-size: 0.875rem; color: var(--on-background);">
                              ${escapeHtml(d.name)}
                            </strong>
                            ${d.description ? `<span class="muted" style="font-size: 0.75rem; margin-left: 8px;">${escapeHtml(d.description)}</span>` : ''}
                          </div>

                          <div style="display: flex; gap: var(--sp-xs);">
                            <button
                              class="btn btn-ghost"
                              data-edit-dept="${d.id}"
                              data-dept-name="${escapeHtml(d.name)}"
                              data-dept-desc="${escapeHtml(d.description || '')}"
                              style="font-size: 0.75rem; height: 26px; padding: 0 8px;"
                            >
                              ${t('btn_rename', 'Rename')}
                            </button>

                            <button
                              class="btn-icon"
                              data-delete-dept="${d.id}"
                              title="${t('btn_delete', 'Delete Department')}"
                              style="width: 26px; height: 26px;"
                            >
                              ${icons.trash}
                            </button>
                          </div>
                        </div>
                      `,
                        )
                        .join('')}
                    </div>
                  `
              }
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  function bindFacultyEvents(orgId) {
    contentArea.querySelectorAll('[data-add-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openCreateDeptModal(Number(btn.dataset.addDept), btn.dataset.facName);
      });
    });

    contentArea.querySelectorAll('[data-edit-fac]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openEditFacultyModal(Number(btn.dataset.editFac), btn.dataset.facName, btn.dataset.facDesc);
      });
    });

    contentArea.querySelectorAll('[data-delete-fac]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const facId = Number(btn.dataset.deleteFac);
        confirmModal({
          title: t('btn_delete', 'Delete Faculty'),
          message: t('confirm_delete_fac', 'Are you sure you want to delete this faculty? If it or its departments own any plans, deletion will be blocked to protect data.'),
          onConfirm: async () => {
            try {
              await api.deleteFaculty(facId);
              loadOrgStructure(orgId);
            } catch (e) {
              alert(e.message);
            }
          },
        });
      });
    });

    contentArea.querySelectorAll('[data-edit-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openEditDeptModal(Number(btn.dataset.editDept), btn.dataset.deptName, btn.dataset.deptDesc);
      });
    });

    contentArea.querySelectorAll('[data-delete-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const deptId = Number(btn.dataset.deleteDept);
        confirmModal({
          title: t('btn_delete', 'Delete Department'),
          message: t('confirm_delete_dept', 'Are you sure you want to delete this department? If it owns any plans, deletion will be blocked.'),
          onConfirm: async () => {
            try {
              await api.deleteDepartment(deptId);
              loadOrgStructure(orgId);
            } catch (e) {
              alert(e.message);
            }
          },
        });
      });
    });
  }

  function openCreateFacultyModal(orgId) {
    openModal({
      title: t('modal_create_fac_title', 'Create New Faculty'),
      body: `
        <form id="createFacForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">${t('field_fac_name', 'Faculty Name *')}</label>
            <input type="text" name="name" class="input" required placeholder="e.g. คณะสหเวชศาสตร์ / Faculty of Allied Health Sciences" />
          </div>
          <div class="field">
            <label class="field-label">${t('field_fac_desc', 'Description / Faculty Code')}</label>
            <textarea name="description" class="input" rows="2" placeholder="${t('ph_fac_desc', 'Brief description or faculty unit code (optional)')}"></textarea>
          </div>
          <div id="createFacError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitFac">${t('save', 'Create Faculty')}</button>
      `,
    });

    document.getElementById('btnSubmitFac')?.addEventListener('click', async () => {
      const form = document.getElementById('createFacForm');
      const errBox = document.getElementById('createFacError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = t('required', 'Please enter a faculty name.');
        errBox.style.display = 'block';
        return;
      }

      try {
        await api.createFaculty(orgId, { name, description });
        closeModal();
        loadOrgStructure(orgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  }

  function openEditFacultyModal(facId, oldName, oldDesc) {
    openModal({
      title: t('modal_edit_fac_title', 'Edit Faculty'),
      body: `
        <form id="editFacForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">${t('field_fac_name', 'Faculty Name *')}</label>
            <input type="text" name="name" class="input" required value="${escapeHtml(oldName)}" />
          </div>
          <div class="field">
            <label class="field-label">${t('field_fac_desc', 'Description / Faculty Code')}</label>
            <textarea name="description" class="input" rows="2">${escapeHtml(oldDesc)}</textarea>
          </div>
          <div id="editFacError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitEditFac">${t('save', 'Save Changes')}</button>
      `,
    });

    document.getElementById('btnSubmitEditFac')?.addEventListener('click', async () => {
      const form = document.getElementById('editFacForm');
      const errBox = document.getElementById('editFacError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = t('required', 'Please enter a faculty name.');
        errBox.style.display = 'block';
        return;
      }

      try {
        await api.updateFaculty(facId, { name, description });
        closeModal();
        loadOrgStructure(currentOrgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  }

  function openCreateDeptModal(facId, facName) {
    openModal({
      title: `${t('modal_create_dept_title', 'Add Department')} : ${escapeHtml(facName)}`,
      body: `
        <form id="createDeptForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">${t('field_dept_name', 'Department Name *')}</label>
            <input type="text" name="name" class="input" required placeholder="e.g. ภาควิชากายภาพบำบัด / Department of Physical Therapy" />
          </div>
          <div class="field">
            <label class="field-label">${t('field_dept_desc', 'Department Description')}</label>
            <textarea name="description" class="input" rows="2" placeholder="${t('ph_dept_desc', 'Brief department description (optional)')}"></textarea>
          </div>
          <div id="createDeptError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitDept">${t('save', 'Create Department')}</button>
      `,
    });

    document.getElementById('btnSubmitDept')?.addEventListener('click', async () => {
      const form = document.getElementById('createDeptForm');
      const errBox = document.getElementById('createDeptError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = t('required', 'Please enter a department name.');
        errBox.style.display = 'block';
        return;
      }

      try {
        await api.createDepartment(facId, { name, description });
        closeModal();
        loadOrgStructure(currentOrgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  }

  function openEditDeptModal(deptId, oldName, oldDesc) {
    openModal({
      title: t('modal_edit_dept_title', 'Edit Department'),
      body: `
        <form id="editDeptForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">${t('field_dept_name', 'Department Name *')}</label>
            <input type="text" name="name" class="input" required value="${escapeHtml(oldName)}" />
          </div>
          <div class="field">
            <label class="field-label">${t('field_dept_desc', 'Department Description')}</label>
            <textarea name="description" class="input" rows="2">${escapeHtml(oldDesc)}</textarea>
          </div>
          <div id="editDeptError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitEditDept">${t('save', 'Save Changes')}</button>
      `,
    });

    document.getElementById('btnSubmitEditDept')?.addEventListener('click', async () => {
      const form = document.getElementById('editDeptForm');
      const errBox = document.getElementById('editDeptError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = t('required', 'Please enter a department name.');
        errBox.style.display = 'block';
        return;
      }

      try {
        await api.updateDepartment(deptId, { name, description });
        closeModal();
        loadOrgStructure(currentOrgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  }

  function openAddMemberModal(orgId) {
    openModal({
      title: t('modal_add_member_title', 'Add Member to Organization'),
      body: `
        <form id="addMemberForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">${t('field_user_email', 'User Email *')}</label>
            <input type="email" name="email" class="input" required placeholder="colleague@nu.ac.th" />
          </div>
          <div class="field">
            <label class="field-label">${t('field_role', 'Role *')}</label>
            <select name="role" class="input">
              <option value="viewer">${t('role_viewer', 'Viewer (Read-only)')}</option>
              <option value="editor" selected>${t('role_editor', 'Editor (Manage plans & assessments)')}</option>
              <option value="owner">${t('role_owner', 'Owner (Full administrative rights)')}</option>
            </select>
          </div>
          <div id="addMemberError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitMember">${t('btn_add_member', 'Add Member')}</button>
      `,
    });

    document.getElementById('btnSubmitMember')?.addEventListener('click', async () => {
      const form = document.getElementById('addMemberForm');
      const errBox = document.getElementById('addMemberError');
      const email = form.email.value.trim();
      const role = form.role.value;

      try {
        await api.post(`/organizations/${orgId}/members`, { email, role });
        closeModal();
        loadOrgStructure(orgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  }

  document.getElementById('btnNewFaculty')?.addEventListener('click', () => {
    if (currentOrgId) openCreateFacultyModal(currentOrgId);
  });

  loadOrgs();
}
