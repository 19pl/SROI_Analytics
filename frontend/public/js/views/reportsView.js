import { getState, loadReports, loadRuns } from '../store.js';
import { api } from '../api.js';
import { card } from '../components/ui.js';
import { escapeHtml } from '../utils/html.js';
import { formatBaht } from '../utils/format.js';
import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

export async function renderReports(root) {
  const { project } = getState();

  if (!project) {
    root.innerHTML = `
      <div class="alert alert-info">
        Please select a project from the <a href="#/projects" style="text-decoration: underline; font-weight: 600;">Projects Workspace</a> to view its reports.
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">${t('reports_title', 'Report Archive & Audit Trail')}</h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            Project: ${escapeHtml(project.name)} | ${t('reports_subtitle', 'Reproducible snapshots preserved with input hashes')}
          </p>
        </div>
        <a class="btn btn-primary" href="#/wizard/step-6">Open Calculator Dashboard →</a>
      </div>

      <!-- Generated Reports Table -->
      <div class="card">
        <div class="card-head">
          <h2 class="card-title">Published Impact Reports</h2>
        </div>
        <div id="reportsListTable">
          <div class="muted">${t('loading', 'Loading reports...')}</div>
        </div>
      </div>

      <!-- Calculation Runs Table -->
      <div class="card">
        <div class="card-head">
          <h2 class="card-title">Auditable Calculation Runs</h2>
        </div>
        <div id="runsListTable">
          <div class="muted">Loading calculation runs...</div>
        </div>
      </div>
    </div>
  `;

  // Load Reports
  loadReports().then((reports) => {
    const box = document.getElementById('reportsListTable');
    if (!box) return;

    if (!reports || reports.length === 0) {
      box.innerHTML = `<div class="muted" style="padding: 16px;">No reports generated yet. Go to Step 6 Dashboard to generate a report.</div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Report Title</th>
              <th>Type</th>
              <th>Created</th>
              <th>Export Formats</th>
            </tr>
          </thead>
          <tbody>
            ${reports
              .map(
                (r) => `
              <tr>
                <td class="strong">${escapeHtml(r.title)}</td>
                <td><span class="badge badge-planned">${escapeHtml(r.type)}</span></td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary" data-dl-report="${r.id}" data-fmt="html" style="height: 28px; font-size: 0.75rem;">HTML</button>
                    <button class="btn btn-secondary" data-dl-report="${r.id}" data-fmt="pdf" style="height: 28px; font-size: 0.75rem;">PDF</button>
                    <button class="btn btn-secondary" data-dl-report="${r.id}" data-fmt="csv" style="height: 28px; font-size: 0.75rem;">CSV</button>
                  </div>
                </td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    box.querySelectorAll('[data-dl-report]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rId = Number(btn.dataset.dlReport);
        const fmt = btn.dataset.fmt;
        try {
          const blob = await api.exportReport(rId, fmt);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Report_${rId}.${fmt === 'html' ? 'html' : fmt}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          alert(`Download failed: ${err.message}`);
        }
      });
    });
  });

  // Load Runs
  loadRuns().then((runs) => {
    const box = document.getElementById('runsListTable');
    if (!box) return;

    if (!runs || runs.length === 0) {
      box.innerHTML = `<div class="muted" style="padding: 16px;">No saved calculation runs recorded yet.</div>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Scenario</th>
              <th class="num">SROI Ratio</th>
              <th class="num">Present Value</th>
              <th class="num">Investment</th>
              <th>Input SHA-256</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${runs
              .map(
                (run) => `
              <tr>
                <td class="strong">#${run.id}</td>
                <td><span class="badge badge-planned">${escapeHtml(run.scenario_name)}</span></td>
                <td class="num strong" style="color: var(--primary);">
                  ${run.sroi_ratio !== null ? `${run.sroi_ratio.toFixed(2)} : 1` : '-'}
                </td>
                <td class="num">${project.currency} ${formatBaht(run.present_value)}</td>
                <td class="num">${project.currency} ${formatBaht(run.investment)}</td>
                <td style="font-family: var(--font-mono); font-size: 0.6875rem;" title="${escapeHtml(run.input_hash)}">
                  ${run.input_hash ? run.input_hash.substring(0, 10) + '...' : '-'}
                </td>
                <td>${new Date(run.created_at).toLocaleDateString()}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  });
}
