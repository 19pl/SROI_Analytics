import { api, getCurrentUser } from '../api.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from '../components/icons.js';
import { t } from '../i18n.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';
import { showToast } from '../components/toast.js';

export async function renderOrg(root) {
  if (isGuest()) {
    renderGuestPage(root, 'org');
    return;
  }
  const user = getCurrentUser();

  root.innerHTML = `
    <div class="form-stack stack-lg">
      <!-- Page Header -->
      <div class="page-head">
        <div>
          <h1 class="page-head__title">${t('org_title', 'Faculties & Departments Hierarchy')}</h1>
          <p class="page-head__sub">
            ${t('org_subtitle', 'Manage university organizational structure and configure SROI plan ownership at Naresuan University')}
          </p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn-primary" id="btnNewFaculty">${icons.plus} ${t('btn_add_faculty', 'Add Faculty')}</button>
        </div>
      </div>

      <!-- Institutional Banner & Quick Overview -->
      <div class="card has-stripe org-banner-card">
        <div class="toolbar">
          <div class="org-banner-identity">
            <div class="org-banner-icon">
              ${icons.institution || icons.folder}
            </div>
            <div>
              <div class="muted-sm uppercase strong">
                ${t('institution_label', 'Academic Institution')}
              </div>
              <div class="strong" id="orgDisplayName">
                ${t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)')}
              </div>
            </div>
          </div>

          <div class="org-banner-stats">
            <div class="stat-item text-right">
              <div class="muted-sm">${t('stat_total_faculties', 'Total Faculties')}</div>
              <div class="strong primary-text" id="statFacCount">-</div>
            </div>
            <div class="stat-item text-right">
              <div class="muted-sm">${t('stat_total_departments', 'Total Departments')}</div>
              <div class="strong" id="statDeptCount">-</div>
            </div>
            <div class="stat-item text-right">
              <div class="muted-sm">${t('org_members_title', 'Organization Members')}</div>
              <div class="strong" id="statMemCount">-</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div id="orgContentArea">
        <div class="empty-state">
          <p class="empty-state__text">${t('loading', 'Loading organizational data...')}</p>
        </div>
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
  let allProjects = [];

  async function loadOrgs() {
    try {
      const res = await api.getOrganizations();
      organizations = res.data || [];
      const nuOrg = organizations.find(
        (o) => o.name.toLowerCase().includes('naresuan') || o.name.includes('นเรศวร'),
      ) ||
        organizations[0] || { id: 1, name: 'มหาวิทยาลัยนเรศวร (Naresuan University)' };

      currentOrgId = Number(nuOrg.id);
      if (orgDisplayName) {
        orgDisplayName.textContent = nuOrg.name;
      }
      await loadOrgStructure(currentOrgId);
    } catch (err) {
      contentArea.innerHTML = `<div class="field-error">${escapeHtml(err.message)}</div>`;
      showToast(err.message, 'error');
    }
  }

  async function loadOrgStructure(orgId) {
    contentArea.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__text">${t('loading', 'Loading faculties and departments...')}</p>
      </div>
    `;
    try {
      const [facRes, memRes, projRes] = await Promise.all([
        api.getFaculties(orgId),
        api.getOrgMembers(orgId),
        api.getProjects().catch(() => ({ data: [] })),
      ]);

      const faculties = facRes.data || [];
      const members = memRes.data || [];
      allProjects = projRes.data || [];

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
      const totalDepts = allFaculties.reduce(
        (acc, f) => acc + (f.departments ? f.departments.length : 0),
        0,
      );
      if (statFacCount) statFacCount.textContent = allFaculties.length;
      if (statDeptCount) statDeptCount.textContent = totalDepts;
      if (statMemCount) statMemCount.textContent = allMembers.length;

      renderStructureView(orgId, allFaculties, allMembers, allProjects);
    } catch (err) {
      contentArea.innerHTML = `<div class="field-error">${escapeHtml(err.message)}</div>`;
      showToast(err.message, 'error');
    }
  }

  function countPlansForFaculty(facultyId) {
    const fId = Number(facultyId);
    return allProjects.filter((p) => {
      if (p.owner_type === 'faculty' && Number(p.faculty_id) === fId) return true;
      if (Number(p.faculty_id) === fId) return true;
      return false;
    }).length;
  }

  function countPlansForDepartment(departmentId) {
    const dId = Number(departmentId);
    return allProjects.filter((p) => Number(p.department_id) === dId).length;
  }

  function renderStructureView(orgId, faculties, members, projects) {
    contentArea.innerHTML = `
      <div class="form-stack stack-lg">
        <!-- Faculties Section -->
        <div>
          <div class="toolbar">
            <h2 class="panel__title">
              ${t('fac_and_dept_count', 'Faculties & Departments')}
            </h2>
            <div class="org-list-toolbar">
              <input
                type="search"
                id="searchFacultyInput"
                class="input org-search-input"
                aria-label="${t('search_faculties_placeholder', 'Search faculties...')}"
                placeholder="${t('search_faculties_placeholder', 'Search faculties...')}"
              />
              <div class="org-tree-controls" role="group" aria-label="${t('faculty_tree_controls', 'Faculty tree controls')}">
                <button type="button" class="btn btn-ghost btn-compact" id="btnExpandAll">${t('expand_all', 'Expand all')}</button>
                <button type="button" class="btn btn-ghost btn-compact" id="btnCollapseAll">${t('collapse_all', 'Collapse all')}</button>
              </div>
            </div>
          </div>

          <div id="facultyCardsList">
            ${renderFacultyTree(faculties)}
          </div>
        </div>

        <!-- Organization Members Table -->
        <div class="panel">
          <div class="toolbar">
            <h2 class="panel__title">
              ${t('org_members_title', 'Organization Members')}
            </h2>
            <button class="btn btn-secondary btn-compact" id="btnAddMember">
              ${icons.plus} ${t('btn_add_member', 'Add Member')}
            </button>
          </div>
          <div class="table-wrap">
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
                    ? `<tr><td colspan="3" class="empty-state">${t('no_data', 'No members found.')}</td></tr>`
                    : members
                        .map(
                          (m) => `
                        <tr>
                          <td class="strong">${escapeHtml(m.name || m.email)}</td>
                          <td>${escapeHtml(m.email)}</td>
                          <td><span class="status status--neutral">${escapeHtml(m.role)}</span></td>
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

    document.getElementById('btnExpandAll')?.addEventListener('click', () => {
      contentArea.querySelectorAll('.org-faculty-disclosure').forEach((node) => { node.open = true; });
    });
    document.getElementById('btnCollapseAll')?.addEventListener('click', () => {
      contentArea.querySelectorAll('.org-faculty-disclosure').forEach((node) => { node.open = false; });
    });

    // Search filter for faculties
    const searchInput = document.getElementById('searchFacultyInput');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = faculties.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q)) ||
          (f.departments && f.departments.some((d) => d.name.toLowerCase().includes(q))),
      );
      const container = document.getElementById('facultyCardsList');
      if (container) {
        container.innerHTML = renderFacultyTree(filtered);
        bindFacultyEvents(orgId);
      }
    });

    document
      .getElementById('btnAddMember')
      ?.addEventListener('click', () => openAddMemberModal(orgId));
  }

  function renderFacultyTree(faculties) {
    if (faculties.length === 0) {
      return `<div class="empty-state"><p class="empty-state__title">${t('no_faculties_yet', 'No faculties created yet in this institution.')}</p></div>`;
    }
    return `
      <div class="org-tree">
        ${faculties.map((f) => {
          const planCount = f.plan_count != null ? f.plan_count : countPlansForFaculty(f.id);
          const depts = f.departments || [];
          return `
          <div class="org-faculty-node">
            <details class="org-faculty-disclosure">
            <summary class="org-faculty-summary">
              <span class="org-faculty-summary__chevron" aria-hidden="true"></span>
              <span class="org-faculty-summary__info">
                <span class="org-faculty-summary__title">${escapeHtml(f.name)}</span>
                ${f.description ? `<span class="org-faculty-summary__secondary">${escapeHtml(f.description)}</span>` : ''}
                <span class="org-faculty-summary__counts">${depts.length} ${t('departments_short', 'ภาควิชา')} · ${planCount} ${t('plans', 'แผนงาน')}</span>
              </span>
            </summary>
            <div class="org-dept-container">
              ${depts.length === 0
                ? `<p class="muted-sm">${t('no_departments_yet', 'No departments yet. SROI plans can be owned directly by this faculty.')}</p>`
                : `<div class="org-dept-list">${depts.map((d) => {
                    const deptPlanCount = d.plan_count != null ? d.plan_count : countPlansForDepartment(d.id);
                    return `
                      <div class="org-dept-row">
                        <div class="org-dept-row__info">
                          <span class="org-dept-row__name">${escapeHtml(d.name)}</span>
                          ${d.description ? `<span class="org-dept-row__secondary">${escapeHtml(d.description)}</span>` : ''}
                          <span class="org-faculty-summary__counts">${deptPlanCount} ${t('plans', 'แผนงาน')}</span>
                        </div>
                        <div class="org-dept-row__actions">
                          <button type="button" class="btn-icon btn-icon--lg org-row-menu-trigger" data-dept-menu="${d.id}" aria-label="${t('department_actions_for', 'Department actions')}: ${escapeHtml(d.name)}" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">⋯</span></button>
                        </div>
                      </div>`;
                  }).join('')}</div>`}
            </div>
            </details>
            <div class="org-faculty-actions">
              <a class="org-report-link" href="#/faculty-report?id=${f.id}">${t('conso_report', 'Consolidated Report')}</a>
              <button type="button" class="btn btn-primary btn-compact" data-add-dept="${f.id}" data-fac-name="${escapeHtml(f.name)}">${icons.plus} ${t('departments_in_fac', 'Department')}</button>
              <button type="button" class="btn-icon btn-icon--lg org-row-menu-trigger" data-fac-menu="${f.id}" aria-label="${t('faculty_actions_for', 'Faculty actions')}: ${escapeHtml(f.name)}" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">⋯</span></button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openOrgRowMenu(anchor, items) {
    const previous = document.querySelector('.org-row-menu');
    if (previous) {
      const sameAnchor = previous._anchor === anchor;
      previous._close?.();
      if (sameAnchor) return;
    }
    const menu = document.createElement('div');
    menu.className = 'row-menu org-row-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((item, index) =>
      `${item.separatorBefore ? '<div class="row-menu__sep" role="separator"></div>' : ''}<button type="button" role="menuitem" class="row-menu__item${item.danger ? ' row-menu__item--danger' : ''}" data-menu-index="${index}">${escapeHtml(item.label)}</button>`
    ).join('');
    document.body.appendChild(menu);
    menu._anchor = anchor;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const top = rect.bottom + menuRect.height + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - menuRect.height - 4);
      menu.style.top = `${top}px`;
      menu.style.left = `${Math.min(window.innerWidth - menuRect.width - 8, Math.max(8, rect.right - menuRect.width))}px`;
    };
    const close = () => {
      menu.remove(); anchor.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
    const onOutside = (event) => { if (!menu.contains(event.target) && !anchor.contains(event.target)) close(); };
    const menuItems = [...menu.querySelectorAll('[role="menuitem"]')];
    const onKey = (event) => {
      const current = menuItems.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); close(); anchor.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuItems.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + menuItems.length) % menuItems.length;
        menuItems[next]?.focus();
      } else if (event.key === 'Tab') close();
    };
    menu._close = close;
    anchor.setAttribute('aria-expanded', 'true');
    menuItems.forEach((button) => button.addEventListener('click', () => { const item = items[Number(button.dataset.menuIndex)]; close(); item?.onSelect(); }));
    position();
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    menuItems[0]?.focus();
  }

  function bindFacultyEvents(orgId) {
    contentArea.querySelectorAll('[data-add-dept]').forEach((btn) => btn.addEventListener('click', () => {
      openOrgEntityModal({ type: 'department', mode: 'create', parentId: Number(btn.dataset.addDept), parentName: btn.dataset.facName });
    }));
    contentArea.querySelectorAll('[data-fac-menu]').forEach((btn) => btn.addEventListener('click', () => {
      const faculty = allFaculties.find((f) => Number(f.id) === Number(btn.dataset.facMenu));
      if (!faculty) return;
      openOrgRowMenu(btn, [
        { label: t('btn_rename', 'Rename'), onSelect: () => openOrgEntityModal({ type: 'faculty', mode: 'edit', id: Number(faculty.id), currentName: faculty.name, currentDescription: faculty.description || '' }) },
        { label: t('btn_delete', 'Delete'), danger: true, separatorBefore: true, onSelect: () => confirmModal({
          title: t('btn_delete', 'Delete Faculty'),
          message: t('confirm_delete_fac', 'Are you sure you want to delete this faculty? If it or its departments own any plans, deletion will be blocked to protect data.'),
          onConfirm: async () => { try { await api.deleteFaculty(Number(faculty.id)); showToast(t('deleted_faculty', 'Faculty deleted successfully'), 'success'); loadOrgStructure(orgId); } catch (e) { showToast(e.message, 'error'); } },
        }) },
      ]);
    }));
    contentArea.querySelectorAll('[data-dept-menu]').forEach((btn) => btn.addEventListener('click', () => {
      const departmentId = Number(btn.dataset.deptMenu);
      const department = allFaculties.flatMap((f) => f.departments || []).find((d) => Number(d.id) === departmentId);
      if (!department) return;
      openOrgRowMenu(btn, [
        { label: t('btn_rename', 'Rename'), onSelect: () => openOrgEntityModal({ type: 'department', mode: 'edit', id: departmentId, currentName: department.name, currentDescription: department.description || '' }) },
        { label: t('btn_delete', 'Delete'), danger: true, separatorBefore: true, onSelect: () => confirmModal({
          title: t('btn_delete', 'Delete Department'),
          message: t('confirm_delete_dept', 'Are you sure you want to delete this department? If it owns any plans, deletion will be blocked.'),
          onConfirm: async () => { try { await api.deleteDepartment(departmentId); showToast(t('deleted_dept', 'Department deleted successfully'), 'success'); loadOrgStructure(orgId); } catch (e) { showToast(e.message, 'error'); } },
        }) },
      ]);
    }));
  }

  function openOrgEntityModal({
    type = 'faculty',
    mode = 'create',
    id = null,
    parentId = null,
    parentName = '',
    currentName = '',
    currentDescription = '',
  }) {
    const isFac = type === 'faculty';
    const isCreate = mode === 'create';

    let title = '';
    if (isFac) {
      title = isCreate
        ? t('modal_create_fac_title', 'Create New Faculty')
        : t('modal_edit_fac_title', 'Edit Faculty');
    } else {
      title = isCreate
        ? `${t('modal_create_dept_title', 'Add Department')} : ${escapeHtml(parentName)}`
        : t('modal_edit_dept_title', 'Edit Department');
    }

    const nameLabel = isFac
      ? t('field_fac_name', 'Faculty Name *')
      : t('field_dept_name', 'Department Name *');

    const descLabel = isFac
      ? t('field_fac_desc', 'English name / code')
      : t('field_dept_desc', 'Description / Department Code');

    const namePlaceholder = isFac
      ? 'e.g. คณะสหเวชศาสตร์ / Faculty of Allied Health Sciences'
      : 'e.g. ภาควิชากายภาพบำบัด / Department of Physical Therapy';

    const descPlaceholder = isFac
      ? t('ph_fac_desc', 'Brief description or faculty unit code (optional)')
      : t('ph_dept_desc', 'Brief department description or unit code (optional)');

    const submitLabel = isCreate
      ? (isFac ? t('save_create_fac', 'Create Faculty') : t('save_create_dept', 'Create Department'))
      : t('save_changes', 'Save Changes');

    openModal({
      title,
      body: `
        <form id="orgEntityForm" class="form-stack">
          <div class="field">
            <label class="field-label">${nameLabel}</label>
            <input type="text" name="name" class="input" required value="${escapeHtml(currentName)}" placeholder="${escapeHtml(namePlaceholder)}" />
          </div>
          <div class="field">
            <label class="field-label">${descLabel}</label>
            <textarea name="description" class="input" rows="2" placeholder="${escapeHtml(descPlaceholder)}">${escapeHtml(currentDescription)}</textarea>
          </div>
          <div id="orgEntityError" class="field-error" hidden></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnSubmitOrgEntity">${submitLabel}</button>
      `,
    });

    document.getElementById('btnSubmitOrgEntity')?.addEventListener('click', async () => {
      const form = document.getElementById('orgEntityForm');
      const errBox = document.getElementById('orgEntityError');
      const name = form.name.value.trim();
      const description = form.description.value.trim();

      if (!name) {
        const reqMsg = isFac
          ? t('required_fac_name', 'Please enter a faculty name.')
          : t('required_dept_name', 'Please enter a department name.');
        errBox.textContent = reqMsg;
        errBox.hidden = false;
        return;
      }

      try {
        if (isFac) {
          if (isCreate) {
            await api.createFaculty(parentId, { name, description });
            showToast(t('created_faculty', 'Faculty created successfully'), 'success');
          } else {
            await api.updateFaculty(id, { name, description });
            showToast(t('updated_faculty', 'Faculty updated successfully'), 'success');
          }
        } else {
          if (isCreate) {
            await api.createDepartment(parentId, { name, description });
            showToast(t('created_dept', 'Department created successfully'), 'success');
          } else {
            await api.updateDepartment(id, { name, description });
            showToast(t('updated_dept', 'Department updated successfully'), 'success');
          }
        }
        closeModal();
        loadOrgStructure(currentOrgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
  }

  function openAddMemberModal(orgId) {
    openModal({
      title: t('modal_add_member_title', 'Add Member to Organization'),
      body: `
        <form id="addMemberForm" class="form-stack">
          <div class="field">
            <label class="field-label">${t('field_user_email', 'User Email *')}</label>
            <input type="email" name="email" class="input" required placeholder="colleague@nu.ac.th" />
            <p class="field-hint">${t('email_nu_hint', 'Enter an official university email ending with @nu.ac.th')}</p>
          </div>
          <div class="field">
            <label class="field-label">${t('field_role', 'Role *')}</label>
            <select name="role" class="input">
              <option value="owner">${t('role_owner_desc', 'Owner — Full control of organization, faculties, and plans')}</option>
              <option value="editor" selected>${t('role_editor_desc', 'Editor — Can create, edit, and evaluate SROI plans')}</option>
              <option value="viewer">${t('role_viewer_desc', 'Viewer — Read-only access to plans and reports')}</option>
            </select>
          </div>
          <div id="addMemberError" class="field-error" hidden></div>
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

      // Validate email ending with @nu.ac.th
      const emailLower = email.toLowerCase();
      if (!email || !emailLower.endsWith('@nu.ac.th') || !emailLower.includes('@')) {
        errBox.textContent = t(
          'err_nu_email_required',
          'Please enter a valid Naresuan University email address ending with @nu.ac.th',
        );
        errBox.hidden = false;
        return;
      }

      try {
        await api.post(`/organizations/${orgId}/members`, { email, role });
        showToast(t('member_added', 'Member added successfully'), 'success');
        closeModal();
        loadOrgStructure(orgId);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
  }

  document.getElementById('btnNewFaculty')?.addEventListener('click', () => {
    if (currentOrgId) {
      openOrgEntityModal({
        type: 'faculty',
        mode: 'create',
        parentId: currentOrgId,
      });
    }
  });

  loadOrgs();
}
