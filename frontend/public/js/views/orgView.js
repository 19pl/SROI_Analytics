import { api, getCurrentUser } from '../api.js';
import { openModal, closeModal } from '../components/modal.js';
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
  const roleRank = { viewer: 1, editor: 2, owner: 3 };
  let currentOrgRole = 'viewer';
  const canEditStructure = () => (roleRank[currentOrgRole] || 0) >= roleRank.editor;
  const canDeleteStructure = () => currentOrgRole === 'owner';
  const canManageMembers = () => currentOrgRole === 'owner';
  let expandedFacultyIds = new Set();
  let searchQuery = '';

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
          <button class="btn btn-primary" id="btnNewFaculty" hidden>${icons.plus} ${t('btn_add_faculty', 'Add Faculty')}</button>
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
        <div class="org-skeleton" role="status" aria-label="${t('loading', 'กำลังโหลดข้อมูล')}" aria-live="polite"><span></span><span></span><span></span></div>
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
      currentOrgRole = nuOrg.role || 'viewer';
      const addFaculty = document.getElementById('btnNewFaculty');
      if (addFaculty) addFaculty.hidden = !canEditStructure();
      if (orgDisplayName) {
        orgDisplayName.textContent = nuOrg.name;
      }
      await loadOrgStructure(currentOrgId, { showLoading: true });
    } catch (err) {
      contentArea.innerHTML = `<div class="field-error">${escapeHtml(err.message)}</div>`;
      showToast(err.message, 'error');
    }
  }

  async function loadOrgStructure(orgId, { showLoading = false } = {}) {
    contentArea.querySelectorAll('.org-faculty-node').forEach((row) => {
      const detail = row.querySelector('.org-faculty-disclosure');
      const id = Number(row.dataset.facultyId);
      if (detail?.open) expandedFacultyIds.add(id); else if (detail) expandedFacultyIds.delete(id);
    });
    const scrollTop = window.scrollY;
    if (showLoading) contentArea.innerHTML = `<div class="org-skeleton" aria-label="${t('loading', 'กำลังโหลดข้อมูล')}"><span></span><span></span><span></span></div>`;
    try {
      const [facRes, memRes, projRes, deletedProjRes] = await Promise.all([
        api.getFaculties(orgId),
        api.getOrgMembers(orgId),
        api.getProjects({ organization_id: orgId }).catch(() => ({ data: [] })),
        api.getProjects({ organization_id: orgId, deleted: true }).catch(() => ({ data: [] })),
      ]);

      const faculties = facRes.data || [];
      const members = memRes.data || [];
      allProjects = [...(projRes.data || []), ...(deletedProjRes.data || [])];

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
      window.scrollTo(0, scrollTop);
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
    const ownerCount = members.filter((member) => member.role === 'owner').length;
    contentArea.innerHTML = `
      <div class="form-stack stack-lg">
        <!-- Faculties Section -->
        <div>
          <div class="toolbar org-faculty-toolbar">
            <h2 class="panel__title">
              ${t('fac_and_dept_count', 'Faculties & Departments')}
            </h2>
            <div class="org-list-toolbar">
              <div class="org-search-box">
                <input type="search" id="searchFacultyInput" class="input org-search-input"
                  aria-label="${t('search_faculties_placeholder', 'ค้นหาคณะหรือภาควิชา')}"
                  placeholder="${t('search_faculties_placeholder', 'ค้นหาคณะหรือภาควิชา')}" value="${escapeHtml(searchQuery)}" />
                <button type="button" class="org-search-clear" id="btnClearFacultySearch" aria-label="${t('clear_search', 'ล้างคำค้นหา')}" ${searchQuery ? '' : 'hidden'}>×</button>
              </div>
              <span class="org-search-count" id="facultySearchCount" aria-live="polite"></span>
              <div class="org-tree-controls" role="group" aria-label="${t('faculty_tree_controls', 'Faculty tree controls')}">
                <button type="button" class="org-tree-btn" id="btnExpandAll">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                  <span>${t('expand_all', 'Expand all')}</span>
                </button>
                <button type="button" class="org-tree-btn" id="btnCollapseAll">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 11 12 6 17 11"/><polyline points="7 18 12 13 17 18"/></svg>
                  <span>${t('collapse_all', 'Collapse all')}</span>
                </button>
              </div>
            </div>
          </div>

          <div id="facultyCardsList">
            ${renderFacultyTree(getFilteredFaculties(faculties))}
          </div>
        </div>

        <!-- Organization Members Table -->
        <div class="panel">
          <div class="toolbar">
            <h2 class="panel__title">
              ${t('org_members_title', 'Organization Members')}
            </h2>
            <button class="btn btn-secondary btn-compact" id="btnAddMember" ${canManageMembers() ? '' : 'hidden'}>${icons.plus} ${t('btn_add_member', 'Add Member')}</button>
          </div>
          <div class="table-wrap">
            <table class="table org-members-table">
              <thead>
                <tr>
                  <th>${t('col_member_name', 'Name')}</th>
                  <th>${t('col_member_email', 'Email')}</th>
                  <th>${t('col_member_role', 'Role')}</th>
                </tr>
              </thead>
              <tbody>
                ${renderMemberRows(members, ownerCount)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindFacultyEvents(orgId);
    bindMemberEvents(orgId);
    bindFacultyDisclosureState();
    updateSearchCount(allFaculties);

    document.getElementById('btnExpandAll')?.addEventListener('click', () => {
      contentArea.querySelectorAll('.org-faculty-disclosure').forEach((node) => { node.open = true; expandedFacultyIds.add(Number(node.closest('.org-faculty-node')?.dataset.facultyId)); });
    });
    document.getElementById('btnCollapseAll')?.addEventListener('click', () => {
      contentArea.querySelectorAll('.org-faculty-disclosure').forEach((node) => { node.open = false; expandedFacultyIds.delete(Number(node.closest('.org-faculty-node')?.dataset.facultyId)); });
    });
    const searchInput = document.getElementById('searchFacultyInput');
    searchInput?.addEventListener('input', (event) => {
      searchQuery = event.target.value.trim();
      document.getElementById('btnClearFacultySearch').hidden = !searchQuery;
      refreshFacultyTree({ autoExpand: Boolean(searchQuery) });
    });
    document.getElementById('btnClearFacultySearch')?.addEventListener('click', () => {
      searchQuery = '';
      searchInput.value = '';
      document.getElementById('btnClearFacultySearch').hidden = true;
      searchInput.focus();
      refreshFacultyTree();
    });

    document
      .getElementById('btnAddMember')
      ?.addEventListener('click', () => openAddMemberModal(orgId));
  }

  function renderFacultyTree(faculties) {
    if (faculties.length === 0) {
      return allFaculties.length === 0
        ? `<div class="empty-state"><p class="empty-state__title">${t('no_faculties_yet', 'ยังไม่มีข้อมูลคณะในสถาบันนี้')}</p></div>`
        : `<div class="empty-state"><p class="empty-state__title">${t('search_no_results', 'ไม่พบข้อมูลที่ตรงกับการค้นหา')}</p></div>`;
    }
    return `
      <div class="org-tree">
        ${faculties.map((f) => {
          const planCount = f.plan_count != null ? f.plan_count : countPlansForFaculty(f.id);
          const depts = f.departments || [];
          return `
          <div class="org-faculty-node" data-faculty-id="${f.id}">
            <details class="org-faculty-disclosure">
            <summary class="org-faculty-summary">
              <span class="org-faculty-summary__chevron" aria-hidden="true"></span>
              <span class="org-faculty-summary__info">
                <span class="org-faculty-summary__title">${highlightText(f.name)}</span>
                ${f.description ? `<span class="org-faculty-summary__secondary">${highlightText(f.description)}</span>` : ''}
                <span class="org-faculty-summary__counts">${f._totalDepartmentCount ?? depts.length} ${t('departments_short', 'ภาควิชา')} · ${planCount} ${t('plans', 'แผนงาน')}</span>
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
                          <span class="org-dept-row__name">${highlightText(d.name)}</span>
                          ${d.description ? `<span class="org-dept-row__secondary">${highlightText(d.description)}</span>` : ''}
                          <span class="org-faculty-summary__counts">${deptPlanCount} ${t('plans', 'แผนงาน')}</span>
                        </div>
                        <div class="org-dept-row__actions">
                          ${canEditStructure() ? `<button type="button" class="btn-icon btn-icon--lg org-row-menu-trigger" data-dept-menu="${d.id}" aria-label="${t('department_actions_for', 'Department actions')}: ${escapeHtml(d.name)}" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">⋯</span></button>` : ''}
                        </div>
                      </div>`;
                  }).join('')}</div>`}
            </div>
            </details>
            <div class="org-faculty-actions">
              <a class="org-report-link" href="#/faculty-report?id=${f.id}">${t('conso_report', 'Consolidated Report')}</a>
              ${canEditStructure() ? `<button type="button" class="btn btn-primary btn-compact" data-add-dept="${f.id}" data-fac-name="${escapeHtml(f.name)}">${icons.plus} ${t('departments_in_fac', 'Department')}</button>` : ''}
              ${canEditStructure() ? `<button type="button" class="btn-icon btn-icon--lg org-row-menu-trigger" data-fac-menu="${f.id}" aria-label="${t('faculty_actions_for', 'Faculty actions')}: ${escapeHtml(f.name)}" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">⋯</span></button>` : ''}
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
        ...(canDeleteStructure() ? [{ label: t('btn_delete', 'Delete'), danger: true, separatorBefore: true, onSelect: () => openOrgConfirm({
          title: `${t('delete_faculty_title', 'ลบคณะ')} ${escapeHtml(faculty.name)}`,
          message: `${t('delete_faculty_confirm_prefix', 'ท่านกำลังลบคณะ')} <strong>${escapeHtml(faculty.name)}</strong><br>${faculty.departments.length} ${t('departments_short', 'ภาควิชา')} · ${faculty.departments.reduce((n,d) => n + countPlansForDepartment(d.id), countPlansForFaculty(faculty.id))} ${t('plans', 'แผนงาน')}<br>${t('delete_blocked_explanation', 'ระบบจะไม่ลบข้อมูลแผนงานโดยอัตโนมัติ หากยังมีแผนงานที่ใช้งานอยู่จะไม่อนุญาตให้ลบ')}`,
          confirmText: t('btn_delete', 'ลบ'),
          onConfirm: async () => { await api.deleteFaculty(Number(faculty.id)); allFaculties = allFaculties.filter((item) => Number(item.id) !== Number(faculty.id)); updateOrgStats(); refreshFacultyTree(); showToast(t('deleted_faculty', 'ลบคณะสำเร็จ'), 'success'); },
        }) }] : []),
      ]);
    }));
    contentArea.querySelectorAll('[data-dept-menu]').forEach((btn) => btn.addEventListener('click', () => {
      const departmentId = Number(btn.dataset.deptMenu);
      const department = allFaculties.flatMap((f) => f.departments || []).find((d) => Number(d.id) === departmentId);
      if (!department) return;
      openOrgRowMenu(btn, [
        { label: t('btn_rename', 'Rename'), onSelect: () => openOrgEntityModal({ type: 'department', mode: 'edit', id: departmentId, currentName: department.name, currentDescription: department.description || '' }) },
        ...(canDeleteStructure() ? [{ label: t('btn_delete', 'Delete'), danger: true, separatorBefore: true, onSelect: () => openOrgConfirm({
          title: `${t('delete_department_title', 'ลบภาควิชา')} ${escapeHtml(department.name)}`,
          message: `${t('delete_department_confirm_prefix', 'ท่านกำลังลบภาควิชา')} <strong>${escapeHtml(department.name)}</strong><br>${countPlansForDepartment(departmentId)} ${t('plans', 'แผนงาน')}<br>${t('delete_blocked_explanation', 'ระบบจะไม่ลบข้อมูลแผนงานโดยอัตโนมัติ หากยังมีแผนงานที่ใช้งานอยู่จะไม่อนุญาตให้ลบ')}`,
          confirmText: t('btn_delete', 'ลบ'),
          onConfirm: async () => { await api.deleteDepartment(departmentId); allFaculties = allFaculties.map((faculty) => ({ ...faculty, departments: (faculty.departments || []).filter((item) => Number(item.id) !== departmentId) })); updateOrgStats(); refreshFacultyTree(); showToast(t('deleted_dept', 'ลบภาควิชาสำเร็จ'), 'success'); },
        }) }] : []),
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
      ? t('ph_fac_name', 'e.g. Faculty of Allied Health Sciences')
      : t('ph_dept_name', 'e.g. Department of Physical Therapy');

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

    document.getElementById('btnSubmitOrgEntity')?.addEventListener('click', async (event) => {
      const submitButton = event.currentTarget;
      if (submitButton.disabled) return;
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

      if (name.length > 200 || description.length > 2000) {
        errBox.textContent = t('org_validation_length', 'ชื่อไม่เกิน 200 ตัวอักษร และคำอธิบายไม่เกิน 2,000 ตัวอักษร');
        errBox.hidden = false; return;
      }
      submitButton.disabled = true;
      submitButton.textContent = t('saving', 'กำลังบันทึก...');
      try {
        if (isFac) {
          if (isCreate) {
            const response = await api.createFaculty(parentId, { name, description });
            allFaculties.push({ ...response.data, departments: [] });
            updateOrgStats(); refreshFacultyTree();
            showToast(t('created_faculty', 'Faculty created successfully'), 'success');
          } else {
            const response = await api.updateFaculty(id, { name, description });
            allFaculties = allFaculties.map((faculty) => Number(faculty.id) === Number(id) ? { ...faculty, ...response.data } : faculty);
            refreshFacultyTree();
            showToast(t('updated_faculty', 'Faculty updated successfully'), 'success');
          }
        } else {
          if (isCreate) {
            const response = await api.createDepartment(parentId, { name, description });
            allFaculties = allFaculties.map((faculty) => Number(faculty.id) === Number(parentId) ? { ...faculty, departments: [...(faculty.departments || []), response.data] } : faculty);
            expandedFacultyIds.add(Number(parentId));
            updateOrgStats(); refreshFacultyTree();
            showToast(t('created_dept', 'Department created successfully'), 'success');
          } else {
            const response = await api.updateDepartment(id, { name, description });
            allFaculties = allFaculties.map((faculty) => ({ ...faculty, departments: (faculty.departments || []).map((dept) => Number(dept.id) === Number(id) ? { ...dept, ...response.data } : dept) }));
            refreshFacultyTree();
            showToast(t('updated_dept', 'Department updated successfully'), 'success');
          }
        }
        closeModal();
      } catch (err) {
        errBox.textContent = localizeOrgError(err);
        errBox.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    });
  }

  function openOrgConfirm({ title, message, confirmText, onConfirm }) {
    openModal({
      title,
      body: `<div class="org-confirm-message">${message}</div><div id="orgConfirmError" class="field-error" role="alert" hidden></div>`,
      footer: `<button class="btn btn-secondary" data-modal-close>${t('cancel','ยกเลิก')}</button><button class="btn btn-danger" id="btnConfirmOrgAction">${confirmText || t('confirm','ยืนยัน')}</button>`,
    });
    document.getElementById('btnConfirmOrgAction')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = t('saving','กำลังดำเนินการ...');
      try { await onConfirm(); closeModal(); }
      catch (error) {
        const errorBox = document.getElementById('orgConfirmError');
        if (errorBox) { errorBox.textContent = localizeOrgError(error); errorBox.hidden = false; }
        button.disabled = false;
        button.textContent = confirmText || t('confirm','ยืนยัน');
      }
    });
  }

  function openAddMemberModal(orgId) {
    openModal({
      title: t('modal_add_member_title', 'เพิ่มสมาชิกในองค์กร'),
      body: `
        <form id="addMemberForm" class="form-stack">
          <div class="field"><label class="field-label" for="memberEmail">${t('field_user_email', 'อีเมลผู้ใช้งาน *')}</label>
            <input id="memberEmail" type="email" name="email" class="input" required maxlength="254" placeholder="colleague@nu.ac.th" />
            <p class="field-hint">${t('email_nu_hint', 'ใช้อีเมลมหาวิทยาลัยที่ลงท้ายด้วย @nu.ac.th')}</p></div>
          <fieldset class="field org-role-options"><legend class="field-label">${t('field_role', 'บทบาท *')}</legend>
            ${[['owner','role_owner_th','role_owner_desc'],['editor','role_editor_th','role_editor_desc'],['viewer','role_viewer_th','role_viewer_desc']].map(([v,n,d]) => `<label class="org-role-card"><input type="radio" name="role" value="${v}" ${v==='editor'?'checked':''}/><span class="org-role-card__content"><strong>${t(n,n==='role_owner_th'?'เจ้าของ':n==='role_editor_th'?'ผู้แก้ไข':'ผู้ดู')}</strong><small>${t(d,d)}</small></span></label>`).join('')}
          </fieldset>
          <div id="addMemberError" class="field-error" role="alert" hidden></div>
        </form>`,
      footer: `<button class="btn btn-secondary" data-modal-close>${t('cancel','ยกเลิก')}</button><button class="btn btn-primary" id="btnSubmitMember">${t('btn_add_member','เพิ่มสมาชิก')}</button>`,
    });
    document.getElementById('btnSubmitMember')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      const form = document.getElementById('addMemberForm');
      const error = document.getElementById('addMemberError');
      const email = form.elements.email.value.trim().toLowerCase();
      const role = form.elements.role.value;
      if (!/^[^\s@]+@nu\.ac\.th$/i.test(email)) { error.textContent = t('err_nu_email_required','กรุณาใช้อีเมลที่ลงท้ายด้วย @nu.ac.th'); error.hidden = false; return; }
      button.disabled = true; button.textContent = t('saving','กำลังบันทึก...');
      try {
        const response = await api.post(`/organizations/${orgId}/members`, { email, role });
        allMembers.push(response.data);
        updateOrgStats(); refreshMemberTable();
        closeModal(); showToast(t('member_added','เพิ่มสมาชิกสำเร็จ'),'success');
      } catch (err) { error.textContent = localizeOrgError(err); error.hidden = false; button.disabled = false; button.textContent = t('btn_add_member','เพิ่มสมาชิก'); }
    });
  }

  function renderMemberRows(members, ownerCount = members.filter((member) => member.role === 'owner').length) {
    if (!members.length) return `<tr><td colspan="3" class="empty-state">${t('no_data','ไม่พบสมาชิก')}</td></tr>`;
    return members.map((member) => `
      <tr>
        <td class="strong">${escapeHtml(memberDisplayName(member))}</td>
        <td>${escapeHtml(member.email)}</td>
        <td>${canManageMembers()
          ? `<div class="org-member-controls"><select class="input org-member-role role-badge role-badge--${escapeHtml(member.role)}" data-member-role="${member.user_id}" aria-label="${t('change_member_role','เปลี่ยนบทบาท')} ${escapeHtml(memberDisplayName(member))}" ${member.role === 'owner' && ownerCount <= 1 ? 'disabled' : ''}><option value="owner" ${member.role === 'owner' ? 'selected' : ''}>${t('role_owner_th','เจ้าของ')}</option><option value="editor" ${member.role === 'editor' ? 'selected' : ''}>${t('role_editor_th','ผู้แก้ไข')}</option><option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>${t('role_viewer_th','ผู้ดู')}</option></select><button type="button" class="btn-icon org-member-remove" data-remove-member="${member.user_id}" aria-label="${t('remove_member','นำสมาชิกออก')} ${escapeHtml(memberDisplayName(member))}" ${member.role === 'owner' && ownerCount <= 1 ? 'disabled title="' + t('last_owner_warning','องค์กรต้องมีเจ้าของอย่างน้อยหนึ่งคน') + '"' : ''}>×</button></div>`
          : `<span class="role-badge role-badge--${escapeHtml(member.role)}">${roleLabel(member.role)}</span>`}</td>
      </tr>`).join('');
  }

  function bindFacultyDisclosureState(autoExpand = false) {
    contentArea.querySelectorAll('.org-faculty-disclosure').forEach((node) => {
      const id = Number(node.closest('.org-faculty-node')?.dataset.facultyId);
      if (autoExpand) expandedFacultyIds.add(id);
      node.open = expandedFacultyIds.has(id);
      node.addEventListener('toggle', () => node.open ? expandedFacultyIds.add(id) : expandedFacultyIds.delete(id));
    });
  }

  function refreshFacultyTree({ autoExpand = false } = {}) {
    contentArea.querySelectorAll('.org-faculty-node').forEach((row) => {
      const detail = row.querySelector('.org-faculty-disclosure');
      const id = Number(row.dataset.facultyId);
      if (detail?.open) expandedFacultyIds.add(id); else if (detail) expandedFacultyIds.delete(id);
    });
    const container = document.getElementById('facultyCardsList');
    if (!container) return;
    container.innerHTML = renderFacultyTree(getFilteredFaculties(allFaculties));
    bindFacultyEvents(currentOrgId);
    bindFacultyDisclosureState(autoExpand);
    updateSearchCount(allFaculties);
  }

  function refreshMemberTable() {
    const tbody = contentArea.querySelector('.org-members-table tbody');
    if (!tbody) return;
    tbody.innerHTML = renderMemberRows(allMembers);
    bindMemberEvents(currentOrgId);
  }

  function updateOrgStats() {
    if (statFacCount) statFacCount.textContent = allFaculties.length;
    if (statDeptCount) statDeptCount.textContent = allFaculties.reduce((count, faculty) => count + (faculty.departments || []).length, 0);
    if (statMemCount) statMemCount.textContent = allMembers.length;
  }

  function bindMemberEvents(orgId) {
    contentArea.querySelectorAll('[data-member-role]').forEach((select) => {
      select.addEventListener('change', async () => {
        const oldRole = select.dataset.previousRole || select.querySelector('option[selected]')?.value || select.value;
        const nextRole = select.value;
        select.disabled = true;
        try {
          await api.updateOrgMember(orgId, Number(select.dataset.memberRole), nextRole);
          allMembers = allMembers.map((member) => Number(member.user_id) === Number(select.dataset.memberRole) ? { ...member, role: nextRole } : member);
          if (Number(select.dataset.memberRole) === Number(user?.id)) {
            currentOrgRole = nextRole;
            const addFacultyButton = document.getElementById('btnNewFaculty');
            const addMemberButton = document.getElementById('btnAddMember');
            if (addFacultyButton) addFacultyButton.hidden = !canEditStructure();
            if (addMemberButton) addMemberButton.hidden = !canManageMembers();
            refreshFacultyTree();
          }
          refreshMemberTable();
          showToast(t('member_role_updated','เปลี่ยนบทบาทสมาชิกแล้ว'),'success');
        } catch (err) { select.value = oldRole; showToast(localizeOrgError(err),'error'); }
        finally { select.disabled = false; }
      });
      select.dataset.previousRole = select.value;
    });
    contentArea.querySelectorAll('[data-remove-member]').forEach((button) => button.addEventListener('click', () => {
      const member = allMembers.find((m) => Number(m.user_id) === Number(button.dataset.removeMember));
      if (!member) return;
      const ownerCount = allMembers.filter((m) => m.role === 'owner').length;
      openOrgConfirm({ title: t('remove_member_title','นำสมาชิกออกจากองค์กร'),
        message: `${t('remove_member_confirm','ยืนยันการนำสมาชิกออก')} <strong>${escapeHtml(memberDisplayName(member))}</strong> (${escapeHtml(member.email)})?${member.role === 'owner' && ownerCount <= 1 ? `<br><strong>${t('last_owner_warning','ไม่สามารถนำเจ้าของคนสุดท้ายออกได้')}</strong>` : ''}`,
        confirmText: t('remove_member','นำออก'),
        onConfirm: async () => {
          await api.removeOrgMember(orgId, Number(member.user_id));
          allMembers = allMembers.filter((item) => Number(item.user_id) !== Number(member.user_id));
          updateOrgStats(); refreshMemberTable();
          showToast(t('member_removed','นำสมาชิกออกแล้ว'),'success');
          if (Number(member.user_id) === Number(user?.id)) window.location.hash = '#/projects';
        }
      });
    }));
  }

  function memberDisplayName(member) {
    const name = (member.name || '').trim();
    if (name && name.toLowerCase() !== 'your name') return name;
    const prefix = (member.email || '').split('@')[0] || '';
    return prefix.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
  }
  function roleLabel(role) { return ({ owner: t('role_owner_th','เจ้าของ'), editor: t('role_editor_th','ผู้แก้ไข'), viewer: t('role_viewer_th','ผู้ดู') })[role] || role; }
  function localizeOrgError(error) {
    const message = error?.message || '';
    if (error?.status === 403) return t('permission_denied','ท่านไม่มีสิทธิ์ดำเนินการนี้');
    if (error?.status === 409) return message.toLowerCase().includes('owner') ? t('last_owner_warning','องค์กรต้องมีเจ้าของอย่างน้อยหนึ่งคน') : t('org_conflict','ไม่สามารถดำเนินการได้ เนื่องจากยังมีข้อมูลที่เกี่ยวข้อง');
    if (error?.status === 422) return t('org_validation_error','ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    return message || t('org_operation_failed','ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
  function highlightText(value) {
    const safe = escapeHtml(value || '');
    if (!searchQuery) return safe;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return safe.replace(new RegExp(`(${escaped})`, 'ig'), '<mark class="org-search-highlight">$1</mark>'); }
    catch (_) { return safe; }
  }

  function getFilteredFaculties(faculties) {
    const q = searchQuery.toLocaleLowerCase();
    if (!q) return faculties;
    return faculties.map((faculty) => {
      const facultyMatches = [faculty.name, faculty.description].some((v) => (v || '').toLocaleLowerCase().includes(q));
      const matchingDepartments = (faculty.departments || []).filter((dept) => [dept.name, dept.description].some((v) => (v || '').toLocaleLowerCase().includes(q)));
      return facultyMatches ? faculty : (matchingDepartments.length ? { ...faculty, departments: matchingDepartments, _totalDepartmentCount: (faculty.departments || []).length } : null);
    }).filter(Boolean);
  }
  function updateSearchCount(all, filtered = getFilteredFaculties(all)) {
    const count = document.getElementById('facultySearchCount');
    if (!count) return;
    const q = searchQuery.toLocaleLowerCase();
    const total = all.reduce((n, faculty) => {
      const facultyMatch = [faculty.name, faculty.description].some((v) => (v || '').toLocaleLowerCase().includes(q));
      const departmentMatches = (faculty.departments || []).filter((dept) => [dept.name, dept.description].some((v) => (v || '').toLocaleLowerCase().includes(q))).length;
      return n + (facultyMatch ? 1 : 0) + departmentMatches;
    }, 0);
    count.textContent = searchQuery ? `${total} ${t('search_results','ผลลัพธ์')}` : '';
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
