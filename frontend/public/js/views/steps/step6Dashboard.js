/**
 * Step 6: Results Dashboard & Report Generation
 * Fully bilingual (Thai & English)
 */

import { getState, runCalculation, createReport, loadReports } from '../../store.js';
import { renderStakeholderChart, renderOutcomeBarChart, renderAnnualTrendChart } from '../../components/charts.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht, formatRatio } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';
import { t } from '../../i18n.js';

export function renderStep6(container) {
  const { project, dashboard, activeScenarioId, reports } = getState();
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const isReady = dashboard?.status === 'ready';
  const result = dashboard?.result || {};
  const summary = result.summary || {};
  const stakeholders = result.stakeholders || [];
  const outcomeLines = result.outcomes || [];
  const annual = result.annual || [];

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      ${
        !isReady
          ? `
        <div class="card has-stripe" style="--stripe: var(--warning);">
          <div class="card-head">
            <div>
              <h2 class="card-title">${t('blockers_identified', 'Incomplete Project Inputs')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                ${t('blockers_desc', 'Baseline inputs are missing or unassessed. Complete earlier steps to generate full results.')}
              </p>
            </div>
            <a class="btn btn-primary" href="#/wizard/step-5">${t('btn_proceed_dash', 'Check Review Screen →')}</a>
          </div>
        </div>
      `
          : `
        <!-- Top Action Bar -->
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--sp-md);">
          <div>
            <h1 class="page-title" style="margin-bottom: 2px;">${t('dash_title', 'Impact Analytics Dashboard')}</h1>
            <p class="muted page-sub" style="margin-bottom: 0;">
              ${t('field_analysis_period', 'Evaluation Period')}: ${project.analysis_period_years || 5} ${t('years', 'Years')} | ${t('field_currency', 'Currency')}: ${project.currency}
            </p>
          </div>
          <div style="display: flex; gap: var(--sp-sm);">
            <button class="btn btn-secondary" id="btnSaveRun">
              ${t('btn_save_run', '💾 Save Auditable Run')}
            </button>
            <button class="btn btn-primary" id="btnExportMenu">
              ${t('btn_export_report', '📥 Export Report')}
            </button>
          </div>
        </div>

        <!-- 4 Key Metric Cards (PRD Section 3.2) -->
        <div class="stat-grid-4">
          <!-- Card 1: SROI Ratio -->
          <div class="stat-card is-highlight">
            <div class="stat-label">${t('card_sroi_ratio', 'SROI Ratio')}</div>
            <div class="stat-val ratio">
              ${summary.sroi_ratio !== null && summary.sroi_ratio !== undefined ? `${summary.sroi_ratio.toFixed(2)} : 1` : 'N/A'}
            </div>
            <div class="stat-sub">${t('stat_sroi_explain', 'Estimated monetized social value per 1 invested.')}</div>
          </div>

          <!-- Card 2: Present Value of Impact -->
          <div class="stat-card">
            <div class="stat-label">${t('card_pv_impact', 'Present Value of Social Impact')}</div>
            <div class="stat-val" style="color: var(--positive);">
              ${project.currency} ${formatBaht(summary.present_value_of_impact || 0)}
            </div>
            <div class="stat-sub">
              ${t('polarity_positive', '+ Positive')}: ${formatBaht(summary.positive_present_value || 0)} | ${t('polarity_negative', '- Harms')}: -${formatBaht(Math.abs(summary.negative_present_value || 0))}
            </div>
          </div>

          <!-- Card 3: Total Investment -->
          <div class="stat-card">
            <div class="stat-label">${t('card_total_investment', 'Total Investment')}</div>
            <div class="stat-val" style="color: var(--warning);">
              ${project.currency} ${formatBaht(summary.investment_used || 0)}
            </div>
            <div class="stat-sub">${t('inv_basis_label', 'Basis')}: ${project.investment_basis === 'present_value' ? t('inv_basis_pv', 'Present Value') : t('inv_basis_nominal', 'Nominal Cash')}</div>
          </div>

          <!-- Card 4: Net Social Value -->
          <div class="stat-card">
            <div class="stat-label">${t('card_net_social_value', 'Net Social Value')}</div>
            <div class="stat-val">
              ${(summary.net_social_value || 0) >= 0 ? '+' : ''}${project.currency} ${formatBaht(summary.net_social_value || 0)}
            </div>
            <div class="stat-sub">${t('stat_net_return', 'Net Social Return:')} ${summary.net_return_pct !== null && summary.net_return_pct !== undefined ? summary.net_return_pct + '%' : '-'}</div>
          </div>
        </div>

        <!-- Visual Analytics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--sp-lg);">
          <!-- A. Stakeholder Value Distribution -->
          <div class="chart-card">
            <div class="chart-title">A. ${t('chart_stakeholder_dist', 'Social Value by Stakeholder Group')}</div>
            <div class="chart-subtitle">Distribution of positive present-value impact among affected beneficiaries</div>
            ${renderStakeholderChart(stakeholders)}
          </div>

          <!-- B. Outcome Valuation Breakdown -->
          <div class="chart-card">
            <div class="chart-title">B. ${t('chart_outcome_breakdown', 'Outcome Valuation Breakdown')}</div>
            <div class="chart-subtitle">Net present value generated across individual social changes</div>
            ${renderOutcomeBarChart(outcomeLines)}
          </div>
        </div>

        <!-- C. Annual Investment vs Social Value -->
        <div class="chart-card">
          <div class="chart-title">C. ${t('chart_annual_trend', 'Annual Investment versus Social Impact')}</div>
          <div class="chart-subtitle">${t('yearly_pv_desc', 'Net discounted benefit values after deducting deadweight, attribution, and drop-off.')}</div>
          ${renderAnnualTrendChart(annual)}
        </div>

        <!-- E. Impact Composition Expandable Audit Table -->
        <div class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">E. ${t('outcome_registry_title', 'Detailed Impact Composition Table')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                Outcome-by-outcome audit breakdown from Gross value to Discounted Present Value
              </p>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>${t('col_outcome_name', 'Outcome')}</th>
                  <th class="num">${t('col_gross_annual', 'Gross Value')}</th>
                  <th class="num">${t('col_net_retained', 'Adjustment Factor')}</th>
                  <th class="num">Retained Value</th>
                  <th class="num">${t('col_present_value', 'Present Value')}</th>
                  <th>${t('col_eval_type', 'Model')}</th>
                </tr>
              </thead>
              <tbody>
                ${outcomeLines
                  .map(
                    (l) => `
                  <tr>
                    <td class="strong">
                      ${escapeHtml(l.name)}
                      <span class="polarity-badge ${l.polarity === 'negative' ? 'polarity-negative' : 'polarity-positive'}" style="margin-left: 6px;">
                        ${l.polarity === 'negative' ? t('polarity_negative', '- Harm') : t('polarity_positive', '+ Benefit')}
                      </span>
                    </td>
                    <td class="num">${project.currency} ${formatBaht(l.totals?.gross || 0)}</td>
                    <td class="num">${((l.adjustment_factor || 0) * 100).toFixed(1)}%</td>
                    <td class="num">${project.currency} ${formatBaht(l.totals?.retained || 0)}</td>
                    <td class="num strong" style="color: ${(l.totals?.present_value || 0) < 0 ? 'var(--negative)' : 'var(--positive)'}; font-size: 0.9375rem;">
                      ${project.currency} ${formatBaht(l.totals?.present_value || 0)}
                    </td>
                    <td><span class="badge badge-planned">${escapeHtml(l.projection_model)}</span></td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      }
    </div>
  `;

  // Attach Save Run handler
  document.getElementById('btnSaveRun')?.addEventListener('click', async () => {
    try {
      const run = await runCalculation(activeScenarioId);
      alert(`Auditable calculation run #${run.run?.id} successfully saved!`);
    } catch (err) {
      alert(`Failed to save run: ${err.message}`);
    }
  });

  // Attach Export Report Menu handler
  document.getElementById('btnExportMenu')?.addEventListener('click', () => {
    openExportReportModal({ project, activeScenarioId });
  });
}

