/**
 * Projects Management View
 * List, filter, sort, create, rename, archive and delete projects connected to the Backend API.
 * Professional university institutional standard, fully bilingual (Thai & English).
 * Styles: css/pages/projects.css (+ ui-kit.css for the shared pieces).
 */

import { api } from '../api.js';
import { loadProject, getState } from '../store.js';
import { openModal, closeModal } from '../components/modal.js';
import { icons } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/html.js';
import { t, getLanguage } from '../i18n.js';
import { reqTag, optTag } from '../utils/fieldTags.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';
import { formatCurrency } from '../utils/format.js';

const PAGE_SIZE = 10;
const STATUS_ORDER = { draft: 0, ready: 1, archived: 2 };
const STATUS_FILTERS = ['all', 'draft', 'ready', 'archived'];

const MIN_COMPARE = 2;
const MAX_COMPARE = 4;
const SORT_STORAGE_KEY = 'sroi_projects_sort';

/**
 * Everything the list can be sorted by.
 * kind decides the wording of the direction button (newest/oldest, A→Z, highest/lowest) and the default direction.
 */
const SORT_OPTIONS = [
  { key: 'updated', kind: 'date', labelKey: 'sort_updated', fallback: 'Last updated' },
  { key: 'created', kind: 'date', labelKey: 'sort_created', fallback: 'Date created' },
  { key: 'calculated', kind: 'date', labelKey: 'sort_calculated', fallback: 'Last calculated' },
  { key: 'name', kind: 'text', labelKey: 'sort_name', fallback: 'Plan name' },
  { key: 'owner', kind: 'text', labelKey: 'sort_owner', fallback: 'Direct owner' },
  { key: 'sroi', kind: 'number', labelKey: 'sort_sroi', fallback: 'SROI ratio' },
  { key: 'investment', kind: 'number', labelKey: 'sort_investment', fallback: 'Total investment' },
  { key: 'benefit', kind: 'number', labelKey: 'sort_benefit', fallback: 'Present value of benefits' },
  { key: 'npv', kind: 'number', labelKey: 'sort_npv', fallback: 'Net social value' },
  { key: 'period', kind: 'number', labelKey: 'sort_period', fallback: 'Analysis period' },
  { key: 'type', kind: 'text', labelKey: 'sort_type', fallback: 'Evaluation type' },
  { key: 'status', kind: 'text', labelKey: 'sort_status', fallback: 'Status' },
];
const SORT_META = Object.fromEntries(SORT_OPTIONS.map((o) => [o.key, o]));
const defaultDir = (key) => (SORT_META[key]?.kind === 'text' ? 'asc' : 'desc');

function loadSavedSort() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) || 'null');
    if (saved && SORT_META[saved.key] && (saved.dir === 'asc' || saved.dir === 'desc')) return saved;
  } catch (e) {
    /* storage unavailable or corrupt: fall back to the default */
  }
  return { key: 'updated', dir: 'desc' };
}

function saveSort(key, dir) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key, dir }));
  } catch (e) {
    /* not critical */
  }
}

const periodYears = (p) => (p.assessment_months ? p.assessment_months / 12 : Number(p.analysis_period_years) || 5);
const runValue = (p, field) => {
  const v = p.latest_run?.[field];
  return v === null || v === undefined ? null : Number(v);
};
const timeOf = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// API status value -> pill class + translated label
const STATUS_PILL = {
  draft: { cls: 'status--draft', key: 'project_status_draft', fallback: 'Draft' },
  ready: { cls: 'status--ok', key: 'project_status_ready', fallback: 'Ready' },
  archived: { cls: 'status--neutral', key: 'project_status_archived', fallback: 'Archived' },
};

const statusLabel = (status) => {
  const s = STATUS_PILL[status];
  return s ? t(s.key, s.fallback) : escapeHtml(status || '-');
};

const statusPill = (status) => {
  const s = STATUS_PILL[status];
  return `<span class="status ${s ? s.cls : 'status--neutral'}">${statusLabel(status)}</span>`;
};

/** label text + the shared "Required" tag (any "*" already inside the translation is stripped). */
const cleanLabel = (key, fallback) => escapeHtml(String(t(key, fallback)).replace(/\s*\*+\s*$/, ''));
const reqLabel = (key, fallback) => `${cleanLabel(key, fallback)} ${reqTag()}`;
/** label text + the shared "Optional" tag. */
const optLabel = (key, fallback) => `${cleanLabel(key, fallback)} ${optTag()}`;

/** "3 days ago" in the active language; '' when the date is missing. */
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const lang = getLanguage() === 'th' ? 'th' : 'en';
  // Use numeric: 'always' for Thai to display numeric output like "2 วันที่แล้ว" instead of "เมื่อวานซืน"
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: lang === 'th' ? 'always' : 'auto' });
  const sec = Math.round((then - Date.now()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(sec) >= size) return rtf.format(Math.round(sec / size), unit);
  }
  return rtf.format(0, 'second');
}

