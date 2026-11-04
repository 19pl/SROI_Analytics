/**
 * Consolidated Faculty SROI Report View
 * Professional university institutional standard, fully bilingual (Thai & English)
 */

import { api } from '../api.js';
import { loadProject } from '../store.js';
import { escapeHtml } from '../utils/html.js';
import { formatCurrency, formatNumber } from '../utils/format.js';
import { card } from '../components/ui.js';
import { t } from '../i18n.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';

export async function renderFacultyReport(root) {
  if (isGuest()) {
    renderGuestPage(root, 'facultyReport');
    return;
  }
  const hash = window.location.hash || '';
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const facultyId = Number(urlParams.get('id'));

  if (!facultyId) {
    root.innerHTML = `
      <div class="empty-state">
        <h3 class="panel__title">${t('no_data', 'No Faculty Specified')}</h3>
        <p class="muted-sm">${t('org_subtitle', 'Please navigate to this report from the Organizational Structure page.')}</p>
        <a class="btn btn-primary" href="#/org">${t('back_to_org', 'Go to Organizations & Faculties')}</a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="form-stack stack-lg">
      <!-- Header -->
      <div class="page-head">
        <div>
          <a href="#/org" class="muted-sm">
            ${t('back_to_org', '← Back to Organizational Structure')}
          </a>
          <h1 class="page-head__title" id="facultyReportTitle">
            ${t('faculty_report_title', 'Faculty Consolidated SROI Report')}
          </h1>
          <p class="page-head__sub" id="facultyReportSubtitle">
            ${t('faculty_report_subtitle', 'Multi-plan portfolio analysis across faculty-owned and department-owned SROI assessments')}
          </p>
        </div>
        <button class="btn btn-secondary" onclick="window.print()">
          ${t('btn_print_pdf', 'Print / Export PDF')}
        </button>
      </div>

      <!-- Main Content Area -->
      <div id="facultyReportContent">
        <div class="empty-state"><p class="empty-state__text">${t('loading', 'Loading consolidated report data...')}</div>
      </div>
    </div>
  `;

  const content = document.getElementById('facultyReportContent');

  try {
    const res = await api.getFacultyReport(facultyId);
    const data = res.data || {};
    const faculty = data.faculty || {};
    const plans = data.plans || [];

    const titleEl = document.getElementById('facultyReportTitle');
    const subtitleEl = document.getElementById('facultyReportSubtitle');

    if (titleEl) {
      titleEl.textContent = `${t('conso_title_prefix', 'Consolidated Report:')} ${faculty.name}`;
    }
    if (subtitleEl && faculty.description) {
      subtitleEl.textContent = faculty.description;
    }

    // Separate faculty-owned from department-owned plans
    const facultyPlans = plans.filter((p) => p.owned_by_faculty);
    const deptPlans = plans.filter((p) => !p.owned_by_faculty);

    // Calculate rolled-up totals using underlying sums (NOT ratio averaging)
    let totalInv = 0;
    let totalPv = 0;
    let calculatedCount = 0;

    plans.forEach((p) => {
      if (p.latest_run) {
        totalInv += Number(p.latest_run.investment || 0);
        totalPv += Number(p.latest_run.present_value || 0);
        calculatedCount++;
      }
    });

    const consolidatedRatio = totalInv > 0 ? (totalPv / totalInv).toFixed(4) : 'N/A';
    const consolidatedNsv = totalPv - totalInv;

    content.innerHTML = `
      <div class="form-stack stack-lg">
        <!-- Double-Counting Protection Alert -->
        <div class="panel panel--soft">
          <div class="strong val--positive">
            ${t('anti_double_count_title', 'Anti-Double-Counting Methodology & Reporting Governance')}
          </div>
          <div class="muted-sm">
            ${t('anti_double_count_desc', 'Every plan in this faculty has exactly one direct owner: either the Faculty itself or one of its constituent Departments.')}
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="form-row">
          <div class="panel">
            <div class="muted" class="muted-sm uppercase strong">
              ${t('metric_total_plans', 'Total Plans')}
            </div>
            <div class="stat-num--lg">
              ${plans.length}
            </div>
            <div class="muted" class="muted-sm">
              ${facultyPlans.length} ${t('metric_faculty_direct', 'Faculty direct')} + ${deptPlans.length} ${t('metric_dept_direct', 'Dept direct')}
            </div>
          </div>

          <div class="panel">
            <div class="muted" class="muted-sm uppercase strong">
              ${t('metric_portfolio_inv', 'Portfolio Investment')}
            </div>
            <div class="stat-num--lg">
              ฿${formatNumber(totalInv, 0)}
            </div>
            <div class="muted" class="muted-sm">
              ${t('metric_across_plans', 'Across')} ${calculatedCount} ${t('stat_total_plans', 'calculated plans')}
            </div>
          </div>

          <div class="panel">
            <div class="muted" class="muted-sm uppercase strong">
              ${t('metric_total_pv', 'Total Present Value (PV)')}
            </div>
            <div class="stat-num--lg primary-text">
              ฿${formatNumber(totalPv, 0)}
            </div>
            <div class="muted" class="muted-sm">
              ${t('metric_discounted_impact', 'Discounted social impact')}
            </div>
          </div>

          <div class="panel">
            <div class="muted" class="muted-sm uppercase strong">
              ${t('metric_consolidated_sroi', 'Consolidated Portfolio SROI')}
            </div>
            <div class="stat-num--lg primary-text">
              ${consolidatedRatio} : 1
            </div>
            <div class="muted" class="muted-sm">
              ${t('metric_net_social_value', 'Net Social Value')}: ฿${formatNumber(consolidatedNsv, 0)}
            </div>
          </div>
        </div>

        <!-- Section 1: Faculty-Owned Plans -->
        <div class="panel">
          <div class="toolbar">
            <h2 class="panel__title">
              ${t('section_faculty_plans', 'Direct Faculty-Owned Plans')} (${facultyPlans.length})
            </h2>
            <span class="badge badge-production">${t('badge_faculty_exec', 'Owned by Faculty Executive')}</span>
          </div>

          ${
            facultyPlans.length === 0
              ? `<p class="empty-state">${t('no_faculty_plans', 'No plans owned directly by the faculty executive.')}</p>`
              : `
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t('col_project_name', 'Plan Name')}</th>
                    <th>${t('col_eval_type', 'Type')}</th>
                    <th class="num">${t('col_investment', 'Investment')}</th>
                    <th class="num">${t('col_present_value', 'Present Value')}</th>
                    <th class="num">${t('col_sroi_ratio', 'SROI Ratio')}</th>
                    <th>${t('col_status', 'Status')}</th>
                    <th>${t('col_actions', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${facultyPlans
                    .map(
                      (p) => `
                    <tr>
                      <td class="strong">${escapeHtml(p.name)}</td>
                      <td>
                        <span class="badge badge-integrated">
                          ${p.evaluation_type === 'forecast' ? t('eval_type_forecast', 'Forecast') : t('eval_type_evaluative', 'Evaluative')}
                        </span>
                      </td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.investment, 0) : '-'}</td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.present_value, 0) : '-'}</td>
                      <td class="num strong" class="primary-text">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : t('not_calculated', 'Not calculated')}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary btn-compact" data-open-plan="${p.id}">
                          ${t('btn_open_calculator', 'Open Calculator')}
                        </button>
                      </td>
                    </tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>

        <!-- Section 2: Department-Owned Plans -->
        <div class="panel">
          <div class="toolbar">
            <h2 class="panel__title">
              ${t('section_dept_plans', 'Department-Owned Plans')} (${deptPlans.length})
            </h2>
            <span class="badge badge-integrated">${t('badge_dept_owned', 'Owned by Academic Departments')}</span>
          </div>

          ${
            deptPlans.length === 0
              ? `<p class="empty-state">${t('no_dept_plans', 'No plans owned by departments in this faculty.')}</p>`
              : `
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>${t('col_department_name', 'Department')}</th>
                    <th>${t('col_project_name', 'Plan Name')}</th>
                    <th>${t('col_eval_type', 'Type')}</th>
                    <th class="num">${t('col_investment', 'Investment')}</th>
                    <th class="num">${t('col_present_value', 'Present Value')}</th>
                    <th class="num">${t('col_sroi_ratio', 'SROI Ratio')}</th>
                    <th>${t('col_status', 'Status')}</th>
                    <th>${t('col_actions', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptPlans
                    .map(
                      (p) => `
                    <tr>
                      <td><span class="badge badge-planned">${escapeHtml(p.department_name || 'Department')}</span></td>
                      <td class="strong">${escapeHtml(p.name)}</td>
                      <td>
                        <span class="badge badge-integrated">
                          ${p.evaluation_type === 'forecast' ? t('eval_type_forecast', 'Forecast') : t('eval_type_evaluative', 'Evaluative')}
                        </span>
                      </td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.investment, 0) : '-'}</td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.present_value, 0) : '-'}</td>
                      <td class="num strong" class="primary-text">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : t('not_calculated', 'Not calculated')}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary btn-compact" data-open-plan="${p.id}">
                          ${t('btn_open_calculator', 'Open Calculator')}
                        </button>
                      </td>
                    </tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      </div>
    `;

    content.querySelectorAll('[data-open-plan]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pId = Number(btn.dataset.openPlan);
        await loadProject(pId);
        window.location.hash = '#/wizard/step-1';
      });
    });
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}
