/**
 * Consolidated Faculty SROI Report View
 */

import { api } from '../api.js';
import { loadProject } from '../store.js';
import { escapeHtml } from '../utils/html.js';
import { formatCurrency, formatNumber } from '../utils/format.js';
import { card } from '../components/ui.js';

export async function renderFacultyReport(root) {
  const hash = window.location.hash || '';
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const facultyId = Number(urlParams.get('id'));

  if (!facultyId) {
    root.innerHTML = `
      <div class="card" style="padding: var(--sp-2xl); text-align: center;">
        <h3>No Faculty Specified</h3>
        <p class="muted">Please navigate to this report from the Organizational Structure page.</p>
        <a class="btn btn-primary" href="#/org">Go to Organizations & Faculties</a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-lg);">
        <div>
          <a href="#/org" class="muted" style="font-size: 0.8125rem; text-decoration: none; display: inline-block; margin-bottom: 4px;">
            ← Back to Organizational Structure
          </a>
          <h1 class="page-title" id="facultyReportTitle" style="margin-bottom: 2px;">Faculty Consolidated SROI Report</h1>
          <p class="muted page-sub" id="facultyReportSubtitle" style="margin-bottom: 0;">
            Multi-plan portfolio analysis across faculty-owned and department-owned SROI assessments
          </p>
        </div>
        <button class="btn btn-secondary" onclick="window.print()">Print / Export PDF</button>
      </div>

      <div id="facultyReportContent">
        <div class="muted">Loading consolidated report data...</div>
      </div>
    </div>
  `;

  const content = document.getElementById('facultyReportContent');

  try {
    const res = await api.getFacultyReport(facultyId);
    const data = res.data || {};
    const faculty = data.faculty || {};
    const plans = data.plans || [];

    document.getElementById('facultyReportTitle').textContent = `Consolidated Report: ${faculty.name}`;
    if (faculty.description) {
      document.getElementById('facultyReportSubtitle').textContent = faculty.description;
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
        <div class="alert alert-info" style="border-left: 4px solid var(--accent); background: #f0fdf4;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #166534;">
            🛡️ Anti-Double-Counting Methodology & Reporting Governance
          </div>
          <div style="font-size: 0.875rem; color: #1e293b; line-height: 1.5;">
            Every plan in this faculty has exactly <strong>one direct owner</strong>: either the Faculty itself or one of its constituent Departments.
            SROI ratios are <em>never averaged across plans</em>. Consolidated metrics are derived strictly from the aggregate investment capital
            and the aggregate present value of monetized outcomes across distinct non-overlapping assessment scopes.
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Total Plans</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">
              ${plans.length}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              ${facultyPlans.length} Faculty direct + ${deptPlans.length} Dept
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Portfolio Investment</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text);">
              ฿${formatNumber(totalInv, 0)}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              Across ${calculatedCount} calculated plans
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Total Present Value (PV)</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
              ฿${formatNumber(totalPv, 0)}
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              Discounted social impact
            </div>
          </div>

          <div class="card" style="padding: var(--sp-md); border-top: 3px solid var(--primary);">
            <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Consolidated Portfolio SROI</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
              ${consolidatedRatio} : 1
            </div>
            <div class="muted" style="font-size: 0.75rem;">
              Net Social Value: ฿${formatNumber(consolidatedNsv, 0)}
            </div>
          </div>
        </div>

        <!-- Section 1: Faculty-Owned Plans -->
        <div class="card" style="padding: var(--sp-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
            <h2 style="font-size: 1rem; font-weight: 600; margin: 0;">
              Direct Faculty-Owned Plans (${facultyPlans.length})
            </h2>
            <span class="badge badge-planned">Owned by Faculty Executive</span>
          </div>

          ${
            facultyPlans.length === 0
              ? `<p class="muted" style="font-size: 0.875rem;">No plans owned directly by the faculty executive.</p>`
              : `
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Type</th>
                    <th class="num">Investment</th>
                    <th class="num">Present Value</th>
                    <th class="num">SROI Ratio</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${facultyPlans
                    .map(
                      (p) => `
                    <tr>
                      <td class="strong">${escapeHtml(p.name)}</td>
                      <td><span class="badge badge-integrated">${escapeHtml(p.evaluation_type)}</span></td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.investment, 0) : '-'}</td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.present_value, 0) : '-'}</td>
                      <td class="num strong" style="color: var(--primary);">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : 'Not calculated'}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary" data-open-plan="${p.id}" style="height: 28px; font-size: 0.75rem;">
                          Open Calculator
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
            <h2 style="font-size: 1rem; font-weight: 600; margin: 0;">
              Department-Owned Plans (${deptPlans.length})
            </h2>
            <span class="badge badge-integrated">Owned by Academic Departments</span>
          </div>

          ${
            deptPlans.length === 0
              ? `<p class="muted" style="font-size: 0.875rem;">No plans owned by departments in this faculty.</p>`
              : `
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Plan Name</th>
                    <th>Type</th>
                    <th class="num">Investment</th>
                    <th class="num">Present Value</th>
                    <th class="num">SROI Ratio</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptPlans
                    .map(
                      (p) => `
                    <tr>
                      <td><span class="badge badge-planned">${escapeHtml(p.department_name || 'Department')}</span></td>
                      <td class="strong">${escapeHtml(p.name)}</td>
                      <td><span class="badge badge-integrated">${escapeHtml(p.evaluation_type)}</span></td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.investment, 0) : '-'}</td>
                      <td class="num">${p.latest_run ? '฿' + formatNumber(p.latest_run.present_value, 0) : '-'}</td>
                      <td class="num strong" style="color: var(--primary);">
                        ${p.latest_run && p.latest_run.sroi_ratio !== null ? Number(p.latest_run.sroi_ratio).toFixed(4) + ' : 1' : 'Not calculated'}
                      </td>
                      <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                      <td>
                        <button class="btn btn-secondary" data-open-plan="${p.id}" style="height: 28px; font-size: 0.75rem;">
                          Open Calculator
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