/** Exact local date and time, e.g. "5 Nov 2026, 13:52" ('' when missing). Timestamps are stored in UTC. */
function formatDateTime(iso) {
  const ms = timeOf(iso);
  if (ms === null) return '';
  return new Date(ms).toLocaleString(getLanguage() === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A length of time in the two largest useful units, e.g. "3 d 4 h", "2 h 15 min", "< 1 min". */
function formatSpan(ms) {
  if (ms === null || ms === undefined || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const unit = { d: t('unit_d', 'd'), h: t('unit_h', 'h'), m: t('unit_min', 'min') };
  if (d > 0) return h > 0 ? `${d} ${unit.d} ${h} ${unit.h}` : `${d} ${unit.d}`;
  if (h > 0) return m > 0 ? `${h} ${unit.h} ${m} ${unit.m}` : `${h} ${unit.h}`;
  if (m > 0) return `${m} ${unit.m}`;
  return `< 1 ${unit.m}`;
}

/** Money in the plan's own currency; falls back to a plain number if the currency code is unusable. */
function money(value, currency) {
  if (value === null || value === undefined) return '–';
  try {
    return formatCurrency(value, currency || 'THB');
  } catch (e) {
    return `${Number(value).toLocaleString()} ${currency || ''}`.trim();
  }
}

/** Dates cell: exact date/time on the first line, relative age (and an optional note) below it. */
function dateCell(iso, note = '') {
  const exact = formatDateTime(iso);
  if (!exact) return '<span class="muted-sm">–</span>';
  const ago = timeAgo(iso);
  return `<div class="date-cell" title="${escapeHtml(exact)}">
    <time datetime="${escapeHtml(iso)}">${escapeHtml(exact)}</time>
    <span class="muted-sm">${escapeHtml(ago)}${note ? ` · ${escapeHtml(note)}` : ''}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Row "..." menu
// ---------------------------------------------------------------------------

let closeActiveMenu = null;

/**
 * Small popup menu for a "..." button. Added to <body> so the table's scroll area cannot clip it.
 * items: [{ label, onSelect, danger?, separatorBefore? }]
 */
function openRowMenu(anchor, items) {
  const sameButton = closeActiveMenu && closeActiveMenu.anchor === anchor;
  closeActiveMenu?.();
  if (sameButton) return; // a second click on the same button just closes the menu

  const menu = document.createElement('div');
  menu.className = 'row-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = items
    .map(
      (it, i) =>
        `${it.separatorBefore ? '<div class="row-menu__sep" role="separator"></div>' : ''}` +
        `<button type="button" role="menuitem" class="row-menu__item${it.danger ? ' row-menu__item--danger' : ''}" data-i="${i}">${escapeHtml(it.label)}</button>`,
    )
    .join('');
  document.body.appendChild(menu);

  // Right-align under the button; flip above it when there is no room below
  const rect = anchor.getBoundingClientRect();
  const below = rect.bottom + 4;
  const fitsBelow = below + menu.offsetHeight <= window.innerHeight;
  menu.style.top = `${fitsBelow ? below : Math.max(4, rect.top - menu.offsetHeight - 4)}px`;
  menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;

  const buttons = [...menu.querySelectorAll('.row-menu__item')];

  const onDocClick = (e) => {
    if (!menu.contains(e.target) && !anchor.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      anchor.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const cur = buttons.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (cur + 1) % buttons.length : (cur - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
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
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      close();
      items[Number(btn.dataset.i)].onSelect();
    }),
  );
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
  buttons[0]?.focus();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
            <label class="field-label field-label--left" for="searchProjectName">${t('search', 'Search')}</label>
            <input
              type="search"
              id="searchProjectName"
              class="input"
              placeholder="${t('search_projects_placeholder', 'Search plans by title or objectives...')}"
            />
          </div>

          <div class="field projects-filter-select">
            <label class="field-label field-label--left" for="filterFaculty">${t('filter_faculty', 'Faculty Filter')}</label>
            <select id="filterFaculty" class="input">
              <option value="">${t('all_faculties', 'All Faculties & General')}</option>
            </select>
          </div>

          <div class="field projects-filter-select">
            <label class="field-label field-label--left" for="filterDept">${t('filter_dept', 'Department Filter')}</label>
            <select id="filterDept" class="input" disabled title="${t('filter_dept_pick_faculty', 'Choose a faculty first')}">
              <option value="">${t('filter_dept_pick_faculty', 'Choose a faculty first')}</option>
            </select>
          </div>
        </div>

        <div class="projects-toolbar">
          <div class="chip-group" role="group" aria-label="${t('status_filter_label', 'Filter by status')}" id="statusChips">
            ${STATUS_FILTERS.map(
              (s) =>
                `<button type="button" class="chip" data-status="${s}" aria-pressed="${s === 'all'}">${
                  s === 'all' ? t('projects_status_all', 'All') : statusLabel(s)
                } <span class="chip__count" data-count="${s}">0</span></button>`,
            ).join('')}
          </div>

          <div class="sort-control">
            <label class="sort-control__label" for="sortSelect">${t('sort_by', 'Sort by')}</label>
            <select id="sortSelect" class="input sort-control__select">
              ${SORT_OPTIONS.map((o) => `<option value="${o.key}">${escapeHtml(t(o.labelKey, o.fallback))}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm sort-control__dir" id="sortDirBtn"></button>
          </div>
        </div>
      </section>

      <div id="projectsTableContainer" class="stack-md" aria-live="polite" aria-busy="true">
        ${skeletonHtml()}
      </div>

      <div id="compareBar" class="compare-bar" role="region" aria-label="${t('compare_title', 'Compare plans')}" hidden></div>
    </div>
  `;

  const container = document.getElementById('projectsTableContainer');
  const searchInput = document.getElementById('searchProjectName');
  const filterFaculty = document.getElementById('filterFaculty');
  const filterDept = document.getElementById('filterDept');
  const chipsEl = document.getElementById('statusChips');
  const sortSelect = document.getElementById('sortSelect');
  const sortDirBtn = document.getElementById('sortDirBtn');
  const compareBar = document.getElementById('compareBar');

  let faculties = [];
  let nuOrgId = 1;
  let allProjects = [];
  const saved = loadSavedSort();
  const view = { status: 'all', sortKey: saved.key, sortDir: saved.dir, page: 1 };
  /** Plans ticked for comparison. Kept across paging, searching and filtering. */
  const selected = new Set();

  // ----- Organization / faculty metadata ------------------------------------
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

  try {
    const orgRes = await api.getOrganizations();
    const organizations = orgRes.data || [];
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

  async function loadDeptsForFaculty(facId) {
    if (!facId) {
      resetDeptFilter();
      return;
    }
    try {
      const res = await api.getFacultyDepartments(facId);
      const departments = res.data || [];
      filterDept.innerHTML =
        `<option value="">${t('all_departments', 'All Departments')}</option>` +
        departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      filterDept.disabled = false;
    } catch (e) {
      resetDeptFilter();
    }
  }

  // ----- Filtering, sorting, paging -----------------------------------------
  const searchMatches = (p, q) =>
    !q ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.description && p.description.toLowerCase().includes(q)) ||
    (p.category && p.category.toLowerCase().includes(q)) ||
    (p.owner_name && p.owner_name.toLowerCase().includes(q));

  const sortValue = {
    name: (p) => (p.name || '').toLowerCase(),
    owner: (p) => (p.owner_name || '').toLowerCase() || null,
    sroi: (p) => runValue(p, 'sroi_ratio'),
    investment: (p) => runValue(p, 'investment'),
    benefit: (p) => runValue(p, 'present_value'),
    npv: (p) => runValue(p, 'net_social_value'),
    period: (p) => periodYears(p),
    type: (p) => p.evaluation_type || null,
    status: (p) => STATUS_ORDER[p.status] ?? 9,
    updated: (p) => timeOf(p.updated_at),
    created: (p) => timeOf(p.created_at),
    calculated: (p) => timeOf(p.latest_run?.created_at),
  };

  /** Sorts by the chosen key; plans without a value sink to the bottom in either direction, ties fall back to newest first. */
  function sortProjects(list) {
    const get = sortValue[view.sortKey] || sortValue.updated;
    const dir = view.sortDir === 'asc' ? 1 : -1;
    const tiebreak = (a, b) => (timeOf(b.created_at) ?? 0) - (timeOf(a.created_at) ?? 0) || b.id - a.id;
    return [...list].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null && vb === null) return tiebreak(a, b);
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb, getLanguage()) : va - vb;
      return cmp * dir || tiebreak(a, b);
    });
  }

  /** Wording of the direction button depends on what is being sorted. */
  function directionLabel() {
    const kind = SORT_META[view.sortKey]?.kind;
    const asc = view.sortDir === 'asc';
    if (kind === 'date') return asc ? t('sort_oldest', 'Oldest first') : t('sort_newest', 'Newest first');
    if (kind === 'text') return asc ? t('sort_az', 'A → Z') : t('sort_za', 'Z → A');
    return asc ? t('sort_lowest', 'Lowest first') : t('sort_highest', 'Highest first');
  }

  function syncSortControls() {
    sortSelect.value = view.sortKey;
    sortDirBtn.textContent = `${view.sortDir === 'asc' ? '↑' : '↓'} ${directionLabel()}`;
    sortDirBtn.setAttribute('aria-label', `${t('sort_direction', 'Sort direction')}: ${directionLabel()}`);
  }

  function applySort(key, dir) {
    view.sortKey = key;
    view.sortDir = dir;
    view.page = 1;
    saveSort(key, dir);
    syncSortControls();
    filterAndRenderProjects();
  }

  function updateChips(searchFiltered) {
    const counts = { all: searchFiltered.length, draft: 0, ready: 0, archived: 0 };
    searchFiltered.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status] += 1;
    });
    chipsEl.querySelectorAll('.chip').forEach((chip) => {
      const s = chip.dataset.status;
      chip.setAttribute('aria-pressed', String(view.status === s));
      chip.querySelector('.chip__count').textContent = counts[s];
    });
  }

  function filterAndRenderProjects() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const searchFiltered = allProjects.filter((p) => searchMatches(p, q));
    updateChips(searchFiltered);
    const byStatus =
      view.status === 'all' ? searchFiltered : searchFiltered.filter((p) => p.status === view.status);
    renderTable(sortProjects(byStatus));
    updateCompareBar();
  }

  // ----- Comparison bar -------------------------------------------------------
  function updateCompareBar() {
    const n = selected.size;
    compareBar.hidden = n === 0;
    if (n === 0) return;
    const hint =
      n < MIN_COMPARE
        ? t('compare_pick_more', 'Pick at least {min} plans to compare').replace('{min}', MIN_COMPARE)
        : n >= MAX_COMPARE
          ? t('compare_max_hint', 'You can compare up to {n} plans').replace('{n}', MAX_COMPARE)
          : '';
    compareBar.innerHTML = `
      <span class="compare-bar__count">${escapeHtml(t('compare_selected', '{n} selected').replace('{n}', n))}</span>
      ${hint ? `<span class="muted-sm compare-bar__hint">${escapeHtml(hint)}</span>` : ''}
      <span class="compare-bar__spacer"></span>
      <button type="button" class="btn btn-secondary btn-sm" id="btnClearCompare">${t('compare_clear', 'Clear')}</button>
      <button type="button" class="btn btn-primary btn-sm" id="btnRunCompare" ${n < MIN_COMPARE ? 'disabled' : ''}>${t('compare_run', 'Compare')}</button>`;
    document.getElementById('btnClearCompare').addEventListener('click', () => {
      selected.clear();
      filterAndRenderProjects();
    });
    document.getElementById('btnRunCompare').addEventListener('click', () => {
      const picked = allProjects.filter((p) => selected.has(p.id));
      if (picked.length >= MIN_COMPARE) openCompareModal(picked);
    });
  }

  const hasActiveFilters = () =>
    Boolean((searchInput?.value || '').trim() || filterFaculty.value || filterDept.value || view.status !== 'all');

  function clearFilters() {
    searchInput.value = '';
    filterFaculty.value = '';
    view.status = 'all';
    view.page = 1;
    resetDeptFilter();
    loadList();
  }

  const loadList = async ({ quiet = false } = {}) => {
    if (!quiet && allProjects.length === 0) container.innerHTML = skeletonHtml();
    container.setAttribute('aria-busy', 'true');
    try {
      const filters = {};
      if (nuOrgId) filters.organization_id = nuOrgId;
      if (filterFaculty.value && !filterDept.value) filters.faculty_id = filterFaculty.value;
      if (filterDept.value) filters.department_id = filterDept.value;

      const res = await api.getProjects(filters);
      allProjects = res?.data || [];
      // Plans that were deleted (or are no longer visible) can't stay selected for comparison
      const known = new Set(allProjects.map((p) => p.id));
      selected.forEach((id) => !known.has(id) && selected.delete(id));
      filterAndRenderProjects();
    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-danger projects-error" role="alert">
          <span>${escapeHtml(err.message)}</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btnRetryProjects">${t('retry', 'Retry')}</button>
        </div>`;
      document.getElementById('btnRetryProjects')?.addEventListener('click', () => loadList());
    } finally {
      container.setAttribute('aria-busy', 'false');
    }
  };

  // ----- Rendering ------------------------------------------------------------
  function ownerCell(p) {
    const level = p.owner_level || (p.department_id ? 'department' : p.faculty_id ? 'faculty' : 'organization');
    // The API sends the owner's name; fall back to the faculty list we already hold
    const facName = p.faculty_name || faculties.find((f) => f.id === p.faculty_id)?.name || '';
    if (level === 'department') {
      const name = p.department_name || p.owner_name || `#${p.department_id}`;
      return `<div class="owner">
        <div class="owner__main"><span class="owner__tag">${t('owner_tag_dept', 'Dept')}</span><span class="owner__name">${escapeHtml(name)}</span></div>
        ${facName ? `<div class="muted-sm">${escapeHtml(facName)}</div>` : ''}
      </div>`;
    }
    if (level === 'faculty') {
      const name = p.faculty_name || p.owner_name || facName || `#${p.faculty_id}`;
      return `<div class="owner"><div class="owner__main"><span class="owner__tag">${t('owner_tag_faculty', 'Faculty')}</span><span class="owner__name">${escapeHtml(name)}</span></div></div>`;
    }
    return `<div class="owner"><div class="owner__main"><span class="owner__tag">${t('owner_tag_univ', 'University')}</span><span class="owner__name">${t('owner_general', 'University-wide')}</span></div></div>`;
  }

  function sortableTh(key, label, extraClass = '') {
    const active = view.sortKey === key;
    const aria = active ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th class="${extraClass}" aria-sort="${aria}">
      <button type="button" class="th-sort" data-sort="${key}" title="${t('sort_by_col', 'Sort by this column')}">${label}</button>
    </th>`;
  }

  function rowHtml(p) {
    const typeLabel =
      p.evaluation_type === 'forecast'
        ? t('eval_type_forecast_short', 'Forecast')
        : t('eval_type_evaluative_short', 'Evaluative');
    const periodLabel = p.assessment_months
      ? `${p.assessment_months} ${t('months', 'Months')}`
      : `${p.analysis_period_years || 5} ${t('years', 'Years')}`;

    const hasSroi = p.latest_run && p.latest_run.sroi_ratio !== null && p.latest_run.sroi_ratio !== undefined;
    const sroiHtml = hasSroi
      ? `<span class="sroi-value">${Number(p.latest_run.sroi_ratio).toFixed(2)} : 1</span>`
      : `<span class="sroi-empty">${t('sroi_not_calculated', 'Not calculated')}</span>`;

    const ago = timeAgo(p.updated_at);
    const label = t('more_actions', 'More actions');

    // Second line under the SROI ratio shows the money figure the list is currently sorted by
    const metric = { investment: 'investment', benefit: 'present_value', npv: 'net_social_value' }[view.sortKey];
    const metricHtml =
      metric && hasSroi
        ? `<div class="muted-sm sroi-metric">${escapeHtml(t(SORT_META[view.sortKey].labelKey, ''))}: ${escapeHtml(money(runValue(p, metric), p.currency))}</div>`
        : '';

    // How long it took from creating the plan to its latest calculation
    const createdMs = timeOf(p.created_at);
    const calcMs = timeOf(p.latest_run?.created_at);
    const took = createdMs !== null && calcMs !== null ? formatSpan(calcMs - createdMs) : '';

    const checked = selected.has(p.id);
    const full = !checked && selected.size >= MAX_COMPARE;

    return `
      <tr data-project-id="${p.id}"${checked ? ' class="is-selected"' : ''}>
        <td class="strong cell-name">
          <div class="plan-name__row">
            <input
              type="checkbox"
              class="compare-check"
              data-compare="${p.id}"
              ${checked ? 'checked' : ''}
              ${full ? 'disabled' : ''}
              aria-label="${escapeHtml(t('compare_select', 'Select to compare'))}: ${escapeHtml(p.name)}"
              title="${escapeHtml(full ? t('compare_max_hint', 'You can compare up to {n} plans').replace('{n}', MAX_COMPARE) : t('compare_select', 'Select to compare'))}"
            />
            <button type="button" class="plan-name" data-open-project="${p.id}">${escapeHtml(p.name)}</button>
            ${p.calc_method === 'sheet' ? `<span class="badge badge-integrated">${t('sheet_badge', 'Sheet')}</span>` : ''}
          </div>
          ${p.category ? `<div class="muted-sm">${escapeHtml(p.category)}</div>` : ''}
        </td>
        <td class="cell-owner" data-label="${t('col_owner', 'Direct Owner')}">${ownerCell(p)}</td>
        <td data-label="${t('col_type_period', 'Type & period')}">${typeLabel} · ${periodLabel}</td>
        <td class="num" data-label="${t('col_sroi_ratio', 'SROI Ratio')}">${sroiHtml}${metricHtml}</td>
        <td data-label="${t('col_status', 'Status')}">${statusPill(p.status)}</td>
        <td data-label="${t('col_created', 'Created')}">${dateCell(p.created_at)}</td>
        <td data-label="${t('col_calculated', 'Last calculated')}">${dateCell(p.latest_run?.created_at, took ? t('took_after', '{span} after creation').replace('{span}', took) : '')}</td>
        <td data-label="${t('col_updated', 'Updated')}">${ago ? `<span class="muted-sm" title="${escapeHtml(formatDateTime(p.updated_at))}">${escapeHtml(ago)}</span>` : '<span class="muted-sm">–</span>'}</td>
        <td class="cell-actions">
          <div class="row-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-open-project="${p.id}">${t('open', 'Open')}</button>
            <button
              type="button"
              class="btn-icon btn-icon--lg"
              data-row-menu="${p.id}"
              aria-haspopup="menu"
              aria-expanded="false"
              aria-label="${label}: ${escapeHtml(p.name)}"
              title="${label}"
            >${icons.more}</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(projects) {
    if (projects.length === 0) {
      if (allProjects.length === 0 && !hasActiveFilters()) {
        // Nothing exists yet -> invite to create one and explain the three steps
        container.innerHTML = `
          <div class="empty-state">
            <h2 class="empty-state__title">${t('empty_projects_title', 'No plans yet')}</h2>
            <p class="empty-state__text">${t('create_first_plan', 'Begin by creating the first SROI plan for your unit.')}</p>
            <ol class="empty-steps">
              ${[1, 2, 3]
                .map(
                  (n) =>
                    `<li><strong>${t(`empty_step_${n}_title`)}</strong>${t(`empty_step_${n}_text`)}</li>`,
                )
                .join('')}
            </ol>
            <div class="empty-state__actions">
              <button class="btn btn-primary" id="btnCreateFirstProject">${icons.plus} ${t('btn_new_plan', 'New SROI Plan')}</button>
            </div>
          </div>`;
        document.getElementById('btnCreateFirstProject')?.addEventListener('click', triggerCreateModal);
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <p class="empty-state__text">${t('no_projects_found', 'No projects found matching the search or filter criteria.')}</p>
            <div class="empty-state__actions">
              <button class="btn btn-secondary" id="btnClearFilters">${t('clear_filters', 'Clear filters')}</button>
            </div>
          </div>`;
        document.getElementById('btnClearFilters')?.addEventListener('click', clearFilters);
      }
      return;
    }

    const pages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
    view.page = Math.min(view.page, pages);
    const pageItems = projects.slice((view.page - 1) * PAGE_SIZE, view.page * PAGE_SIZE);
    const countText = t('showing_count', 'Showing {shown} of {total} plans')
      .replace('{shown}', pageItems.length)
      .replace('{total}', projects.length);

    container.innerHTML = `
      <section class="panel">
        <div class="table-wrap">
          <table class="table projects-table">
            <thead>
              <tr>
                ${sortableTh('name', t('col_project_name', 'Plan Name'))}
                ${sortableTh('owner', t('col_owner', 'Direct Owner'))}
                <th>${t('col_type_period', 'Type & period')}</th>
                ${sortableTh('sroi', t('col_sroi_ratio', 'SROI Ratio'), 'num')}
                ${sortableTh('status', t('col_status', 'Status'))}
                ${sortableTh('created', t('col_created', 'Created'))}
                ${sortableTh('calculated', t('col_calculated', 'Last calculated'))}
                ${sortableTh('updated', t('col_updated', 'Updated'))}
                <th class="col-actions"><span class="sr-only">${t('col_actions', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>${pageItems.map(rowHtml).join('')}</tbody>
          </table>
        </div>
        <div class="projects-footer">
          <span class="muted-sm">${countText}</span>
          ${
            pages > 1
              ? `<nav class="pager" aria-label="Pagination">
                  <button type="button" class="btn btn-secondary btn-sm" data-page="${view.page - 1}" ${view.page === 1 ? 'disabled' : ''}>${t('page_prev', 'Previous')}</button>
                  <span class="muted-sm">${t('page_of', 'Page {page} of {pages}').replace('{page}', view.page).replace('{pages}', pages)}</span>
                  <button type="button" class="btn btn-secondary btn-sm" data-page="${view.page + 1}" ${view.page === pages ? 'disabled' : ''}>${t('page_next', 'Next')}</button>
                </nav>`
              : ''
          }
        </div>
      </section>
    `;

    bindTable(projects);
  }

  async function openProject(id) {
    await loadProject(id);
    // Sheet-mode projects have their own single-page view; routing to
    // '#/wizard' (without a step suffix) triggers renderCalculator which
    // immediately hands off to renderSheet().  Wizard projects start at
    // step-1 as before.
    const proj = getState().project;
    window.location.hash = proj?.calc_method === 'sheet' ? '#/wizard' : '#/wizard/step-1';
  }

  async function patchProject(p, data, okKey, okFallback) {
    try {
      await api.updateProject(p.id, data);
      showToast(t(okKey, okFallback), 'success');
      await loadList({ quiet: true });
    } catch (err) {
      showToast(`${t('update_failed', 'Could not update the plan')}: ${err.message}`, 'error');
    }
  }

  async function deleteWithUndo(p) {
    try {
      await api.deleteProject(p.id);
    } catch (err) {
      showToast(`${t('delete_failed', 'Failed to delete plan')}: ${err.message}`, 'error');
      return;
    }
    await loadList({ quiet: true });
    // Deletion is a soft delete on the server, so we can offer a real undo instead of a confirm dialog
    showToast(t('toast_deleted', 'Plan deleted'), 'info', {
      duration: 8000,
      action: {
        label: t('undo', 'Undo'),
        onClick: async () => {
          try {
            await api.restoreProject(p.id);
            showToast(t('toast_restored', 'Plan restored'), 'success');
            loadList({ quiet: true });
          } catch (err) {
            showToast(err.message, 'error');
          }
        },
      },
    });
  }

  function openRenameModal(p) {
    openModal({
      title: t('rename_title', 'Rename plan'),
      body: `
        <div class="field">
          <label class="field-label" for="renameInput">${reqLabel('field_plan_name', 'Plan / Project Name')}</label>
          <input type="text" id="renameInput" class="input" value="${escapeHtml(p.name)}" maxlength="200" />
          <div id="renameError" class="field-error" hidden></div>
        </div>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button type="button" class="btn btn-primary" id="btnRenameSave">${t('save', 'Save')}</button>`,
    });
    const input = document.getElementById('renameInput');
    input.focus();
    input.select();
    const save = async () => {
      const name = input.value.trim();
      if (!name) {
        const err = document.getElementById('renameError');
        err.textContent = t('required_plan_name', 'Please enter a plan name.');
        err.hidden = false;
        return;
      }
      if (name === p.name) return closeModal();
      closeModal();
      await patchProject(p, { name }, 'toast_renamed', 'Plan renamed');
    };
    document.getElementById('btnRenameSave').addEventListener('click', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
  }

  function bindTable(sortedProjects) {
    container.querySelectorAll('[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        // Same column again flips the direction; a new column starts in its natural direction
        applySort(key, view.sortKey === key ? (view.sortDir === 'asc' ? 'desc' : 'asc') : defaultDir(key));
        container.querySelector(`[data-sort="${key}"]`)?.focus();
      });
    });

    container.querySelectorAll('[data-compare]').forEach((box) => {
      box.addEventListener('change', () => {
        const id = Number(box.dataset.compare);
        if (box.checked) {
          if (selected.size >= MAX_COMPARE) {
            box.checked = false;
            return;
          }
          selected.add(id);
        } else {
          selected.delete(id);
        }
        box.closest('tr')?.classList.toggle('is-selected', box.checked);
        // At the limit the other boxes lock; below it they unlock again
        container.querySelectorAll('[data-compare]').forEach((other) => {
          other.disabled = !other.checked && selected.size >= MAX_COMPARE;
        });
        updateCompareBar();
      });
    });

    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        view.page = Number(btn.dataset.page);
        renderTable(sortedProjects);
        container.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    container.querySelectorAll('[data-open-project]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProject(Number(btn.dataset.openProject));
      });
    });

    // The whole row opens the plan; buttons and the menu keep their own behaviour
    container.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, .row-actions')) return;
        openProject(Number(tr.dataset.projectId));
      });
    });

    container.querySelectorAll('[data-row-menu]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = allProjects.find((x) => x.id === Number(btn.dataset.rowMenu));
        if (!p) return;
        const items = [
          { label: t('action_rename', 'Rename'), onSelect: () => openRenameModal(p) },
          // Calculating a plan does not change its status; it is set here (draft <-> ready)
          p.status === 'draft'
            ? {
                label: t('action_mark_ready', 'Mark as ready'),
                onSelect: () => patchProject(p, { status: 'ready' }, 'toast_marked_ready', 'Plan marked as ready'),
              }
            : p.status === 'ready'
              ? {
                  label: t('action_unarchive', 'Move back to draft'),
                  onSelect: () => patchProject(p, { status: 'draft' }, 'toast_unarchived', 'Plan moved back to draft'),
                }
              : null,
          p.status === 'archived'
            ? {
                label: t('action_unarchive', 'Move back to draft'),
                onSelect: () => patchProject(p, { status: 'draft' }, 'toast_unarchived', 'Plan moved back to draft'),
              }
            : {
                label: t('action_archive', 'Archive'),
                onSelect: () => patchProject(p, { status: 'archived' }, 'toast_archived', 'Plan archived'),
              },
          {
            label: t('action_delete', 'Delete plan'),
            danger: true,
            separatorBefore: true,
            onSelect: () => deleteWithUndo(p),
          },
        ];
        openRowMenu(btn, items.filter(Boolean));
      });
    });
  }

  // ----- Controls -----------------------------------------------------------------
  filterFaculty.addEventListener('change', async (e) => {
    const facId = e.target.value ? Number(e.target.value) : null;
    view.page = 1;
    await loadDeptsForFaculty(facId);
    loadList({ quiet: true });
  });

  filterDept.addEventListener('change', () => {
    view.page = 1;
    loadList({ quiet: true });
  });

  sortSelect.addEventListener('change', () => applySort(sortSelect.value, defaultDir(sortSelect.value)));
  sortDirBtn.addEventListener('click', () => applySort(view.sortKey, view.sortDir === 'asc' ? 'desc' : 'asc'));
  syncSortControls();

  searchInput?.addEventListener('input', () => {
    view.page = 1;
    filterAndRenderProjects();
  });

  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    view.status = chip.dataset.status;
    view.page = 1;
    filterAndRenderProjects();
  });

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

// ---------------------------------------------------------------------------
// Side-by-side comparison of 2–4 plans
// ---------------------------------------------------------------------------

function ownerText(p) {
  const level = p.owner_level || (p.department_id ? 'department' : p.faculty_id ? 'faculty' : 'organization');
  if (level === 'department') return `${t('owner_tag_dept', 'Dept')}: ${p.department_name || p.owner_name || '–'}`;
  if (level === 'faculty') return `${t('owner_tag_faculty', 'Faculty')}: ${p.faculty_name || p.owner_name || '–'}`;
  return `${t('owner_tag_univ', 'University')}: ${t('owner_general', 'University-wide')}`;
}

function openCompareModal(plans) {
  // Oldest plan first, so the timeline reads left to right
  const cols = [...plans].sort((a, b) => (timeOf(a.created_at) ?? 0) - (timeOf(b.created_at) ?? 0) || a.id - b.id);
  const firstCreated = timeOf(cols[0].created_at);
  const sameCurrency = new Set(cols.map((p) => p.currency)).size === 1;

  /**
   * One row. values: raw numbers (for highlighting) or null; cell(p, i) renders each column.
   * best: 'max' | 'min' | null — which value gets the highlight. Skipped when every column is equal.
   */
  const row = (label, cell, { values = null, best = null, hint = '' } = {}) => {
    let winners = new Set();
    if (values && best) {
      const present = values.filter((v) => v !== null);
      if (present.length >= 2) {
        const target = best === 'max' ? Math.max(...present) : Math.min(...present);
        if (present.some((v) => v !== target)) winners = new Set(values.map((v, i) => (v === target ? i : -1)));
      }
    }
    return `<tr>
      <th scope="row">${escapeHtml(label)}${hint ? `<span class="compare-table__hint">${escapeHtml(hint)}</span>` : ''}</th>
      ${cols
        .map((p, i) => {
          const win = winners.has(i);
          return `<td class="${win ? 'is-best' : ''}">${cell(p, i)}${win ? `<span class="sr-only"> (${escapeHtml(best === 'max' ? t('compare_highest', 'highest') : t('compare_lowest', 'lowest'))})</span>` : ''}</td>`;
        })
        .join('')}
    </tr>`;
  };
  const group = (title) => `<tr class="compare-table__group"><th colspan="${cols.length + 1}" scope="colgroup">${escapeHtml(title)}</th></tr>`;
  const dash = '<span class="muted-sm">–</span>';
  const when = (iso) => {
    const exact = formatDateTime(iso);
    return exact ? `<time datetime="${escapeHtml(iso)}">${escapeHtml(exact)}</time><div class="muted-sm">${escapeHtml(timeAgo(iso))}</div>` : dash;
  };
  const noteMoney = sameCurrency ? '' : t('compare_currency_note', 'Different currencies – not highlighted');

  const sroiVals = cols.map((p) => runValue(p, 'sroi_ratio'));
  const maxSroi = Math.max(0, ...sroiVals.filter((v) => v !== null));
  const sroiCell = (p, i) => {
    const v = sroiVals[i];
    if (v === null) return `<span class="sroi-empty">${t('sroi_not_calculated', 'Not calculated')}</span>`;
    const pct = maxSroi > 0 ? Math.max(2, Math.round((Math.max(v, 0) / maxSroi) * 100)) : 0;
    return `<span class="sroi-value">${v.toFixed(2)} : 1</span><span class="cmp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>`;
  };
  const moneyRow = (label, field, opts = {}) => {
    const values = cols.map((p) => runValue(p, field));
    return row(label, (p, i) => (values[i] === null ? dash : escapeHtml(money(values[i], p.currency))), {
      values: sameCurrency ? values : null,
      hint: noteMoney,
      ...opts,
    });
  };

  const createdMs = cols.map((p) => timeOf(p.created_at));
  const calcMs = cols.map((p) => timeOf(p.latest_run?.created_at));
  const spans = cols.map((_, i) => (createdMs[i] !== null && calcMs[i] !== null ? Math.max(0, calcMs[i] - createdMs[i]) : null));

  const body = `
    <p class="muted-sm compare-note">${escapeHtml(t('compare_order_note', 'Plans are ordered from the oldest to the newest.'))}</p>
    <div class="table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <td></td>
            ${cols
              .map(
                (p) => `<th scope="col">
                  <div class="compare-table__name">${escapeHtml(p.name)}</div>
                  <div>${statusPill(p.status)}</div>
                </th>`,
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${group(t('compare_group_timeline', 'Timeline'))}
          ${row(t('col_created', 'Created'), (p) => when(p.created_at))}
          ${row(t('compare_order', 'Creation order'), (p, i) => `#${i + 1}`)}
          ${row(
            t('compare_after_first', 'Created after the first plan'),
            (p, i) => (i === 0 || createdMs[i] === null || firstCreated === null ? dash : `+ ${escapeHtml(formatSpan(createdMs[i] - firstCreated))}`),
          )}
          ${row(t('col_calculated', 'Last calculated'), (p) => when(p.latest_run?.created_at))}
          ${row(t('compare_time_to_calc', 'Creation → latest calculation'), (p, i) => (spans[i] === null ? dash : escapeHtml(formatSpan(spans[i]))), {
            values: spans,
            best: 'min',
            hint: t('compare_time_hint', 'Shortest is highlighted'),
          })}
          ${row(t('col_updated', 'Updated'), (p) => when(p.updated_at))}

          ${group(t('compare_group_setup', 'Plan setup'))}
          ${row(t('col_owner', 'Direct Owner'), (p) => escapeHtml(ownerText(p)))}
          ${row(t('sheet_mode_label', 'Assessment Method'), (p) =>
            p.calc_method === 'sheet' ? t('sheet_mode_sheet_title', 'Sheet Mode') : t('sheet_mode_wizard_title', 'Guided Assistant'),
          )}
          ${row(t('field_eval_type', 'Evaluation Type'), (p) =>
            p.evaluation_type === 'forecast' ? t('eval_type_forecast_short', 'Forecast') : t('eval_type_evaluative_short', 'Evaluative'),
          )}
          ${row(t('compare_period', 'Analysis period'), (p) =>
            p.assessment_months ? `${p.assessment_months} ${t('months', 'Months')}` : `${p.analysis_period_years || 5} ${t('years', 'Years')}`,
          )}
          ${row(t('field_currency', 'Currency'), (p) => escapeHtml(p.currency || '–'))}
          ${row(t('field_category', 'Project Category'), (p) => (p.category ? escapeHtml(p.category) : dash))}

          ${group(t('compare_group_results', 'Results'))}
          ${row(t('col_sroi_ratio', 'SROI Ratio'), sroiCell, { values: sroiVals, best: 'max', hint: t('compare_best_hint', 'Highest is highlighted') })}
          ${moneyRow(t('sort_investment', 'Total investment'), 'investment')}
          ${moneyRow(t('sort_benefit', 'Present value of benefits'), 'present_value', { best: 'max' })}
          ${moneyRow(t('sort_npv', 'Net social value'), 'net_social_value', { best: 'max' })}
        </tbody>
      </table>
    </div>`;

  openModal({
    title: t('compare_title', 'Compare plans'),
    body: `<div class="compare">${body}</div>`,
    footer: `<button type="button" class="btn btn-primary" data-modal-close>${t('close', 'Close')}</button>`,
    size: 'lg',
  });
}

function skeletonHtml() {
  const row = `<div class="skeleton-row">${'<span class="skeleton"></span>'.repeat(5)}</div>`;
  return `<section class="panel" aria-hidden="true">${row.repeat(5)}</section>`;
}

// ---------------------------------------------------------------------------
// "New SROI plan" modal (3 short steps; "Create now" skips the rest)
// ---------------------------------------------------------------------------

function openCreateProjectModal({ currentOrgId, faculties, onCreated }) {
  let currentStep = 1;
  const TOTAL_STEPS = 3;

  const yearOptions = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === 1 ? ' selected' : ''}>${n} ${n === 1 ? t('year', 'Year') : t('years', 'Years')}</option>`)
    .join('');

  const formHtml = `
    <form id="createProjectForm" class="form-stack" novalidate>
      <ol class="mini-steps" id="modalStepIndicator" aria-label="${t('modal_new_project_title', 'Create New SROI Assessment Plan')}"></ol>

      <!-- Step 1: Plan basics -->
      <div id="modalStep1" class="form-stack">
        <div class="field">
          <span class="field-label" id="methodLabel">${escapeHtml(t('sheet_mode_label', 'Assessment Method'))} ${reqTag()}</span>
          <div class="method-grid" role="radiogroup" aria-labelledby="methodLabel">
            <label class="method-card">
              <input type="radio" class="sr-only" name="calc_method" value="wizard" checked />
              <span class="method-card__body">
                <strong>${t('sheet_mode_wizard_title', 'Guided Assistant')}</strong>
                <span class="field-hint">${t('sheet_mode_wizard_desc', 'Step-by-step guidance, recommended for beginners')}</span>
              </span>
            </label>
            <label class="method-card">
              <input type="radio" class="sr-only" name="calc_method" value="sheet" />
              <span class="method-card__body">
                <strong>${t('sheet_mode_sheet_title', 'Sheet Mode')}</strong>
                <span class="field-hint">${t('sheet_mode_sheet_desc', 'Spreadsheet-style entry for existing Excel models')}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="planNameInput">${reqLabel('field_plan_name', 'Plan / Project Name')}</label>
          <input type="text" id="planNameInput" name="name" class="input" required maxlength="200" autocomplete="off" placeholder="${t('field_plan_name_placeholder', 'e.g. Community Skills Development Initiative 2025')}" />
        </div>

        <div class="field">
          <label class="field-label" for="modalOwnerTypeSelect">${reqLabel('field_owner_type', 'Who owns this plan?')}</label>
          <select id="modalOwnerTypeSelect" name="ownerType" class="input">
            <option value="faculty" selected>${t('owner_faculty_direct', 'Faculty Direct Owner')}</option>
            <option value="department">${t('owner_dept_direct', 'Department Direct Owner')}</option>
            <option value="org">${t('owner_general', 'University-wide / No Faculty')}</option>
          </select>
        </div>

        <div id="facultySelectWrap" class="field">
          <label class="field-label" for="modalFacultySelect">${reqLabel('field_faculty', 'Assigned Faculty')}</label>
          <select id="modalFacultySelect" class="input">
            ${faculties.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            ${faculties.length === 0 ? `<option value="">${t('no_faculties', 'No faculties available')}</option>` : ''}
          </select>
        </div>

        <div id="deptSelectWrap" class="field" hidden>
          <label class="field-label" for="modalDeptSelect">${reqLabel('field_department', 'Assigned Department')}</label>
          <select id="modalDeptSelect" class="input">
            <option value="">${t('select_faculty_first', 'Select a faculty first')}</option>
          </select>
        </div>
      </div>

      <!-- Step 2: Evaluation -->
      <div id="modalStep2" class="form-stack" hidden>
        <div class="field">
          <label class="field-label" for="modalEvalTypeSelect">${reqLabel('field_eval_type', 'Evaluation Type')}</label>
          <select id="modalEvalTypeSelect" name="evaluation_type" class="input">
            <option value="evaluative" selected>${t('eval_type_evaluative', 'Evaluative (Ex-post actuals)')}</option>
            <option value="forecast">${t('eval_type_forecast', 'Forecast (Ex-ante prospective)')}</option>
          </select>
          <span class="field-hint" id="evalTypeHint">${t('eval_type_evaluative_desc', 'Assess real results after project completion')}</span>
        </div>

        <div class="field">
          <label class="field-label" for="modalScopeSelect">${optLabel('field_assessment_scope', 'Assessment Period')}</label>
          <select id="modalScopeSelect" name="assessment_months" class="input">
            <option value="">${t('scope_full_year', 'Full Year (12 months / standard)')}</option>
            <option value="6">${t('scope_6_months', '6 Months (Interim)')}</option>
            <option value="9">${t('scope_9_months', '9 Months (Interim)')}</option>
            <option value="12">${t('scope_12_months', '12 Months (Fiscal Year)')}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="modalHorizonSelect">${reqLabel('field_analysis_period', 'Analysis Horizon (Years)')}</label>
          <select id="modalHorizonSelect" class="input">
            ${yearOptions}
            <option value="Other">${t('other_specify', 'Other (specify)')}</option>
          </select>
          <div id="horizonOtherWrap" class="field" hidden>
            <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="1" aria-label="${t('specify_years', 'Specify years (1–100)')}" placeholder="${t('specify_years', 'Specify years (1–100)')}" />
          </div>
        </div>
      </div>

      <!-- Step 3: Optional details -->
      <div id="modalStep3" class="form-stack" hidden>
        <div class="field">
          <label class="field-label" for="modalCategorySelect">${optLabel('field_category', 'Project Category')}</label>
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
          <div id="categoryOtherWrap" class="field" hidden>
            <input type="text" id="modalCategoryCustom" class="input" aria-label="${t('specify_category', 'Specify custom category')}" placeholder="${t('specify_category', 'Specify custom category')}" />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="modalDesc">${optLabel('field_plan_desc', 'Project Description / Objectives')}</label>
          <textarea id="modalDesc" name="description" class="input" rows="2" placeholder="${t('field_plan_desc_placeholder', 'Brief summary of plan objectives')}"></textarea>
        </div>

        <details class="disclosure">
          <summary class="disclosure__summary">${t('advanced_settings', 'Advanced Settings')}</summary>
          <div class="form-stack">
            <div class="field">
              <label class="field-label" for="modalCurrencySelect">${reqLabel('field_currency', 'Currency')}</label>
              <select id="modalCurrencySelect" class="input">
                <option value="THB" selected>${t('cur_thb', 'THB (Thai Baht)')}</option>
                <option value="USD">${t('cur_usd', 'USD (US Dollar)')}</option>
                <option value="EUR">${t('cur_eur', 'EUR (Euro)')}</option>
                <option value="Other">${t('other_specify', 'Other (specify)')}</option>
              </select>
              <div id="currencyOtherWrap" class="field" hidden>
                <input type="text" id="modalCurrencyCustom" class="input" maxlength="3" aria-label="${t('field_currency', 'Currency')}" placeholder="GBP" />
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="modalDiscountRate">${reqLabel('field_discount_rate', 'Annual Discount Rate (%)')}</label>
              <input type="number" id="modalDiscountRate" name="discount_rate" min="0" max="100" step="0.1" class="input" value="0.0" />
            </div>
          </div>
        </details>
      </div>

      <div id="newProjectModalError" class="field-error alert alert-danger" role="alert" hidden></div>
    </form>
  `;

  openModal({
    title: t('modal_new_project_title', 'Create New SROI Assessment Plan'),
    body: formHtml,
    footer: '<div id="modalFooterActions" class="modal-footer__inner" style="display:contents"></div>',
  });

  const $ = (id) => document.getElementById(id);
  const form = $('createProjectForm');
  const errBox = $('newProjectModalError');
  const facultyWrap = $('facultySelectWrap');
  const deptWrap = $('deptSelectWrap');
  const modalFacSelect = $('modalFacultySelect');
  const modalDeptSelect = $('modalDeptSelect');
  const ownerTypeSelect = $('modalOwnerTypeSelect');
  const horizonSelect = $('modalHorizonSelect');
  const horizonOtherWrap = $('horizonOtherWrap');
  const categorySelect = $('modalCategorySelect');
  const categoryOtherWrap = $('categoryOtherWrap');
  const currencySelect = $('modalCurrencySelect');
  const currencyOtherWrap = $('currencyOtherWrap');
  const stepIndicator = $('modalStepIndicator');
  const footerActions = $('modalFooterActions');

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  async function loadModalDepts(facId) {
    if (!facId) return;
    try {
      const res = await api.getFacultyDepartments(facId);
      const depts = res.data || [];
      modalDeptSelect.innerHTML =
        depts.length > 0
          ? depts.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')
          : `<option value="">${t('no_departments', 'No departments in this faculty')}</option>`;
    } catch (e) {
      modalDeptSelect.innerHTML = `<option value="">${t('failed_load_departments', 'Failed to load departments')}</option>`;
    }
  }

  modalFacSelect?.addEventListener('change', (e) => loadModalDepts(Number(e.target.value)));
  if (modalFacSelect?.value) loadModalDepts(Number(modalFacSelect.value));

  ownerTypeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    facultyWrap.hidden = val === 'org';
    deptWrap.hidden = val !== 'department';
  });

  const toggleOther = (select, wrap) =>
    select.addEventListener('change', (e) => {
      wrap.hidden = e.target.value !== 'Other';
    });
  toggleOther(horizonSelect, horizonOtherWrap);
  toggleOther(categorySelect, categoryOtherWrap);
  toggleOther(currencySelect, currencyOtherWrap);

  $('modalEvalTypeSelect').addEventListener('change', (e) => {
    $('evalTypeHint').textContent =
      e.target.value === 'forecast'
        ? t('eval_type_forecast_desc', 'Forecast prospective impact before starting')
        : t('eval_type_evaluative_desc', 'Assess real results after project completion');
  });

  function updateStepUI() {
    errBox.hidden = true;
    [1, 2, 3].forEach((n) => {
      $(`modalStep${n}`).hidden = currentStep !== n;
    });

    const labels = [
      t('step_basics', 'Basics'),
      t('step_evaluation', 'Evaluation'),
      t('step_details', 'Details'),
    ];
    stepIndicator.innerHTML = labels
      .map((label, i) => {
        const n = i + 1;
        const cls = n < currentStep ? 'is-done' : n === currentStep ? 'is-active' : '';
        return `<li class="${cls}"${n === currentStep ? ' aria-current="step"' : ''}>${n}. ${escapeHtml(label)}</li>`;
      })
      .join('');

    const cancelOrBack =
      currentStep === 1
        ? `<button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>`
        : `<button type="button" class="btn btn-secondary" id="btnModalBack">← ${t('back', 'Back')}</button>`;
    footerActions.innerHTML =
      currentStep < TOTAL_STEPS
        ? `${cancelOrBack}<span class="modal-footer__spacer"></span>
           <button type="button" class="btn btn-secondary" id="btnCreateNow">${t('create_now', 'Create now')}</button>
           <button type="button" class="btn btn-primary" id="btnModalNext">${t('next', 'Next')} →</button>`
        : `${cancelOrBack}<span class="modal-footer__spacer"></span>
           <button type="button" class="btn btn-primary" id="btnSubmitNewProject">${t('create_plan', 'Create plan')}</button>`;
    bindStepButtons();
  }

  /** Step-1 rules; returns an error message or ''. */
  function validateBasics() {
    if (!form.name.value.trim()) return t('required_plan_name', 'Please enter a plan name.');
    const owner = ownerTypeSelect.value;
    if (owner === 'faculty' && !modalFacSelect.value) return t('required_faculty', 'Please choose a faculty.');
    if (owner === 'department' && !modalDeptSelect.value) return t('required_department', 'Please choose a department.');
    return '';
  }

  function bindStepButtons() {
    $('btnModalNext')?.addEventListener('click', () => {
      if (currentStep === 1) {
        const msg = validateBasics();
        if (msg) return showError(msg);
      }
      currentStep += 1;
      updateStepUI();
    });

    $('btnModalBack')?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep -= 1;
        updateStepUI();
      }
    });

    $('btnCreateNow')?.addEventListener('click', submitPlan);
    $('btnSubmitNewProject')?.addEventListener('click', submitPlan);
  }

  // Enter in the name field goes to the next step instead of submitting the form
  form.addEventListener('submit', (e) => e.preventDefault());
  form.name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('btnModalNext')?.click();
    }
  });
  form.name.focus();

  async function submitPlan() {
    const basicsError = validateBasics();
    if (basicsError) {
      currentStep = 1;
      updateStepUI();
      return showError(basicsError);
    }

    const ownerType = ownerTypeSelect.value;
    let faculty_id = null;
    let department_id = null;
    if (ownerType === 'faculty') faculty_id = Number(modalFacSelect.value);
    else if (ownerType === 'department') department_id = Number(modalDeptSelect.value);

    let yearsVal = horizonSelect.value || '1';
    if (yearsVal === 'Other') yearsVal = form.analysis_period_years.value;

    let catVal = categorySelect.value || '';
    if (catVal === 'Other') catVal = $('modalCategoryCustom').value.trim();

    let curVal = currencySelect.value || 'THB';
    if (curVal === 'Other') curVal = $('modalCurrencyCustom').value.trim().toUpperCase() || 'THB';

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
      assessment_months: form.assessment_months.value ? parseInt(form.assessment_months.value, 10) : null,
      calc_method: form.calc_method.value,
      // Without this the plan starts with no investment basis, and Step 1 stays "incomplete" until Save is pressed.
      investment_basis: 'nominal',
    };
    if (currentOrgId) data.organization_id = currentOrgId;

    const buttons = footerActions.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true)); // no double submits
    try {
      const res = await api.createProject(data);
      closeModal();
      onCreated(res.data);
    } catch (err) {
      buttons.forEach((b) => (b.disabled = false));
      showError(err.message);
    }
  }

  updateStepUI();
}