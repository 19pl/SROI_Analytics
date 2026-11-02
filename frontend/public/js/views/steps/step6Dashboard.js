/**
 * Step 6: Results Dashboard & Plain-Language Executive Summary
 * Guided, beginner-friendly experience for university employees.
 * Explains SROI Ratio, NPV, social impact, assumptions, and institutional limitations.
 * Fully bilingual (Thai & English).
 */

import { getState, runCalculation, createReport, loadReports } from '../../store.js';
import {
  renderStakeholderChart,
  renderOutcomeBarChart,
  renderAnnualTrendChart,
} from '../../components/charts.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht, formatRatio } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

export function renderStep6(container) {
  const { project, dashboard, activeScenarioId, reports } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

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
  const ratio =
    summary.sroi_ratio !== null && summary.sroi_ratio !== undefined
      ? summary.sroi_ratio.toFixed(2)
      : null;

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      ${
        !isReady
          ? `
        <div class="card has-stripe" style="--stripe: var(--warning);">
          <div class="card-head">
            <div>
              <h2 class="card-title">${isTh ? '⚠️ ข้อมูลโครงการยังไม่ครบถ้วนสำหรับการคำนวณ' : 'Incomplete Project Inputs'}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                ${isTh ? 'ยังมีข้อมูลจำเป็นบางส่วนที่ยังไม่ได้ระบุ กรุณากลับไปตรวจสอบในขั้นตอนที่ 5 ก่อน' : 'Baseline inputs are missing or unassessed. Complete earlier steps to generate full results.'}
              </p>
            </div>
            <a class="btn btn-primary" href="#/wizard/step-5">${isTh ? 'ไปที่ขั้นตอนที่ 5 เพื่อตรวจสอบ →' : 'Check Review Screen →'}</a>
          </div>
        </div>
      `
          : `
        <!-- Top Action Bar -->
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--sp-md);">
          <div>
            <h1 class="page-title" style="margin-bottom: 2px;">${t('dash_title', 'แดชบอร์ดผลการประเมินความคุ้มค่าทางสังคม (Impact Dashboard)')}</h1>
            <p class="muted page-sub" style="margin-bottom: 0;">
              ${t('field_analysis_period', 'ระยะเวลาประเมิน')}: ${project.analysis_period_years || 1} ${t('years', 'ปี')} | ${t('field_currency', 'สกุลเงิน')}: ${project.currency}
            </p>
          </div>
          <div style="display: flex; gap: var(--sp-sm);">
            <button class="btn btn-secondary" id="btnSaveRun">
              ${isTh ? '💾 บันทึกประวัติการคำนวณ (Save Run)' : '💾 Save Auditable Run'}
            </button>
            <button class="btn btn-primary" id="btnExportMenu">
              ${isTh ? '📥 ส่งออกรายงาน (Export Report)' : '📥 Export Report'}
            </button>
          </div>
        </div>

        <!-- Executive Plain-Language Summary Box -->
        <div class="card has-stripe" style="--stripe: var(--positive); background: linear-gradient(180deg, var(--surface-card) 0%, rgba(46, 125, 50, 0.05) 100%); padding: var(--sp-lg);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span class="badge badge-production" style="font-size: 0.75rem; font-weight: 700;">
              📢 ${isTh ? 'บทสรุปผู้บริหารแบบเข้าใจง่าย (Executive Plain-Language Summary)' : 'Executive Summary'}
            </span>
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--on-background); margin-bottom: 8px;">
            ${
              isTh
                ? `โครงการนี้สร้างมูลค่าทางสังคมประมาณ <span style="color: var(--primary);">฿${ratio || '-'}</span> ต่อเงินลงทุนทุกๆ <span style="color: var(--primary);">฿1</span> ที่ใช้ไป`
                : `This project generates an estimated social value of <span style="color: var(--primary);">฿${ratio || '-'}</span> for every <span style="color: var(--primary);">฿1</span> invested.`
            }
          </h2>
          <p style="font-size: 0.875rem; line-height: 1.6; color: var(--muted); margin: 0;">
            ${
              isTh
                ? `จากการวิเคราะห์ภายใต้กรอบเวลา ${project.analysis_period_years || 1} ปี ด้วยเงินลงทุนรวม ${project.currency} ${formatBaht(summary.investment_used || 0)} โครงการได้สร้างผลลัพธ์เชิงบวกคืนสู่ผู้มีส่วนได้ส่วนเสีย คิดเป็นมูลค่าปัจจุบันของผลประโยชน์ทางสังคมสุทธิ (หักลบ Deadweight, Attribution และคิดลดแล้ว) เท่ากับ ${project.currency} ${formatBaht(summary.present_value_of_impact || 0)} ก่อให้เกิดมูลค่าปัจจุบันสุทธิ (Net Social Value) เท่ากับ ${project.currency} ${formatBaht(summary.net_social_value || 0)}`
                : `Across an evaluation horizon of ${project.analysis_period_years || 1} year(s) with total investment of ${project.currency} ${formatBaht(summary.investment_used || 0)}, the project creates a net present value of social impact equal to ${project.currency} ${formatBaht(summary.present_value_of_impact || 0)}, yielding a Net Social Value of ${project.currency} ${formatBaht(summary.net_social_value || 0)}.`
            }
          </p>
        </div>

        <!-- 4 Key Metric Cards -->
        <div class="stat-grid-4">
          <!-- Card 1: SROI Ratio -->
          <div class="stat-card is-highlight">
            <div class="stat-label">${t('card_sroi_ratio', 'อัตราส่วน SROI')}</div>
            <div class="stat-val ratio">
              ${ratio !== null ? `${ratio} : 1` : 'N/A'}
            </div>
            <div class="stat-sub">${isTh ? 'มูลค่าทางสังคมที่สร้างได้ ต่อเงินลงทุน 1 บาท' : 'Monetized social value per 1 invested.'}</div>
          </div>

          <!-- Card 2: Present Value of Impact -->
          <div class="stat-card">
            <div class="stat-label">${t('card_pv_impact', 'มูลค่าปัจจุบันของผลกระทบทางสังคม')}</div>
            <div class="stat-val" style="color: var(--positive);">
              ${project.currency} ${formatBaht(summary.present_value_of_impact || 0)}
            </div>
            <div class="stat-sub">
              ${isTh ? 'ผลประโยชน์เชิงบวก' : 'Positive'}: ${formatBaht(summary.positive_present_value || 0)} | ${isTh ? 'ผลเสีย' : 'Harms'}: -${formatBaht(Math.abs(summary.negative_present_value || 0))}
            </div>
          </div>

          <!-- Card 3: Total Investment -->
          <div class="stat-card">
            <div class="stat-label">${t('card_total_investment', 'เงินลงทุนรวม')}</div>
            <div class="stat-val" style="color: var(--warning);">
              ${project.currency} ${formatBaht(summary.investment_used || 0)}
            </div>
            <div class="stat-sub">${t('inv_basis_label', 'เกณฑ์')}: ${project.investment_basis === 'present_value' ? t('inv_basis_pv', 'มูลค่าปัจจุบัน') : t('inv_basis_nominal', 'ตามมูลค่าเงินสด')}</div>
          </div>

          <!-- Card 4: Net Social Value -->
          <div class="stat-card">
            <div class="stat-label">${t('card_net_social_value', 'มูลค่าปัจจุบันสุทธิ (NPV)')}</div>
            <div class="stat-val">
              ${(summary.net_social_value || 0) >= 0 ? '+' : ''}${project.currency} ${formatBaht(summary.net_social_value || 0)}
            </div>
            <div class="stat-sub">${isTh ? 'ผลตอบแทนทางสังคมสุทธิ:' : 'Net Return:'} ${summary.net_return_pct !== null && summary.net_return_pct !== undefined ? summary.net_return_pct + '%' : '-'}</div>
          </div>
        </div>

        <!-- Visual Analytics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--sp-lg);">
          <!-- A. Stakeholder Value Distribution -->
          <div class="chart-card">
            <div class="chart-title">A. ${isTh ? 'การกระจายมูลค่าทางสังคมตามกลุ่มผู้มีส่วนได้ส่วนเสีย' : 'Social Value by Stakeholder Group'}</div>
            <div class="chart-subtitle">${isTh ? 'สัดส่วนคุณค่าที่ตกแก่กลุ่มเป้าหมาย นิสิต ชุมชน และมหาวิทยาลัย' : 'Distribution among affected beneficiaries'}</div>
            ${renderStakeholderChart(stakeholders)}
          </div>

          <!-- B. Outcome Valuation Breakdown -->
          <div class="chart-card">
            <div class="chart-title">B. ${isTh ? 'การแจกแจงมูลค่าตามผลลัพธ์แต่ละด้าน' : 'Outcome Valuation Breakdown'}</div>
            <div class="chart-subtitle">${isTh ? 'มูลค่าปัจจุบันสุทธิที่เกิดจากการเปลี่ยนแปลงแต่ละรายการ' : 'Net present value generated across outcomes'}</div>
            ${renderOutcomeBarChart(outcomeLines)}
          </div>
        </div>

        <!-- C. Annual Investment vs Social Value -->
        <div class="chart-card">
          <div class="chart-title">C. ${isTh ? 'แนวโน้มเปรียบเทียบเงินลงทุนกับมูลค่าทางสังคมรายปี' : 'Annual Investment versus Social Impact'}</div>
          <div class="chart-subtitle">${isTh ? 'มูลค่าผลประโยชน์สุทธิหลังหักลดทอนตามกาลเวลา (Drop-off)' : 'Net discounted benefits after deductions and drop-off'}</div>
          ${renderAnnualTrendChart(annual)}
        </div>

        <!-- Detailed Impact Composition Table -->
        <div class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">D. ${isTh ? 'ตารางตรวจสอบความโปร่งใสของผลลัพธ์ (Impact Audit Table)' : 'Detailed Impact Composition Table'}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                ${isTh ? 'แจกแจงตั้งแต่การประมาณมูลค่าขั้นต้น หักลบ Deadweight/Attribution จนถึงมูลค่าปัจจุบันสุทธิ' : 'Outcome-by-outcome audit breakdown from Gross value to Discounted Present Value'}
              </p>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>${t('col_outcome_name', 'ผลลัพธ์')}</th>
                  <th class="num">${t('col_gross_annual', 'มูลค่าขั้นต้น')}</th>
                  <th class="num">${t('col_net_retained', 'สัดส่วนสุทธิ')}</th>
                  <th class="num">${isTh ? 'มูลค่าสุทธิ' : 'Retained Value'}</th>
                  <th class="num">${t('col_present_value', 'มูลค่าปัจจุบัน (PV)')}</th>
                  <th>${t('col_eval_type', 'รูปแบบ')}</th>
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
                        ${l.polarity === 'negative' ? t('polarity_negative', '- ผลเสีย') : t('polarity_positive', '+ ผลดี')}
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

        <!-- Institutional Limitations & Governance Disclaimer Card -->
        <div class="card" style="background: var(--surface-soft); border-left: 4px solid var(--accent);">
          <div style="display: flex; gap: var(--sp-md); align-items: flex-start;">
            <div style="font-size: 1.5rem; line-height: 1;">🛡️</div>
            <div>
              <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--on-background);">
                ${isTh ? 'ข้อจำกัดและธรรมาภิบาลในการตีความผลลัพธ์ SROI (Methodological Limitations & Governance)' : 'Methodological Limitations & Governance'}
              </h3>
              <ul style="font-size: 0.8125rem; line-height: 1.6; color: var(--muted); margin: 0; padding-left: 18px;">
                <li>${isTh ? 'อัตราส่วน SROI เป็นตัวเลขประมาณการตามสมมติฐาน ข้อมูลหลักฐานเชิงประจักษ์ และตัวแทนทางการเงินที่รวบรวมได้ในปัจจุบัน' : 'SROI ratio is an evidence-based estimation based on current assumptions and proxy values.'}</li>
                <li>${isTh ? 'อัตราส่วน SROI เพียงอย่างเดียว ไม่สามารถใช้เป็นข้อสรุปชี้ขาดความสำเร็จหรือความล้มเหลวทั้งหมดของโครงการได้ ต้องพิจารณาบริบทเชิงคุณภาพและพันธกิจของมหาวิทยาลัยควบคู่กัน' : 'The SROI ratio alone does not prove the total success of a project; qualitative university mission contexts must be weighed.'}</li>
                <li>${isTh ? 'การเปรียบเทียบผลลัพธ์ข้ามโครงการควรทำด้วยความระมัดระวัง เนื่องจากแต่ละโครงการมีบริบท กลุ่มเป้าหมาย และระเบียบวิธีที่อาจแตกต่างกัน' : 'Cross-project comparisons should be interpreted cautiously due to varying target population contexts.'}</li>
              </ul>
            </div>
          </div>
        </div>
      `
      }

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(6, {
        canProceed: true,
        nextLabel: isTh ? 'เสร็จสิ้นการประเมิน (กลับสู่รายการโครงการ)' : 'Finish Assessment',
      })}
    </div>
  `;

  document.getElementById('btnSaveRun')?.addEventListener('click', async () => {
    try {
      const run = await runCalculation(activeScenarioId);
      alert(
        isTh
          ? `บันทึกประวัติการคำนวณรอบที่ #${run.run?.id} เรียบร้อยแล้ว!`
          : `Auditable calculation run #${run.run?.id} successfully saved!`,
      );
    } catch (err) {
      alert(`Failed to save run: ${err.message}`);
    }
  });

  document.getElementById('btnExportMenu')?.addEventListener('click', () => {
    openExportReportModal({ project, activeScenarioId });
  });

  attachWizardFooterEvents(container);
}

