/**
 * Guest mode.
 * A signed-out visitor can open every page and sees its normal layout (title, filters, table headings,
 * wizard steps). Where data would appear there is a plain empty state, and one slim banner at the top
 * explains that data is shown after signing in. No data is requested from the backend for guests.
 */

import { getCurrentUser } from '../api.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from './icons.js';
import { STEPS } from './stepper.js';
import { card } from './ui.js';
import { t } from '../i18n.js';

export function isGuest() {
  return !getCurrentUser();
}

/** Link to the sign-in page that brings the person back to the page they were on. */
export function signInHref() {
  const hidden = location.hash.startsWith('#/auth') || location.hash.startsWith('#/login');
  const here = location.hash && !hidden ? location.hash : '#/projects';
  return `#/login?next=${encodeURIComponent(here)}`;
}

/** One slim info strip, identical on every page. */
export function guestBannerHtml() {
  return `
    <div class="alert alert-info guest-banner" role="status">
      ${icons.info}
      <span>
        ${t('guest_banner_text', 'You are viewing as a guest.')}
        <a href="${escapeHtml(signInHref())}">${t('guest_banner_link', 'Sign in to view data')}</a>
      </span>
    </div>
  `;
}

export function emptyStateHtml() {
  return `<div class="empty-state">${t('guest_empty', 'Data is shown after signing in.')}</div>`;
}

const emptyCard = (title = '') => card({ title, body: emptyStateHtml() });

/** The real page's filter bar and table headings, empty and not interactive. */
function projectsBody() {
  const label = (key, fb) =>
    `<label class="field-label" style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted);">${t(key, fb)}</label>`;
  const cols = [
    ['col_project_name', 'Plan Name', ''],
    ['col_owner', 'Direct Owner', ''],
    ['col_eval_type', 'Type', ''],
    ['stat_horizon', 'Scope / Period', 'num'],
    ['col_sroi_ratio', 'SROI Ratio', 'num'],
    ['col_status', 'Status', ''],
    ['col_actions', 'Actions', ''],
  ];
  return `
    <div class="card" style="padding: var(--sp-md);">
      <div style="display: flex; gap: var(--sp-md); flex-wrap: wrap; align-items: flex-end;">
        <div style="flex: 2; min-width: 240px;">${label('search', 'Search')}
          <input type="text" class="input" style="height: 38px;" disabled placeholder="${t('search_projects_placeholder', 'Search plans by title or objectives...')}" />
        </div>
        <div style="flex: 1; min-width: 200px;">${label('filter_faculty', 'Faculty Filter')}
          <select class="input" style="height: 38px;" disabled><option>${t('all_faculties', 'All Faculties & General')}</option></select>
        </div>
        <div style="flex: 1; min-width: 200px;">${label('filter_dept', 'Department Filter')}
          <select class="input" style="height: 38px;" disabled><option>${t('all_departments', 'All Departments')}</option></select>
        </div>
      </div>
    </div>
    ${card({
      body: `<div class="table-wrap"><table class="table">
        <thead><tr>${cols.map(([k, fb, cls]) => `<th${cls ? ` class="${cls}"` : ''}>${t(k, fb)}</th>`).join('')}</tr></thead>
        <tbody><tr><td class="empty muted" colspan="${cols.length}">${t('guest_empty', 'Data is shown after signing in.')}</td></tr></tbody>
      </table></div>`,
    })}
  `;
}

function orgBody() {
  const stat = (key, fb) => `
    <div style="text-align: right;">
      <div class="muted" style="font-size: 0.75rem;">${t(key, fb)}</div>
      <div style="font-size: 1.25rem; font-weight: 700;">–</div>
    </div>`;
  return `
    <div class="card has-stripe" style="padding: var(--sp-lg); --stripe: var(--accent);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-md);">
        <div>
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted); letter-spacing: 0.05em;">${t('institution_label', 'Academic Institution')}</div>
          <div style="font-size: 1.125rem; font-weight: 700;">${t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)')}</div>
        </div>
        <div style="display: flex; gap: var(--sp-lg); flex-wrap: wrap;">
          ${stat('stat_total_faculties', 'Total Faculties')}
          ${stat('stat_total_departments', 'Total Departments')}
          ${stat('org_members_title', 'Organization Members')}
        </div>
      </div>
    </div>
    ${emptyCard()}
  `;
}

const reportsBody = () =>
  emptyCard(t('pub_reports_title', 'Published Impact Reports')) +
  emptyCard(t('audit_runs_title', 'Auditable Calculation Runs'));

const PAGES = {
  projects: {
    title: ['projects_title', 'Projects Workspace'],
    subtitle: ['projects_subtitle', 'Manage social return on investment assessments and select plans for evaluation'],
    body: projectsBody,
  },
  org: {
    title: ['org_title', 'Faculties & Departments Hierarchy'],
    subtitle: ['org_subtitle', 'Manage university organizational structure and configure SROI plan ownership at Naresuan University'],
    body: orgBody,
  },
  reports: {
    title: ['reports_title', 'Reports & Audit Log'],
    subtitle: ['reports_subtitle', 'Audit trail of model snapshots, sensitivity checks, and formal export records'],
    body: reportsBody,
  },
  facultyReport: {
    title: ['faculty_report_title', 'Faculty Consolidated SROI Report'],
    subtitle: ['faculty_report_subtitle', 'Multi-plan portfolio analysis across faculty-owned and department-owned SROI assessments'],
    body: () => emptyCard(),
  },
};

/** Whole-page guest view: the page's own title, one banner, then the page skeleton with empty data. */
export function renderGuestPage(root, page) {
  const p = PAGES[page];
  root.innerHTML = `
    <div class="stack" style="gap: var(--sp-lg);">
      <div>
        <h1 class="page-title" style="margin-bottom: 2px;">${t(...p.title)}</h1>
        <p class="muted page-sub" style="margin-bottom: 0;">${t(...p.subtitle)}</p>
      </div>
      ${guestBannerHtml()}
      ${p.body()}
    </div>
  `;
}

/** Guest content for one calculator step (the stepper and help panel around it stay as they are). */
export function guestStepHtml(stepNum) {
  const s = STEPS[stepNum - 1] || STEPS[0];
  return guestBannerHtml() + card({ title: t(s.labelKey, s.label), description: t(s.descKey, s.desc), body: emptyStateHtml() });
}
