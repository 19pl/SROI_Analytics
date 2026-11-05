/**
 * Step 6: Results Dashboard & Plain-Language Executive Summary
 * Guided, beginner-friendly experience for university employees.
 * Explains SROI Ratio, NPV, social impact, assumptions, and institutional limitations.
 * Fully bilingual (Thai & English).
 */

import { getState, runCalculation, createReport, setActiveScenario } from '../../store.js';
import {
  renderStakeholderChart,
  renderOutcomeBarChart,
  renderAnnualTrendChart,
} from '../../components/charts.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht, formatRatio } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api, API_BASE } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';
import { openCalculationTraceModal } from '../../components/calculationTraceModal.js';
import { showToast } from '../../components/toast.js';
import { getReadiness } from '../../utils/readiness.js';
import { openScenarioModal } from '../../components/scenarioModal.js';

export function renderStep6(container) {
  const { project, dashboard, activeScenarioId, reports, review } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__title">${t('alert_select_project_first', 'Please select or create a project first.')}</p></div>`;
    return;
  }

  const isReady = dashboard?.status === 'ready';
  const blockers = getReadiness(review).blockers;
  const result = dashboard?.result || {};
  const summary = result.summary || {};
  const stakeholders = result.stakeholders || [];
  const outcomeLines = result.outcomes || [];
  const annual = result.annual || [];
  const ratio =
    summary.sroi_ratio !== null && summary.sroi_ratio !== undefined
      ? summary.sroi_ratio.toFixed(2)
      : null;

  // Helper to determine step link for a blocker
  const getFixLink = (path = '') => {
    const p = String(path).toLowerCase();
    if (p.includes('cost') || p.includes('investment') || p.includes('discount'))
      return { step: 1, hash: '#/wizard/step-1', label: isTh ? 'ขั้นตอนที่ 1 (เงินลงทุน)' : 'Step 1 (Investment)' };
    if (p.includes('stakeholder'))
      return { step: 2, hash: '#/wizard/step-2', label: isTh ? 'ขั้นตอนที่ 2 (ผู้มีส่วนได้เสีย)' : 'Step 2 (Stakeholders)' };
    if (p.includes('outcome') || p.includes('proxy') || p.includes('quantity'))
      return { step: 3, hash: '#/wizard/step-3', label: isTh ? 'ขั้นตอนที่ 3 (ผลลัพธ์)' : 'Step 3 (Outcomes)' };
    if (p.includes('adjustment') || p.includes('deadweight') || p.includes('attribution'))
      return { step: 4, hash: '#/wizard/step-4', label: isTh ? 'ขั้นตอนที่ 4 (การปรับปรุง)' : 'Step 4 (Adjustments)' };
    return { step: 5, hash: '#/wizard/step-5', label: isTh ? 'ขั้นตอนที่ 5 (ตรวจสอบ)' : 'Step 5 (Review)' };
  };

  container.innerHTML = `
    <div class="form-stack stack-lg">
      <!-- Incomplete Inputs Compact Banner -->
      ${
        !isReady
          ? `
        <div class="panel status--warn">
          <div class="toolbar">
            <div class="cluster stack-sm">
              <span class="status status--warn">${isTh ? 'ข้อมูลไม่ครบถ้วน' : 'Incomplete inputs'}</span>
              <span class="strong">${isTh ? 'ข้อมูลโครงการยังไม่ครบถ้วนสำหรับการคำนวณที่สมบูรณ์' : 'Project inputs are incomplete for full calculation'}</span>
            </div>
            <a href="#/wizard/step-5" class="btn btn-secondary btn-compact">
              ${isTh ? 'ตรวจสอบข้อมูลในขั้นตอนที่ 5' : 'Review in Step 5'}
            </a>
          </div>
          ${
            blockers.length > 0
              ? `
            <div class="cluster stack-xs stack-top-sm">
              ${blockers
                .map((b) => {
                  const fix = getFixLink(b.path);
                  return `<a href="${fix.hash}" class="muted-sm underline">${escapeHtml(b.message)} (${fix.label})</a>`;
                })
                .join(' · ')}
            </div>
          `
              : ''
          }
        </div>
      `
          : ''
      }

      <!-- Top Action Bar -->
      <div class="page-head">
        <div>
          <h1 class="page-head__title">${t('step6_title', 'แดชบอร์ดสรุปผลการประเมิน SROI')}</h1>
          <p class="page-head__sub">
            ${
              isTh
                ? 'ผลลัพธ์อัตราส่วนผลตอบแทนทางสังคม มูลค่าปัจจุบันสุทธิ และข้อสรุปเชิงนโยบาย'
                : 'Social Return on Investment analysis, Net Present Value, and executive summary.'
            }
          </p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn-secondary" id="btnSaveRun">
            ${icons.plus} ${isTh ? 'บันทึกประวัติผลคำนวณ (Audit Run)' : 'Save Calculation Run'}
          </button>
          <button class="btn btn-primary" id="btnExportMenu">
            ${isTh ? 'ส่งออกรายงานทางการ (Export Report)' : 'Export Official Report'}
          </button>
        </div>
      </div>

      <!-- 4 Key Metric Cards -->
      <div class="form-row">
        <!-- Card 1: SROI Ratio -->
        <div class="panel">
          <span class="muted-sm uppercase strong">${t('col_sroi_ratio', 'อัตราส่วนผลตอบแทนทางสังคม (SROI)')}</span>
          <div class="primary-text stat-num--hero">
            ${ratio !== null ? `${ratio} : 1` : '-'}
          </div>
          <p class="muted-sm">
            ${
              ratio !== null
                ? isTh
                  ? `ลงทุนทุก 1 บาท สร้างผลตอบแทนทางสังคม ${ratio} บาท`
                  : `Every 1 Baht invested yields ${ratio} Baht in social value`
                : isTh
                  ? 'ยังไม่สามารถคำนวณได้'
                  : 'Calculation pending'
            }
          </p>
          <button class="btn btn-secondary btn-compact stack-top-sm" id="traceBtn_sroi">
            ${isTh ? 'ดูที่มาการคำนวณ' : 'Calculation Trace'}
          </button>
        </div>

        <!-- Card 2: Total Investment -->
        <div class="panel">
          <span class="muted-sm uppercase strong">${t('col_investment', 'มูลค่าการลงทุนรวม (Present Value)')}</span>
          <div class="stat-num--lg">
            ${project.currency} ${formatBaht(summary.investment_used ?? summary.total_investment_present_value ?? summary.total_investment_nominal ?? 0)}
          </div>
          <p class="muted-sm">${isTh ? 'ต้นทุนรวมที่ปรับลดตามกาลเวลา' : 'Discounted cumulative investment costs'}</p>
          <button class="btn btn-secondary btn-compact stack-top-sm" id="traceBtn_inv">
            ${isTh ? 'ดูที่มาการคำนวณ' : 'Calculation Trace'}
          </button>
        </div>

        <!-- Card 3: Total Social Value -->
        <div class="panel">
          <span class="muted-sm uppercase strong">${t('col_present_value', 'มูลค่าผลกระทบทางสังคมรวม (PV)')}</span>
          <div class="val--positive stat-num--lg">
            ${project.currency} ${formatBaht(summary.present_value_of_impact ?? 0)}
          </div>
          <p class="muted-sm">${isTh ? 'ผลประโยชน์ทางสังคมคิดลดตลอดอายุโครงการ' : 'Discounted cumulative social impact'}</p>
          <button class="btn btn-secondary btn-compact stack-top-sm" id="traceBtn_pv">
            ${isTh ? 'ดูที่มาการคำนวณ' : 'Calculation Trace'}
          </button>
        </div>

        <!-- Card 4: Net Present Value -->
        <div class="panel">
          <span class="muted-sm uppercase strong">${t('card_net_social_value', 'มูลค่าปัจจุบันสุทธิทางสังคม (NPV)')}</span>
          <div class="stat-num--lg">
            ${project.currency} ${formatBaht(summary.net_social_value ?? 0)}
          </div>
          <p class="muted-sm">${isTh ? 'ผลตอบแทนสุทธิหลังหักเงินลงทุน' : 'Net social impact after deducting investment'}</p>
          <button class="btn btn-secondary btn-compact stack-top-sm" id="traceBtn_nsv">
            ${isTh ? 'ดูที่มาการคำนวณ' : 'Calculation Trace'}
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs">
        <button class="tab is-active" data-dash-tab="summary">${isTh ? 'สรุปภาพรวม' : 'Summary'}</button>
        <button class="tab" data-dash-tab="scenarios">${isTh ? 'แบบจำลองสถานการณ์' : 'Scenarios'}</button>
        <button class="tab" data-dash-tab="sensitivity">${isTh ? 'การวิเคราะห์ความอ่อนไหว' : 'Sensitivity'}</button>
        <button class="tab" data-dash-tab="details">${isTh ? 'รายละเอียดผลกระทบ' : 'Details'}</button>
      </div>

      <!-- Tab 1: Summary -->
      <div id="dashTab_summary" class="form-stack stack-lg">
        <!-- Executive Plain-Language Summary Box -->
        <div class="panel panel--soft">
          <h2 class="panel__title">
            ${isTh ? 'บทสรุปผู้บริหารสำหรับเสนอคณะกรรมการ (Executive Synthesis)' : 'Executive Synthesis for Decision-Makers'}
          </h2>
          <p class="muted-sm">
            ${
              isTh
                ? `โครงการ <strong>"${escapeHtml(project.name)}"</strong> ดำเนินการโดย ${escapeHtml(project.faculty_name || 'มหาวิทยาลัยนเรศวร')} ` +
                  `มีระยะเวลาดำเนินงาน ${project.period_months || 12} เดือน จากการประเมินผลตอบแทนทางสังคมจากการลงทุน (SROI) ` +
                  `พบว่าโครงการนี้มีอัตราส่วน SROI เท่ากับ <strong>${ratio !== null ? `${ratio} : 1` : 'อยู่ระหว่างรอข้อมูล'}</strong> ` +
                  `โดยก่อให้เกิดมูลค่าผลกระทบทางสังคมรวม <strong>${project.currency} ${formatBaht(summary.present_value_of_impact ?? 0)}</strong> ` +
                  `จากการลงทุนรวม <strong>${project.currency} ${formatBaht(summary.investment_used ?? summary.total_investment_present_value ?? summary.total_investment_nominal ?? 0)}</strong> ` +
                  `คิดเป็นมูลค่าปัจจุบันสุทธิ (NPV) เท่ากับ <strong>${project.currency} ${formatBaht(summary.net_social_value ?? 0)}</strong> ` +
                  `ซึ่งแสดงให้เห็นว่าโครงการนี้ก่อให้เกิดคุณค่าทางสังคมที่คุ้มค่าต่อการลงทุนของมหาวิทยาลัยและแหล่งทุน`
                : `The project <strong>"${escapeHtml(project.name)}"</strong> represents an investment of ` +
                  `<strong>${project.currency} ${formatBaht(summary.investment_used ?? summary.total_investment_present_value ?? summary.total_investment_nominal ?? 0)}</strong>. ` +
                  `Over the evaluation period, it generates a cumulative discounted social value of ` +
                  `<strong>${project.currency} ${formatBaht(summary.present_value_of_impact ?? 0)}</strong>, ` +
                  `yielding an SROI Ratio of <strong>${ratio !== null ? `${ratio} : 1` : 'pending'}</strong> ` +
                  `and an NPV of <strong>${project.currency} ${formatBaht(summary.net_social_value ?? 0)}</strong>.`
            }
          </p>
        </div>

        <!-- Visual Analytics Grid -->
        <div class="form-row">
          <div class="panel">
            <h3 class="panel__title">${isTh ? 'มูลค่าผลกระทบแยกตามผลลัพธ์ (Outcome Breakdown)' : 'Value per Outcome'}</h3>
            ${renderOutcomeBarChart(outcomeLines)}
          </div>
          <div class="panel">
            <h3 class="panel__title">${isTh ? 'การกระจายผลประโยชน์ตามผู้มีส่วนได้เสีย' : 'Stakeholder Distribution'}</h3>
            ${renderStakeholderChart(stakeholders)}
          </div>
        </div>

        <!-- Annual Trend Chart -->
        <div class="panel">
          <h3 class="panel__title">${isTh ? 'เปรียบเทียบเงินลงทุนและผลตอบแทนทางสังคมรายปี' : 'Annual Investment vs Social Value'}</h3>
          ${renderAnnualTrendChart(annual)}
        </div>

        <!-- Institutional Limitations & Governance Disclaimer Card -->
        <div class="panel panel--soft">
          <h3 class="panel__title">
            ${isTh ? 'ข้อจำกัดและความโปร่งใสทางระเบียบวิธีวิจัย (Methodology & Transparency)' : 'Methodological Integrity & Limitations'}
          </h3>
          <p class="muted-sm">
            ${
              isTh
                ? 'การประเมินนี้คำนวณตามมาตรฐาน Social Value International (SVI) ภายใต้สมมติฐานที่ระบุไว้ในขั้นตอนที่ 1–4 ' +
                  'ตัวแทนทางการเงิน (Financial Proxies) ได้รับการสอบทานจากข้อมูลปฐมภูมิและแหล่งอ้างอิงทางวิชาการ ' +
                  'ผลการคำนวณสะท้อนคุณค่าทางสังคมเฉพาะกลุ่มเป้าหมายที่ระบุ และไม่ได้รวมผลกระทบภายนอกที่อยู่นอกขอบเขตการประเมิน'
                : 'This assessment adheres to Social Value International (SVI) principles. Proxies and impact deductions ' +
                  'reflect primary stakeholder data and documented secondary benchmarks. Results represent direct and indirect ' +
                  'value creation within defined project boundaries.'
            }
          </p>
        </div>
      </div>

      <!-- Tab 2: Scenarios -->
      <div id="dashTab_scenarios" class="form-stack stack-lg" hidden>
        <div class="panel">
          <div class="toolbar">
            <div>
              <h2 class="panel__title">${t('scenarios_title', 'การทดสอบแบบจำลองสถานการณ์ (Scenario Testing)')}</h2>
              <p class="muted-sm">
                ${
                  isTh
                    ? 'เปรียบเทียบอัตราส่วน SROI และมูลค่าผลกระทบภายใต้สมมติฐานทางเลือกต่างๆ'
                    : 'Compare SROI ratios and net social returns across policy scenarios.'
                }
              </p>
            </div>
            <button class="btn btn-secondary btn-compact" id="btnAddScenarioDash">
              ${icons.plus} ${t('btn_add_scenario', 'สร้างสถานการณ์ใหม่')}
            </button>
          </div>
          <div id="scenarioComparisonContainerDash">
            <div class="empty-state">
              <p class="empty-state__text">${t('loading', 'Loading scenario comparisons...')}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Sensitivity -->
      <div id="dashTab_sensitivity" class="form-stack stack-lg" hidden>
        <div class="panel">
          <div class="toolbar">
            <div>
              <h2 class="panel__title">${t('tornado_analysis', 'การวิเคราะห์ความอ่อนไหว (Tornado Sensitivity Analysis)')}</h2>
              <p class="muted-sm">
                ${
                  isTh
                    ? 'ระบุตัวแปรที่มีอิทธิพลสูงสุดต่อความแกว่งของผลลัพธ์ SROI เมื่อสมมติฐานเปลี่ยนแปลง ±20%'
                    : 'Identify parameters creating the highest variance in SROI outcome (±20% variation).'
                }
              </p>
            </div>
          </div>
          <div id="sensitivityContainerDash">
            <div class="empty-state">
              <p class="empty-state__text">${t('loading', 'Loading sensitivity analysis...')}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 4: Details -->
      <div id="dashTab_details" class="form-stack stack-lg" hidden>
        <div class="panel">
          <h2 class="panel__title">
            ${isTh ? 'ตารางจำแนกองค์ประกอบผลลัพธ์รายข้อ (Detailed Impact Composition)' : 'Detailed Impact Composition Table'}
          </h2>
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>${t('col_outcome_name', 'ผลลัพธ์การเปลี่ยนแปลง')}</th>
                  <th>${t('col_stakeholder', 'ผู้มีส่วนได้เสีย')}</th>
                  <th class="num">${isTh ? 'มูลค่าขั้นต้น/ปี' : 'Gross/Year'}</th>
                  <th class="num">${isTh ? 'หักลด (Net %)' : 'Net Retained'}</th>
                  <th class="num">${isTh ? 'มูลค่าสุทธิคิดลด (PV)' : 'Net PV'}</th>
                  <th class="num">${isTh ? 'สัดส่วน' : 'Share'}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  outcomeLines.length === 0
                    ? `<tr><td colspan="6" class="empty-state">${t('no_data', 'No outcomes evaluated.')}</td></tr>`
                    : outcomeLines
                        .map((o) => {
                          const netPct = ((o.net_impact_ratio ?? 1) * 100).toFixed(0);
                          const pvVal = o.present_value ?? 0;
                          const totalPv = summary.present_value_of_impact || 1;
                          const share = ((pvVal / totalPv) * 100).toFixed(1);
                          return `
                        <tr>
                          <td class="strong">${escapeHtml(o.outcome_name)}</td>
                          <td>${escapeHtml(o.stakeholder_name || '-')}</td>
                          <td class="num">${project.currency} ${formatBaht(o.annual_gross_value)}</td>
                          <td class="num">${netPct}%</td>
                          <td class="num strong val--positive">${project.currency} ${formatBaht(pvVal)}</td>
                          <td class="num muted-sm">${share}%</td>
                        </tr>
                      `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(6, {
        canProceed: true,
        nextLabel: isTh ? 'เสร็จสิ้นการประเมิน (กลับสู่รายการโครงการ)' : 'Finish Assessment',
      })}
    </div>
  `;

  // Tab switching logic
  const tabButtons = container.querySelectorAll('[data-dash-tab]');
  const tabPanels = {
    summary: document.getElementById('dashTab_summary'),
    scenarios: document.getElementById('dashTab_scenarios'),
    sensitivity: document.getElementById('dashTab_sensitivity'),
    details: document.getElementById('dashTab_details'),
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.dashTab;
      tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      Object.keys(tabPanels).forEach((k) => {
        if (tabPanels[k]) {
          tabPanels[k].hidden = k !== tabKey;
        }
      });
    });
  });

  document.getElementById('btnSaveRun')?.addEventListener('click', async () => {
    try {
      const run = await runCalculation(activeScenarioId);
      showToast(
        isTh
          ? `บันทึกประวัติการคำนวณรอบที่ #${run?.run?.id || ''} เรียบร้อยแล้ว`
          : `Auditable calculation run #${run?.run?.id || ''} successfully saved`,
        'success',
      );
    } catch (err) {
      showToast(`Failed to save run: ${err.message}`, 'error');
    }
  });

  document.getElementById('btnExportMenu')?.addEventListener('click', () => {
    openExportReportModal({ project, activeScenarioId });
  });

  attachWizardFooterEvents(container);

  // Wire trace buttons
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
      if (list.length === 0) {
        target.innerHTML = `<div class="empty-state"><p class="empty-state__text">${t('no_data', 'No scenarios configured yet.')}</p></div>`;
        return;
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="table table--compact">
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
              ${list
                .map((sc) => {
                  const isSelected = sc.id === activeScenarioId || (!activeScenarioId && sc.is_base);
                  return `
                <tr class="${isSelected ? 'panel--soft' : ''}">
                  <td class="strong">${escapeHtml(sc.name)}</td>
                  <td><span class="status status--neutral">${escapeHtml(sc.kind)}</span></td>
                  <td class="num strong primary-text stat-num--md">
                    ${sc.sroi_ratio !== null ? `${sc.sroi_ratio.toFixed(2)} : 1` : '-'}
                  </td>
                  <td class="num">${project.currency} ${formatBaht(sc.present_value)}</td>
                  <td class="num">${project.currency} ${formatBaht(sc.investment)}</td>
                  <td class="num strong">${project.currency} ${formatBaht(sc.net_social_value)}</td>
                  <td>
                    ${
                      isSelected
                        ? `<span class="status status--ok">${isTh ? 'ใช้งานอยู่' : 'Active'}</span>`
                        : `<button class="btn btn-secondary btn-compact" data-select-scenario="${sc.id}">${isTh ? 'สลับมาใช้' : 'Switch'}</button>`
                    }
                  </td>
                </tr>
              `;
                })
                .join('')}
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
      if (rows.length === 0) {
        target.innerHTML = `<div class="empty-state"><p class="empty-state__text">${isTh ? 'การวิเคราะห์ความอ่อนไหวต้องการผลลัพธ์ที่ประเมินมูลค่าอย่างน้อย 1 รายการ' : 'Sensitivity analysis requires at least one monetized outcome.'}</p></div>`;
        return;
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="table table--compact">
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
              ${rows
                .slice(0, 10)
                .map(
                  (r) => `
                <tr>
                  <td class="strong">${escapeHtml(r.parameter)}</td>
                  <td>${escapeHtml(r.label || '-')}</td>
                  <td class="num">${r.sroi_ratio_low !== null ? `${r.sroi_ratio_low.toFixed(2)} : 1` : '-'}</td>
                  <td class="num">${r.sroi_ratio_high !== null ? `${r.sroi_ratio_high.toFixed(2)} : 1` : '-'}</td>
                  <td class="num strong primary-text">
                    ${project.currency} ${formatBaht(r.swing_present_value)}
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    document.getElementById('btnAddScenarioDash')?.addEventListener('click', () => {
      openScenarioModal({ onSave: () => renderStep6(container) });
    });
  }
}

function openExportReportModal({ project, activeScenarioId }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const L = (th, en) => (isTh ? th : en);

  const CSV_DATASETS = [
    ['outcomes', L('ผลลัพธ์แยกตามปี', 'Outcomes by year')],
    ['investment', L('รายการเงินลงทุน', 'Investment items')],
    ['results', L('ตัวเลขสรุปหลัก', 'Headline results')],
    ['annual', L('สรุปรายปี', 'Annual totals')],
    ['stakeholders', L('แยกตามผู้มีส่วนได้ส่วนเสีย', 'By stakeholder')],
  ];

  const row = ({ tag, title, desc, extra = '', action }) => `
    <li class="exp-row">
      <span class="exp-tag" aria-hidden="true">${tag}</span>
      <div class="exp-row__main">
        <div class="exp-row__title">${title}</div>
        <div class="exp-row__desc">${desc}</div>
        ${extra}
      </div>
      <div class="exp-row__action">${action}</div>
    </li>`;

  const modalHtml = `
    <div class="exp">
      <!-- Step 1: create the report -->
      <div id="expStepCreate" class="form-stack stack-md">
        <p class="muted-sm">
          ${L(
            'สร้างรายงานสรุปผลการประเมินความคุ้มค่าทางสังคมอย่างเป็นทางการ สำหรับเสนอต่อคณะกรรมการ แหล่งทุน หรือผู้บริหารมหาวิทยาลัย แล้วเลือกรูปแบบไฟล์ในขั้นถัดไป',
            'Create an official, reproducible impact report for committees or funders. You will choose the file format in the next step.',
          )}
        </p>

        <form id="reportGenForm" class="form-stack">
          <div class="field">
            <label class="field-label" for="expTitle">${t('col_report_title', 'ชื่อรายงาน')} <span class="field-hint field-hint--primary">${L('จำเป็น', 'Required')}</span></label>
            <input type="text" id="expTitle" name="title" class="input" value="${escapeHtml(project.name)} — ${L('รายงานผลการประเมินความคุ้มค่าทางสังคม (SROI)', 'SROI Social Impact Assessment Report')}" required />
          </div>
          <div class="field">
            <label class="field-label" for="expType">${t('col_eval_type', 'ประเภทรายงาน')}</label>
            <select id="expType" name="type" class="input">
              <option value="detailed" selected>${L('รายงานฉบับสมบูรณ์ (ครบทุกขั้นตอน)', 'Detailed report (full audit trail)')}</option>
              <option value="executive">${L('รายงานสรุปสำหรับผู้บริหาร', 'Executive summary (key metrics & findings)')}</option>
            </select>
          </div>
        </form>

        <div class="cluster cluster--end">
          <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
          <button type="button" class="btn btn-primary" id="btnCreateAndExport">${L('สร้างรายงาน', 'Create report')}</button>
        </div>
      </div>

      <!-- Step 2: pick a format (replaces step 1 once the report exists) -->
      <div id="expStepResult" class="form-stack stack-md" hidden>
        <div class="exp-ready">
          <span class="exp-ready__tick" aria-hidden="true">✓</span>
          <div>
            <div class="strong">${L('สร้างรายงานเรียบร้อยแล้ว', 'Report created')}</div>
            <div class="muted-sm" id="expReadyTitle"></div>
          </div>
        </div>

        <ul class="exp-list">
          ${row({
            tag: 'PDF',
            title: L('PDF (แนะนำ)', 'PDF (recommended)'),
            desc: L('เปิดหน้าต่างพิมพ์ แล้วเลือก “Save as PDF” — แสดงภาษาไทยได้ครบถ้วน', 'Opens your print dialog, choose “Save as PDF”. Shows Thai text correctly.'),
            action: `<button type="button" class="btn btn-primary btn-compact" id="btnPrintPdf">${L('เปิดหน้าต่างพิมพ์', 'Print / Save PDF')}</button>`,
          })}
          ${row({
            tag: 'CSV',
            title: L('ข้อมูลสำหรับ Excel (CSV)', 'Spreadsheet data (CSV)'),
            desc: L('เลือกตารางข้อมูลที่ต้องการดาวน์โหลด', 'Choose which data table to download.'),
            extra: `<label class="exp-select"><span class="sr-only">${L('ตารางข้อมูล', 'Data table')}</span>
              <select id="csvDataset" class="input">${CSV_DATASETS.map(([v, label]) => `<option value="${v}">${escapeHtml(label)}</option>`).join('')}</select></label>`,
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadCsv">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'HTML',
            title: L('หน้าเว็บรายงาน (HTML)', 'Web page (HTML)'),
            desc: L('ไฟล์เดียวที่เปิดในเบราว์เซอร์และพิมพ์ได้', 'A single file you can open in a browser and print.'),
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadHtml">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'JSON',
            title: L('สแนปช็อตข้อมูลทั้งหมด (JSON)', 'Full data snapshot (JSON)'),
            desc: L('สำหรับตรวจสอบย้อนหลังหรือนำไปประมวลผลต่อ', 'For auditing or further processing.'),
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadJson">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'LINK',
            title: L('ลิงก์แชร์ (อ่านอย่างเดียว)', 'Share link (read-only)'),
            desc: L('ใครก็ตามที่มีลิงก์เปิดดูรายงานได้ ไม่ต้องเข้าสู่ระบบ ใช้ได้ 30 วัน', 'Anyone with the link can view the report without signing in. Valid for 30 days.'),
            extra: '<div id="shareLinkContainer" hidden></div>',
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnShareLink">${L('สร้างลิงก์', 'Create link')}</button>`,
          })}
        </ul>

        <details class="exp-more">
          <summary>${L('ตัวเลือกอื่นๆ', 'More options')}</summary>
          <div class="exp-more__body">
            <span class="muted-sm">${L('ไฟล์ PDF พื้นฐานจากเซิร์ฟเวอร์ รองรับเฉพาะตัวอักษรละติน (ภาษาไทยจะไม่แสดง)', 'Basic server-made PDF file. Latin characters only; Thai text will not show.')}</span>
            <button type="button" class="btn btn-secondary btn-compact" id="btnDownloadPdf">${L('ดาวน์โหลด PDF พื้นฐาน', 'Download basic PDF')}</button>
          </div>
        </details>

        <div class="cluster cluster--space-between">
          <button type="button" class="btn btn-secondary" id="btnExpBack">← ${L('สร้างรายงานใหม่', 'Create another')}</button>
          <button type="button" class="btn btn-primary" data-modal-close>${L('เสร็จสิ้น', 'Done')}</button>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: L('ส่งออกรายงานการประเมิน SROI', 'Export Impact Report'),
    body: modalHtml,
    size: 'lg',
  });

  let activeReportId = null;

  const stepCreate = document.getElementById('expStepCreate');
  const stepResult = document.getElementById('expStepResult');
  const showStep = (step) => {
    stepCreate.hidden = step !== 'create';
    stepResult.hidden = step !== 'result';
  };

  /** disable a button and show "Preparing…" while its async action runs */
  const busy = async (btn, fn) => {
    if (!btn || btn.disabled) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = L('กำลังเตรียมไฟล์…', 'Preparing…');
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  // ---- Step 1: create ------------------------------------------------------------------------
  const generate = async () => {
    const form = document.getElementById('reportGenForm');
    const genBtn = document.getElementById('btnCreateAndExport');
    if (!form || genBtn?.disabled) return;
    const title = form.title.value.trim();
    if (!title) {
      showToast(L('กรุณาระบุชื่อรายงาน', 'Please enter a report title.'), 'error');
      form.title.focus();
      return;
    }

    const label = genBtn.textContent;
    genBtn.disabled = true;
    genBtn.textContent = L('กำลังสร้างรายงาน…', 'Creating report…');
    try {
      const runRes = await runCalculation(activeScenarioId);
      const runId = runRes?.run?.id;
      const repRes = await createReport(runId, form.type.value, title, activeScenarioId);
      activeReportId = repRes?.id || repRes?.report?.id;
      if (!activeReportId) throw new Error('The server did not return a report id.');

      document.getElementById('expReadyTitle').textContent = title;
      const link = document.getElementById('shareLinkContainer');
      link.hidden = true; // a new report invalidates any link shown for the previous one
      link.innerHTML = '';
      showStep('result');
    } catch (err) {
      showToast(`Report generation failed: ${err.message}`, 'error');
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = label;
    }
  };

  document.getElementById('btnCreateAndExport')?.addEventListener('click', generate);
  // Enter in the title box used to submit the <form> natively and reload the whole app
  document.getElementById('reportGenForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    generate();
  });
  document.getElementById('btnExpBack')?.addEventListener('click', () => showStep('create'));

  // ---- Step 2: formats -----------------------------------------------------------------------
  const saveBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const download = async (format) => {
    try {
      const dataset = format === 'csv' ? document.getElementById('csvDataset')?.value || 'outcomes' : null;
      const blob = await api.exportReport(activeReportId, format, dataset, lang);
      saveBlob(blob, `SROI_Report_${project.id}_${activeReportId}${dataset ? `_${dataset}` : ''}.${format}`);
      showToast(L('เริ่มดาวน์โหลดไฟล์แล้ว', 'Download started'), 'info');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  // Full-Unicode PDF: render the HTML report in a hidden frame and let the browser print it ("Save as PDF").
  const printAsPdf = async () => {
    try {
      const html = await (await api.exportReport(activeReportId, 'html', null, lang)).text();
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      const prevTitle = document.title;
      const cleanup = () => {
        document.title = prevTitle;
        frame.remove();
      };
      frame.onload = () => {
        const w = frame.contentWindow;
        document.title = w.document.title || prevTitle; // becomes the suggested PDF file name
        w.onafterprint = cleanup;
        w.focus();
        w.print();
        setTimeout(cleanup, 120000);
      };
      frame.srcdoc = html;
      document.body.appendChild(frame);
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const bind = (id, fn) => {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => busy(btn, fn));
  };
  bind('btnPrintPdf', printAsPdf);
  bind('btnDownloadCsv', () => download('csv'));
  bind('btnDownloadHtml', () => download('html'));
  bind('btnDownloadJson', () => download('json'));
  bind('btnDownloadPdf', () => download('pdf'));

  bind('btnShareLink', async () => {
    try {
      const res = await api.shareReport(activeReportId);
      // The API lives on its own origin (not the frontend's). ?format=html makes the link open as a readable page.
      const apiOrigin = API_BASE.replace(/\/api\/v1\/?$/, '');
      const shareUrl = res?.data?.url || `${apiOrigin}${res?.data?.path || `/api/v1/shared/${res?.data?.token}`}?format=html&lang=${lang === 'th' ? 'th' : 'en'}`;
      const box = document.getElementById('shareLinkContainer');
      if (!box) return;
      box.innerHTML = `
        <div class="exp-link">
          <input type="text" class="input" readonly value="${escapeHtml(shareUrl)}" id="shareUrlInput" aria-label="${L('ลิงก์แชร์', 'Share link')}" />
          <button type="button" class="btn btn-secondary btn-compact" id="btnCopyShareUrl">${L('คัดลอก', 'Copy')}</button>
        </div>`;
      box.hidden = false;
      const input = document.getElementById('shareUrlInput');
      input?.addEventListener('focus', () => input.select());
      document.getElementById('btnCopyShareUrl')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch (e) {
          input?.select();
          document.execCommand?.('copy');
        }
        showToast(L('คัดลอกลิงก์แล้ว', 'Link copied to clipboard'), 'success');
      });
    } catch (err) {
      showToast(`Failed to create share link: ${err.message}`, 'error');
    }
  });
}