function openExportReportModal({ project, activeScenarioId }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        ${isTh ? 'สร้างรายงานสรุปผลการประเมินความคุ้มค่าทางสังคมอย่างเป็นทางการ สำหรับเสนอต่อคณะกรรมการ แหล่งทุน หรือผู้บริหารมหาวิทยาลัย' : 'Generate an official reproducible impact report snapshot for university committees or funders.'}
      </p>

      <form id="reportGenForm" class="stack" style="gap: var(--sp-md);">
        <div class="field">
          <label class="field-label">${t('col_report_title', 'ชื่อรายงาน')} *</label>
          <input type="text" name="title" class="input" value="${escapeHtml(project.name)} — รายงานผลการประเมินความคุ้มค่าทางสังคม (SROI)" required />
        </div>
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'ประเภทรายงาน')}</label>
          <select name="type" class="input">
            <option value="detailed" selected>${isTh ? 'รายงานฉบับสมบูรณ์ (Detailed Analysis Report — ครบทุกขั้นตอน)' : 'Detailed Analysis Report (12-section audit trail)'}</option>
            <option value="executive">${isTh ? 'รายงานสรุปสำหรับผู้บริหาร (Executive Summary Report)' : 'Executive Summary Report (Key metrics & findings)'}</option>
          </select>
        </div>
      </form>

      <div style="display: flex; gap: var(--sp-sm); justify-content: flex-end; margin-top: var(--sp-sm);">
        <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
        <button class="btn btn-primary" id="btnCreateAndExport">${t('btn_export_report', 'สร้างเอกสารรายงาน')}</button>
      </div>

      <div id="exportDownloadSection" style="display: none; border-top: 1px solid var(--outline); padding-top: var(--sp-md);">
        <h4 style="font-size: 0.875rem; margin-bottom: var(--sp-sm);">${isTh ? 'ดาวน์โหลดในรูปแบบต่างๆ:' : 'Download Formats:'}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: var(--sp-sm);">
          <button class="btn btn-secondary" id="btnDownloadHtml">🌐 HTML Print View</button>
          <button class="btn btn-secondary" id="btnDownloadPdf">📄 PDF Document</button>
          <button class="btn btn-secondary" id="btnDownloadCsv">📊 CSV Dataset</button>
          <button class="btn btn-secondary" id="btnDownloadJson">📦 JSON Snapshot</button>
          <button class="btn btn-secondary" id="btnShareLink">🔗 สร้างลิงก์สาธารณะ (Share Link)</button>
        </div>
        <div id="shareLinkContainer" style="margin-top: var(--sp-sm); display: none;"></div>
      </div>
    </div>
  `;

  openModal({
    title: isTh ? 'ส่งออกรายงานการประเมิน SROI' : 'Generate & Export Impact Report',
    body: modalHtml,
    size: 'lg',
  });

  let activeReportId = null;

  document.getElementById('btnCreateAndExport')?.addEventListener('click', async () => {
    const form = document.getElementById('reportGenForm');
    const downloadSec = document.getElementById('exportDownloadSection');
    if (!form) return;

    try {
      const runRes = await runCalculation(activeScenarioId);
      const runId = runRes?.run?.id;
      const repRes = await createReport(runId, form.type.value, form.title.value.trim());
      activeReportId = repRes?.id || repRes?.report?.id;

      if (downloadSec) {
        downloadSec.style.display = 'block';
      }
      alert(
        isTh
          ? 'สร้างเอกสารรายงานสำเร็จแล้ว! เลือกรูปแบบการดาวน์โหลดด้านล่าง'
          : 'Report snapshot generated successfully! Choose your download format below.',
      );
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

  document
    .getElementById('btnDownloadHtml')
    ?.addEventListener('click', () => triggerDownload('html'));
  document
    .getElementById('btnDownloadPdf')
    ?.addEventListener('click', () => triggerDownload('pdf'));
  document
    .getElementById('btnDownloadCsv')
    ?.addEventListener('click', () => triggerDownload('csv'));
  document
    .getElementById('btnDownloadJson')
    ?.addEventListener('click', () => triggerDownload('json'));

  document.getElementById('btnShareLink')?.addEventListener('click', async () => {
    if (!activeReportId) return;
    try {
      const res = await api.shareReport(activeReportId);
      const shareUrl =
        res?.data?.url || `${window.location.origin}/api/v1/shared/${res?.data?.token}`;
      const box = document.getElementById('shareLinkContainer');
      if (box) {
        box.innerHTML = `
          <div class="alert alert-success" style="font-size: 0.8125rem;">
            <strong>${isTh ? 'ลิงก์รายงานสำหรับเปิดดูออนไลน์:' : 'Shareable Web Link:'}</strong><br />
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
