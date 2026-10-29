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

export async function renderFacultyReport(root) {
  const hash = window.location.hash || '';
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const facultyId = Number(urlParams.get('id'));

  if (!facultyId) {
    root.innerHTML = `
      <div class="card" style="padding: var(--sp-2xl); text-align: center;">
        <h3 style="margin-bottom: var(--sp-xs); font-size: 1.125rem;">${t('no_data', 'No Faculty Specified')}</h3>
        <p class="muted" style="margin-bottom: var(--sp-lg);">${t('org_subtitle', 'Please navigate to this report from the Organizational Structure page.')}</p>
        <a class="btn btn-primary" href="#/org">${t('back_to_org', 'Go to Organizations & Faculties')}</a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="stack" style="gap: var(--sp-lg);">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-md); flex-wrap: wrap;">
        <div>
          <a href="#/org" class="muted" style="font-size: 0.8125rem; text-decoration: none; display: inline-block; margin-bottom: 6px; font-weight: 500;">
            ${t('back_to_org', '← Back to Organizational Structure')}
          </a>
          <h1 class="page-title" id="facultyReportTitle" style="margin-bottom: 2px;">
            ${t('faculty_report_title', 'Faculty Consolidated SROI Report')}
          </h1>
          <p class="muted page-sub" id="facultyReportSubtitle" style="margin-bottom: 0;">
            ${t('faculty_report_subtitle', 'Multi-plan portfolio analysis across faculty-owned and department-owned SROI assessments')}
          </p>
        </div>
        <button class="btn btn-secondary" onclick="window.print()" style="font-weight: 600;">
          📄 ${t('btn_print_pdf', 'Print / Export PDF')}
        </button>
      </div>

      <!-- Main Content Area -->
      <div id="facultyReportContent">
        <div class="muted" style="padding: var(--sp-2xl); text-align: center;">${t('loading', 'Loading consolidated report data...')}</div>
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
      <div class="stack" style="gap: var(--sp-lg);">
        <!-- Double-Counting Protection Alert -->
        <div class="alert alert-info" style="border-left: 4px solid var(--positive); background: rgba(34, 197, 94, 0.08);">
          <div style="font-weight: 700; margin-bottom: 4px; color: var(--positive-fg);">
            ${t('anti_double_count_title', '🛡️ Anti-Double-Counting Methodology & Reporting Governance')}
          </div>
          <div style="font-size: 0.875rem; color: var(--on-background); line-height: 1.6;">
            ${t('anti_double_count_desc', 'Every plan in this faculty has exactly one direct owner: either the Faculty itself or one of its constituent Departments.')}
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--sp-md);">
          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700;">
              ${t('metric_total_plans', 'Total Plans')}
            </div>
            <div style="font-size: 1.625rem; font-weight: 700; color: var(--on-background); margin: 4px 0;">
              ${plans.length}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              ${facultyPlans.length} ${t('metric_faculty_direct', 'Faculty direct')} + ${deptPlans.length} ${t('metric_dept_direct', 'Dept direct')}
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700;">
              ${t('metric_portfolio_inv', 'Portfolio Investment')}
            </div>
            <div style="font-size: 1.625rem; font-weight: 700; color: var(--on-background); margin: 4px 0;">
              ฿${formatNumber(totalInv, 0)}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              ${t('metric_across_plans', 'Across')} ${calculatedCount} ${t('stat_total_plans', 'calculated plans')}
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700;">
              ${t('metric_total_pv', 'Total Present Value (PV)')}
            </div>
            <div style="font-size: 1.625rem; font-weight: 700; color: var(--primary); margin: 4px 0;">
              ฿${formatNumber(totalPv, 0)}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              ${t('metric_discounted_impact', 'Discounted social impact')}
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md); border-top: 3px solid var(--primary);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700;">
              ${t('metric_consolidated_sroi', 'Consolidated Portfolio SROI')}
            </div>
            <div style="font-size: 1.625rem; font-weight: 700; color: var(--primary); margin: 4px 0;">
              ${consolidatedRatio} : 1
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              ${t('metric_net_social_value', 'Net Social Value')}: ฿${formatNumber(consolidatedNsv, 0)}
            </div>
          </div>
        </div>

        <!-- Section 1: Faculty-Owned Plans -->
        <div class="card" style="padding: var(--sp-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-xs);">
            <h2 style="font-size: 1rem; font-weight: 700; margin: 0; color: var(--on-background);">
              ${t('section_faculty_plans', 'Direct Faculty-Owned Plans')} (${facultyPlans.length})
            </h2>
            <span class="badge badge-production">${t('badge_faculty_exec', 'Owned by Faculty Executive')}</span>
          </div>

          ${
            facultyPlans.length === 0
              ? `<p class="muted" style="font-size: 0.875rem; padding: var(--sp-md) 0;">${t('no_faculty_plans', 'No plans owned directly by the faculty executive.')}</p>`
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
                      <td class="num strong" style="color: var(--primary);">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : t('not_calculated', 'Not calculated')}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary" data-open-plan="${p.id}" style="height: 28px; font-size: 0.75rem;">
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
        <div class="card" style="padding: var(--sp-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-xs);">
            <h2 style="font-size: 1rem; font-weight: 700; margin: 0; color: var(--on-background);">
              ${t('section_dept_plans', 'Department-Owned Plans')} (${deptPlans.length})
            </h2>
            <span class="badge badge-integrated">${t('badge_dept_owned', 'Owned by Academic Departments')}</span>
          </div>

          ${
            deptPlans.length === 0
              ? `<p class="muted" style="font-size: 0.875rem; padding: var(--sp-md) 0;">${t('no_dept_plans', 'No plans owned by departments in this faculty.')}</p>`
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
                      <td class="num strong" style="color: var(--primary);">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : t('not_calculated', 'Not calculated')}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary" data-open-plan="${p.id}" style="height: 28px; font-size: 0.75rem;">
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
