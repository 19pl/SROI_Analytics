/**
 * Step 6: Results Dashboard & Plain-Language Executive Summary
 * Guided, beginner-friendly experience for university employees.
 * Explains SROI Ratio, NPV, social impact, assumptions, and institutional limitations.
 * Fully bilingual (Thai & English).
 */

import { getState, runCalculation, createReport, loadReports, setActiveScenario, addScenario } from '../../store.js';
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
import { openCalculationTraceModal } from '../../components/calculationTraceModal.js';

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
            <button class="btn btn-secondary" id="traceBtn_sroi" style="margin-top: 10px; font-size: 0.75rem; height: 28px; padding: 0 10px;">
              🔎 ${isTh ? 'ดูที่มาของตัวเลข' : 'How was this calculated?'}
            </button>
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
            <button class="btn btn-secondary" id="traceBtn_pv" style="margin-top: 10px; font-size: 0.75rem; height: 28px; padding: 0 10px;">
              🔎 ${isTh ? 'ดูที่มาของตัวเลข' : 'How was this calculated?'}
            </button>
          </div>

          <!-- Card 3: Total Investment -->
          <div class="stat-card">
            <div class="stat-label">${t('card_total_investment', 'เงินลงทุนรวม')}</div>
            <div class="stat-val" style="color: var(--warning);">
              ${project.currency} ${formatBaht(summary.investment_used || 0)}
            </div>
            <div class="stat-sub">${t('inv_basis_label', 'เกณฑ์')}: ${project.investment_basis === 'present_value' ? t('inv_basis_pv', 'มูลค่าปัจจุบัน') : t('inv_basis_nominal', 'ตามมูลค่าเงินสด')}</div>
            <button class="btn btn-secondary" id="traceBtn_inv" style="margin-top: 10px; font-size: 0.75rem; height: 28px; padding: 0 10px;">
              🔎 ${isTh ? 'ดูที่มาของตัวเลข' : 'How was this calculated?'}
            </button>
          </div>

          <!-- Card 4: Net Social Value -->
          <div class="stat-card">
            <div class="stat-label">${t('card_net_social_value', 'มูลค่าปัจจุบันสุทธิ (NPV)')}</div>
            <div class="stat-val">
              ${(summary.net_social_value || 0) >= 0 ? '+' : ''}${project.currency} ${formatBaht(summary.net_social_value || 0)}
            </div>
            <div class="stat-sub">${isTh ? 'ผลตอบแทนทางสังคมสุทธิ:' : 'Net Return:'} ${summary.net_return_pct !== null && summary.net_return_pct !== undefined ? summary.net_return_pct + '%' : '-'}</div>
            <button class="btn btn-secondary" id="traceBtn_nsv" style="margin-top: 10px; font-size: 0.75rem; height: 28px; padding: 0 10px;">
              🔎 ${isTh ? 'ดูที่มาของตัวเลข' : 'How was this calculated?'}
            </button>
          </div>
        </div>

        <!-- Visual Analytics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--sp-lg);">
          <!-- A. Outcome Valuation Breakdown (most actionable — shown first) -->
          <div class="chart-card">
            <div class="chart-title">A. ${isTh ? 'การแจกแจงมูลค่าตามผลลัพธ์แต่ละด้าน' : 'Outcome Valuation Breakdown'}</div>
            <div class="chart-subtitle">${isTh ? 'มูลค่าปัจจุบันสุทธิที่เกิดจากการเปลี่ยนแปลงแต่ละรายการ' : 'Net present value generated across outcomes'}</div>
            ${renderOutcomeBarChart(outcomeLines)}
          </div>

          <!-- B. Stakeholder Value Distribution -->
          <div class="chart-card">
            <div class="chart-title">B. ${isTh ? 'การกระจายมูลค่าทางสังคมตามกลุ่มผู้มีส่วนได้ส่วนเสีย' : 'Social Value by Stakeholder Group'}</div>
            <div class="chart-subtitle">${isTh ? 'สัดส่วนคุณค่าที่ตกแก่กลุ่มเป้าหมาย นิสิต ชุมชน และมหาวิทยาลัย' : 'Distribution among affected beneficiaries'}</div>
            ${renderStakeholderChart(stakeholders)}
          </div>
        </div>

        <!-- C. Annual Investment vs Social Value -->
        <div class="chart-card">
          <div class="chart-title">C. ${isTh ? 'แนวโน้มเปรียบเทียบเงินลงทุนกับมูลค่าทางสังคมรายปี' : 'Annual Investment versus Social Impact'}</div>
          <div class="chart-subtitle">${isTh ? 'มูลค่าผลประโยชน์สุทธิหลังหักลดทอนตามกาลเวลา (Drop-off)' : 'Net discounted benefits after deductions and drop-off'}</div>
          ${renderAnnualTrendChart(annual)}
        </div>

        <!-- D. Detailed Impact Composition Table (collapsed by default — deep dive) -->
        <details class="card" style="padding: 0;">
          <summary style="cursor: pointer; padding: var(--sp-md) var(--sp-lg); display: flex; justify-content: space-between; align-items: center; list-style: none; gap: var(--sp-sm);">
            <div>
              <span style="font-weight: 700; font-size: 0.9375rem; color: var(--on-background);">
                D. ${isTh ? 'ตารางตรวจสอบความโปร่งใสของผลลัพธ์ (Impact Audit Table)' : 'Detailed Impact Composition Table'}
              </span>
              <span class="muted" style="font-size: 0.8125rem; display: block; margin-top: 2px;">
                ${isTh ? 'คลิกเพื่อดูรายละเอียด — แจกแจงตั้งแต่มูลค่าขั้นต้น หักลบ Deadweight/Attribution จนถึงมูลค่าปัจจุบันสุทธิ' : 'Click to expand — outcome-by-outcome audit from Gross to Discounted PV'}
              </span>
            </div>
            <span class="badge badge-planned" style="flex-shrink: 0;">${outcomeLines.length} ${isTh ? 'ผลลัพธ์' : 'outcomes'}</span>
          </summary>
          <div style="padding: 0 var(--sp-lg) var(--sp-lg);">
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
        </details>


        <!-- E. Scenario Analysis & Sensitivity (relocated from Step 5) -->
        <div class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">${t('scenarios_title', 'การทดสอบแบบจำลองสถานการณ์ (Scenario Testing)')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                ${isTh ? 'เปรียบเทียบผลลัพธ์ในสถานการณ์แบบระมัดระวัง (Conservative), ปกติ (Base Case), และเชิงบวก (Optimistic)' : 'Compare Conservative, Base case, and Optimistic assumptions'}
              </p>
            </div>
            <button class="btn btn-secondary" id="btnAddScenarioDash">${t('btn_add_scenario', '+ สร้างสถานการณ์ใหม่')}</button>
          </div>
          <div id="scenarioComparisonContainerDash">
            <div class="muted">${t('loading', 'กำลังโหลดข้อมูลสถานการณ์...')}</div>
          </div>
        </div>

        <!-- F. Tornado Sensitivity Analysis -->
        <div class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">${t('tornado_analysis', 'การวิเคราะห์ความอ่อนไหว (Tornado Sensitivity Analysis)')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">
                ${isTh ? 'แสดงให้เห็นว่าตัวแปรหรือสมมติฐานใดส่งผลต่อความแกว่งของอัตราส่วน SROI มากที่สุด' : 'Identifies which individual assumptions create the largest swings in the final result'}
              </p>
            </div>
          </div>
          <div id="sensitivityContainerDash">
            <div class="muted">${t('loading', 'กำลังโหลดการวิเคราะห์ความอ่อนไหว...')}</div>
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

  // Wire [🔎 ดูที่มา] trace buttons on the 4 metric cards
  if (isReady) {
    document.getElementById('traceBtn_sroi')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'sroi_ratio', project, result: dashboard?.result });
    });
    document.getElementById('traceBtn_pv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'present_value', project, result: dashboard?.result });
    });
    document.getElementById('traceBtn_inv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'total_investment', project, result: dashboard?.result });
    });
    document.getElementById('traceBtn_nsv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'sroi_ratio', project, result: dashboard?.result });
    });

    // Load Scenario Comparison into Dashboard
    api.getScenarioComparison(project.id).then((res) => {
      const list = res?.data || [];
      const target = document.getElementById('scenarioComparisonContainerDash');
      if (!target) return;
      const isTh = getLanguage() !== 'en';
      if (list.length === 0) {
        target.innerHTML = `<div class="muted" style="padding: 16px;">${t('no_data', 'No scenarios configured yet.')}</div>`;
        return;
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_scenario', 'ชื่อสถานการณ์')}</th>
                <th>${t('col_eval_type', 'ลักษณะ')}</th>
                <th class="num">${t('col_sroi_ratio', 'อัตราส่วน SROI')}</th>
                <th class="num">${t('col_present_value', 'มูลค่าปัจจุบัน (PV)')}</th>
                <th class="num">${t('col_investment', 'เงินลงทุน')}</th>
                <th class="num">${t('card_net_social_value', 'มูลค่าปัจจุบันสุทธิ (NPV)')}</th>
                <th>${t('col_actions', 'จัดการ')}</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((sc) => {
                const isSelected = sc.id === activeScenarioId || (!activeScenarioId && sc.is_base);
                return `
                <tr style="${isSelected ? 'background: var(--primary-soft);' : ''}">
                  <td class="strong">${escapeHtml(sc.name)}</td>
                  <td><span class="badge badge-planned">${escapeHtml(sc.kind)}</span></td>
                  <td class="num strong" style="color: var(--primary); font-size: 1.125rem;">
                    ${sc.sroi_ratio !== null ? `${sc.sroi_ratio.toFixed(2)} : 1` : '-'}
                  </td>
                  <td class="num">${project.currency} ${formatBaht(sc.present_value)}</td>
                  <td class="num">${project.currency} ${formatBaht(sc.investment)}</td>
                  <td class="num strong">${project.currency} ${formatBaht(sc.net_social_value)}</td>
                  <td>
                    ${isSelected
                      ? `<span class="badge badge-production">${isTh ? 'ใช้งานอยู่' : 'Active'}</span>`
                      : `<button class="btn btn-secondary" data-select-scenario="${sc.id}" style="height: 28px; font-size: 0.75rem;">${isTh ? 'สลับมาใช้' : 'Switch'}</button>`
                    }
                  </td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      target.querySelectorAll('[data-select-scenario]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scId = Number(btn.dataset.selectScenario);
          await setActiveScenario(scId);
          renderStep6(container);
        });
      });
    });

    // Load Tornado Sensitivity into Dashboard
    api.getSensitivity(project.id).then((res) => {
      const rows = res?.data?.rows || [];
      const target = document.getElementById('sensitivityContainerDash');
      if (!target) return;
      const isTh = getLanguage() !== 'en';
      if (rows.length === 0) {
        target.innerHTML = `<div class="muted" style="padding: 16px;">${isTh ? 'การวิเคราะห์ความอ่อนไหวต้องการผลลัพธ์ที่ประเมินมูลค่าอย่างน้อย 1 รายการ' : 'Sensitivity analysis requires at least one monetized outcome.'}</div>`;
        return;
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${isTh ? 'ตัวแปรสมมติฐาน' : 'Parameter'}</th>
                <th>${t('col_outcome_name', 'ผลลัพธ์ / บริบท')}</th>
                <th class="num">${isTh ? 'กรณีต่ำสุด (Low)' : 'Low Value Ratio'}</th>
                <th class="num">${isTh ? 'กรณีสูงสุด (High)' : 'High Value Ratio'}</th>
                <th class="num">${isTh ? 'ช่วงความแกว่ง (มูลค่า PV)' : 'Swing (Present Value)'}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 10).map((r) => `
                <tr>
                  <td class="strong">${escapeHtml(r.parameter)}</td>
                  <td>${escapeHtml(r.label || '-')}</td>
                  <td class="num">${r.sroi_ratio_low !== null ? `${r.sroi_ratio_low.toFixed(2)} : 1` : '-'}</td>
                  <td class="num">${r.sroi_ratio_high !== null ? `${r.sroi_ratio_high.toFixed(2)} : 1` : '-'}</td>
                  <td class="num strong" style="color: var(--primary);">
                    ${project.currency} ${formatBaht(r.swing_present_value)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    document.getElementById('btnAddScenarioDash')?.addEventListener('click', () => {
      openAddScenarioModal({ project, onSaved: () => renderStep6(container) });
    });
  }
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
function openAddScenarioModal({ project, onSaved }) {
  const isTh = getLanguage() !== 'en';

  const formHtml = `
    <form id="scenarioFormDash" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('col_scenario', 'ชื่อสถานการณ์')} *</label>
        <input type="text" name="name" class="input" required placeholder="${isTh ? 'เช่น สถานการณ์แบบระมัดระวัง (ลดทอนผลลัพธ์ 20%)' : 'e.g. Conservative Cohort Retention'}" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'ประเภทสถานการณ์')} *</label>
          <select name="kind" class="input" required>
            <option value="conservative">${isTh ? 'สถานการณ์แบบระมัดระวัง (Conservative)' : 'Conservative Scenario'}</option>
            <option value="optimistic">${isTh ? 'สถานการณ์เชิงบวก (Optimistic)' : 'Optimistic Scenario'}</option>
            <option value="custom">${isTh ? 'สถานการณ์เฉพาะนโยบาย (Custom Policy)' : 'Custom Policy Scenario'}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'อัตราคิดลดเฉพาะสถานการณ์นี้ (%)' : 'Global Discount Rate Override (%)'}</label>
          <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" placeholder="${isTh ? 'เว้นว่างเพื่อใช้อัตราตามโครงการเดิม' : 'Leave blank to use base rate'}" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">${t('description', 'คำอธิบายและสมมติฐาน')}</label>
        <textarea name="description" class="input" rows="2" placeholder="${isTh ? 'ระบุเหตุผลและสมมติฐานของการทดสอบสถานการณ์นี้' : 'Document the purpose of this sensitivity scenario'}"></textarea>
      </div>
      <div id="scenarioDashModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: isTh ? 'สร้างแบบจำลองสถานการณ์ใหม่ (Add Scenario)' : 'Create Alternative Scenario',
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
      <button class="btn btn-primary" id="btnSaveScenarioDash">${isTh ? 'บันทึกสถานการณ์' : 'Create Scenario'}</button>
    `,
  });

  document.getElementById('btnSaveScenarioDash')?.addEventListener('click', async () => {
    const form = document.getElementById('scenarioFormDash');
    const errBox = document.getElementById('scenarioDashModalError');
    if (!form) return;

    const rateVal = form.discount_rate.value ? parseFloat(form.discount_rate.value) / 100 : null;
    const data = {
      name: form.name.value.trim(),
      kind: form.kind.value,
      description: form.description.value.trim(),
      assumptions: {
        global: rateVal !== null ? { discount_rate: rateVal } : {},
        outcomes: {},
      },
    };

    if (!data.name) {
      if (errBox) {
        errBox.textContent = isTh ? 'กรุณาระบุชื่อสถานการณ์' : 'Please enter a scenario name.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      await addScenario(data);
      closeModal();
      onSaved();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