function openExportReportModal({ project, activeScenarioId }) {
  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        Generate an official reproducible impact report snapshot for university committees, funders, or public stakeholders.
      </p>

      <form id="reportGenForm" class="stack" style="gap: var(--sp-md);">
        <div class="field">
          <label class="field-label">${t('col_report_title', 'Report Title')} *</label>
          <input type="text" name="title" class="input" value="${escapeHtml(project.name)} — SROI Impact Assessment Report" required />
        </div>
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'Report Type')}</label>
          <select name="type" class="input">
            <option value="detailed" selected>Detailed Analysis Report (12-section audit trail)</option>
            <option value="executive">Executive Summary Report (Key metrics & findings)</option>
          </select>
        </div>
      </form>

      <div style="display: flex; gap: var(--sp-sm); justify-content: flex-end; margin-top: var(--sp-sm);">
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
        <button class="btn btn-primary" id="btnCreateAndExport">${t('btn_export_report', 'Generate Report Document')}</button>
      </div>

      <div id="exportDownloadSection" style="display: none; border-top: 1px solid var(--outline); padding-top: var(--sp-md);">
        <h4 style="font-size: 0.875rem; margin-bottom: var(--sp-sm);">${t('col_export_formats', 'Download Formats:')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: var(--sp-sm);">
          <button class="btn btn-secondary" id="btnDownloadHtml">🌐 HTML Print View</button>
          <button class="btn btn-secondary" id="btnDownloadPdf">📄 PDF Document</button>
          <button class="btn btn-secondary" id="btnDownloadCsv">📊 CSV Dataset</button>
          <button class="btn btn-secondary" id="btnDownloadJson">📦 JSON Snapshot</button>
          <button class="btn btn-secondary" id="btnShareLink">🔗 Public Share Link</button>
        </div>
        <div id="shareLinkContainer" style="margin-top: var(--sp-sm); display: none;"></div>
      </div>
    </div>
  `;

  openModal({
    title: t('modal_export_title', 'Generate & Export Impact Report'),
    body: modalHtml,
    size: 'lg',
  });

  let activeReportId = null;

  document.getElementById('btnCreateAndExport')?.addEventListener('click', async () => {
    const form = document.getElementById('reportGenForm');
    const downloadSec = document.getElementById('exportDownloadSection');
    if (!form) return;

    try {
      // 1. Calculate run first
      const runRes = await runCalculation(activeScenarioId);
      const runId = runRes?.run?.id;

      // 2. Create report
      const repRes = await createReport(runId, form.type.value, form.title.value.trim());
      activeReportId = repRes?.id || repRes?.report?.id;

      if (downloadSec) {
        downloadSec.style.display = 'block';
      }
      alert('Report snapshot generated successfully! Choose your download format below.');
    } catch (err) {
      alert(`Report generation failed: ${err.message}`);
    }
  });

  const triggerDownload = async (format) => {
    if (!activeReportId) {
      alert('Please generate the report document first.');
      return;
    }
    try {
      const blob = await api.exportReport(activeReportId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SROI_Report_${project.id}_${activeReportId}.${format === 'html' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  document.getElementById('btnDownloadHtml')?.addEventListener('click', () => triggerDownload('html'));
  document.getElementById('btnDownloadPdf')?.addEventListener('click', () => triggerDownload('pdf'));
  document.getElementById('btnDownloadCsv')?.addEventListener('click', () => triggerDownload('csv'));
  document.getElementById('btnDownloadJson')?.addEventListener('click', () => triggerDownload('json'));

  document.getElementById('btnShareLink')?.addEventListener('click', async () => {
    if (!activeReportId) return;
    try {
      const res = await api.shareReport(activeReportId);
      const shareUrl = res?.data?.url || `${window.location.origin}/api/v1/shared/${res?.data?.token}`;
      const box = document.getElementById('shareLinkContainer');
      if (box) {
        box.innerHTML = `
          <div class="alert alert-success" style="font-size: 0.8125rem;">
            <strong>Shareable Web Link:</strong><br />
            <a href="${shareUrl}" target="_blank" style="word-break: break-all;">${shareUrl}</a>
          </div>
        `;
        box.style.display = 'block';
      }
    } catch (err) {
      alert(`Failed to create share link: ${err.message}`);
    }
  });
}
