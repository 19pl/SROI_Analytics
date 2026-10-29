import { api, getCurrentUser } from '../api.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from '../components/icons.js';
import { card } from '../components/ui.js';
import { t } from '../i18n.js';

export async function renderOrg(root) {
  const user = getCurrentUser();

  root.innerHTML = `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-lg);">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">${t('org_title', 'Organizational Structure')}</h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            ${t('org_subtitle', 'Manage Faculties, Departments, and plan ownership permissions')}
          </p>
        </div>
        <div style="display: flex; gap: var(--sp-sm);">
          <button class="btn btn-primary" id="btnNewFaculty">${icons.plus} ${t('btn_add_faculty', 'New Faculty')}</button>
        </div>
      </div>

      <div style="margin-bottom: var(--sp-md);">
        <div style="display: flex; align-items: center; gap: var(--sp-sm);">
          <label class="field-label" style="font-weight: 600; margin-bottom: 0;">${t('filter_org', 'Active Organization')}:</label>
          <span class="badge badge-planned">${t('fixed_nu_only', 'Fixed: NU Only')}</span>
        </div>
        <select id="orgSelector" class="input" style="max-width: 380px; margin-top: 6px; background: var(--surface-soft); color: var(--on-background); cursor: default;" disabled></select>
      </div>

      <div id="orgContentArea">
        <div class="muted">${t('loading', 'Loading organizational data...')}</div>
      </div>
    </div>
  `;

  const orgSelector = document.getElementById('orgSelector');
  const contentArea = document.getElementById('orgContentArea');

  let organizations = [];
  let currentOrgId = 1;

  async function loadOrgs() {
    try {
      const res = await api.getOrganizations();
      organizations = res.data || [];
      const nuOrg = organizations.find((o) =>
        o.name.toLowerCase().includes('naresuan') || o.name.includes('นเรศวร')
      ) || organizations[0] || { id: 1, name: 'มหาวิทยาลัยนเรศวร (Naresuan University)' };

      orgSelector.innerHTML = `<option value="${nuOrg.id}" selected>${escapeHtml(nuOrg.name)}</option>`;

      currentOrgId = Number(nuOrg.id);
      await loadOrgStructure(currentOrgId);
    } catch (err) {
      contentArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  }

  orgSelector.addEventListener('change', async (e) => {
    currentOrgId = Number(e.target.value);
    await loadOrgStructure(currentOrgId);
  });

  async function loadOrgStructure(orgId) {
    contentArea.innerHTML = `<div class="muted">Loading faculties and departments...</div>`;
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

      renderStructureView(orgId, facWithDepts, members);
    } catch (err) {
      contentArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderStructureView(orgId, faculties, members) {
    contentArea.innerHTML = `
      <div class="stack" style="gap: var(--sp-xl);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-md);">
            <h2 style="font-size: 1.125rem; font-weight: 600;">Faculties & Departments (${faculties.length})</h2>
            <button class="btn btn-secondary" id="btnSubAddFaculty" style="font-size: 0.8125rem;">+ Add Faculty</button>
          </div>

          ${
            faculties.length === 0
              ? `
            <div class="card" style="padding: var(--sp-xl); text-align: center;">
              <p class="muted">No faculties created yet in this organization.</p>
              <button class="btn btn-primary" id="btnEmptyAddFac">${icons.plus} Create First Faculty</button>
            </div>
          `
              : `
            <div class="stack" style="gap: var(--sp-md);">
              ${faculties
                .map(
                  (f) => `
                    <div class="card" style="padding: var(--sp-md); border-left: 4px solid var(--primary);">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-sm); gap: var(--sp-sm);">
                        <div>
                          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 2px; color: var(--on-background);">
                            ${escapeHtml(f.name)}
                          </h3>
                          ${f.description ? `<p class="muted" style="font-size: 0.8125rem; margin-bottom: 0;">${escapeHtml(f.description)}</p>` : ''}
                        </div>

                        <div style="display: flex; gap: var(--sp-xs); flex-wrap: wrap;">
                          <a class="btn btn-secondary" href="#/faculty-report?id=${f.id}" style="font-size: 0.75rem; height: 28px;">
                            Consolidated Report ↗
                          </a>

                          <button class="btn btn-secondary" data-add-dept="${f.id}" data-fac-name="${escapeHtml(f.name)}" style="font-size: 0.75rem; height: 28px;">
                            + Department
                          </button>

                          <button class="btn btn-secondary" data-edit-fac="${f.id}" data-fac-name="${escapeHtml(f.name)}" data-fac-desc="${escapeHtml(f.description || '')}" style="font-size: 0.75rem; height: 28px;">
                            Rename
                          </button>

                          <button class="btn-icon" data-delete-fac="${f.id}" title="Delete Faculty">
                            ${icons.trash}
                          </button>
                        </div>
                      </div>

                      <!-- Departments under this faculty -->
                      <div style="
                        background: var(--surface-soft);
                        border: 1px solid var(--outline);
                        border-radius: var(--radius-sm);
                        padding: var(--sp-sm);
                        margin-top: var(--sp-sm);
                      ">
                        <div style="
                          font-size: 0.75rem;
                          font-weight: 600;
                          color: var(--muted);
                          text-transform: uppercase;
                          margin-bottom: var(--sp-xs);
                        ">
                          Departments (${f.departments.length})
                        </div>

                        ${
                          f.departments.length === 0
                            ? `<div class="muted" style="font-size: 0.8125rem;">
                                No departments yet. SROI plans can be owned directly by this faculty.
                              </div>`
                            : `
                              <div class="stack" style="gap: var(--sp-xs);">
                                ${f.departments
                                  .map(
                                    (d) => `
                                      <div style="
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        gap: var(--sp-sm);
                                        flex-wrap: wrap;
                                        padding: 6px 10px;
                                        background: var(--surface-card);
                                        color: var(--on-background);
                                        border-radius: var(--radius-xs);
                                        border: 1px solid var(--outline);
                                      ">
                                        <div>
                                          <strong style="font-size: 0.875rem; color: var(--on-background);">
                                            ${escapeHtml(d.name)}
                                          </strong>

                                          ${d.description
                                            ? `<span class="muted" style="font-size: 0.75rem; margin-left: 8px;">
                                                ${escapeHtml(d.description)}
                                              </span>`
                                            : ''}
                                        </div>

                                        <div style="display: flex; gap: var(--sp-xs);">
                                          <button
                                            class="btn btn-ghost"
                                            data-edit-dept="${d.id}"
                                            data-dept-name="${escapeHtml(d.name)}"
                                            data-dept-desc="${escapeHtml(d.description || '')}"
                                            style="font-size: 0.75rem; height: 24px; padding: 0 6px;"
                                          >
                                            Rename
                                          </button>

                                          <button
                                            class="btn-icon"
                                            data-delete-dept="${d.id}"
                                            title="Delete Department"
                                            style="width: 24px; height: 24px;"
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
          `
          }
        </div>

        <!-- Organization Members Table -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-md);">
            <h2 style="font-size: 1.125rem; font-weight: 600;">Organization Members (${members.length})</h2>
            <button class="btn btn-secondary" id="btnAddMember" style="font-size: 0.8125rem;">+ Add Member</button>
          </div>
          <div class="card" style="padding: 0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                ${members
                  .map(
                    (m) => `
                  <tr>
                    <td class="strong">${escapeHtml(m.name)}</td>
                    <td>${escapeHtml(m.email)}</td>
                    <td><span class="badge badge-integrated">${escapeHtml(m.role)}</span></td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnSubAddFaculty')?.addEventListener('click', () => openCreateFacultyModal(orgId));
    document.getElementById('btnEmptyAddFac')?.addEventListener('click', () => openCreateFacultyModal(orgId));

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
          title: 'Delete Faculty',
          message: 'Are you sure you want to delete this faculty? If it or its departments own any plans, deletion will be blocked to protect data.',
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
          title: 'Delete Department',
          message: 'Are you sure you want to delete this department? If it owns any plans, deletion will be blocked.',
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

    document.getElementById('btnAddMember')?.addEventListener('click', () => openAddMemberModal(orgId));
  }

  function openCreateFacultyModal(orgId) {
    openModal({
      title: 'Create New Faculty',
      body: `
        <form id="createFacForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">Faculty Name *</label>
            <input type="text" name="name" class="input" required placeholder="e.g. คณะสหเวชศาสตร์ / Faculty of Allied Health Sciences" />
          </div>
          <div class="field">
            <label class="field-label">Description / Code</label>
            <textarea name="description" class="input" rows="2" placeholder="Brief description or faculty unit code"></textarea>
          </div>
          <div id="createFacError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitFac">Create Faculty</button>
      `,
    });

    document.getElementById('btnSubmitFac')?.addEventListener('click', async () => {
      const form = document.getElementById('createFacForm');
      const errBox = document.getElementById('createFacError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = 'Please enter a faculty name.';
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
      title: 'Rename / Edit Faculty',
      body: `
        <form id="editFacForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">Faculty Name *</label>
            <input type="text" name="name" class="input" required value="${escapeHtml(oldName)}" />
          </div>
          <div class="field">
            <label class="field-label">Description</label>
            <textarea name="description" class="input" rows="2">${escapeHtml(oldDesc)}</textarea>
          </div>
          <div id="editFacError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitEditFac">Save Changes</button>
      `,
    });

    document.getElementById('btnSubmitEditFac')?.addEventListener('click', async () => {
      const form = document.getElementById('editFacForm');
      const errBox = document.getElementById('editFacError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = 'Please enter a faculty name.';
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
      title: `Add Department to ${escapeHtml(facName)}`,
      body: `
        <form id="createDeptForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">Department Name *</label>
            <input type="text" name="name" class="input" required placeholder="e.g. ภาควิชากายภาพบำบัด / Department of Physical Therapy" />
          </div>
          <div class="field">
            <label class="field-label">Description</label>
            <textarea name="description" class="input" rows="2" placeholder="Brief description"></textarea>
          </div>
          <div id="createDeptError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitDept">Create Department</button>
      `,
    });

    document.getElementById('btnSubmitDept')?.addEventListener('click', async () => {
      const form = document.getElementById('createDeptForm');
      const errBox = document.getElementById('createDeptError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = 'Please enter a department name.';
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
      title: 'Rename / Edit Department',
      body: `
        <form id="editDeptForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">Department Name *</label>
            <input type="text" name="name" class="input" required value="${escapeHtml(oldName)}" />
          </div>
          <div class="field">
            <label class="field-label">Description</label>
            <textarea name="description" class="input" rows="2">${escapeHtml(oldDesc)}</textarea>
          </div>
          <div id="editDeptError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitEditDept">Save Changes</button>
      `,
    });

    document.getElementById('btnSubmitEditDept')?.addEventListener('click', async () => {
      const form = document.getElementById('editDeptForm');
      const errBox = document.getElementById('editDeptError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        errBox.textContent = 'Please enter a department name.';
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
      title: 'Add Member to Organization',
      body: `
        <form id="addMemberForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">User Email *</label>
            <input type="email" name="email" class="input" required placeholder="colleague@nu.ac.th" />
          </div>
          <div class="field">
            <label class="field-label">Role *</label>
            <select name="role" class="input">
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor" selected>Editor (Manage plans & assessments)</option>
              <option value="owner">Owner (Full administrative rights)</option>
            </select>
          </div>
          <div id="addMemberError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitMember">Add Member</button>
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

  document.getElementById('btnNewOrg')?.addEventListener('click', () => {
    openModal({
      title: 'Create Organization',
      body: `
        <form id="createOrgForm" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label">Organization Name *</label>
            <input type="text" name="name" class="input" required placeholder="e.g. Naresuan University" />
          </div>
          <div id="createOrgError" class="alert alert-danger" style="display: none;"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="btnSubmitOrg">Create</button>
      `,
    });

    document.getElementById('btnSubmitOrg')?.addEventListener('click', async () => {
      const form = document.getElementById('createOrgForm');
      const errBox = document.getElementById('createOrgError');
      const name = form.name.value.trim();
      if (!name) return;

      try {
        await api.createOrganization(name);
        closeModal();
        loadOrgs();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    });
  });

  document.getElementById('btnNewFaculty')?.addEventListener('click', () => {
    if (currentOrgId) openCreateFacultyModal(currentOrgId);
  });

  loadOrgs();
}
