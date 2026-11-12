/**
 * Step 6: SROI Analytics Dashboard & Results
 *
 * Results-first, flexible evaluation dashboard.
 * - No text clutter / no AI filler.
 * - Direct KPI metric cards (Base vs What-If live comparison).
 * - 9+ Flexible input sliders (Investment Money, Quantity, Proxy Value, Duration,
 *   Deadweight, Attribution, Displacement, Drop-off, Discount Rate).
 * - Visual Charts (Pie/Doughnut Stakeholder Distribution, Bar Chart, Annual Trend).
 * - Clean tabular breakdowns.
 */

import { getState, runCalculation, createReport, setActiveScenario } from '../../store.js';
import {
  renderStakeholderChart,
  renderOutcomeBarChart,
  renderAnnualTrendChart,
} from '../../components/charts.js';
import { openModal } from '../../components/modal.js';
import { formatBaht, formatBahtCompact } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api, API_BASE } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { reqTag, optTag } from '../../utils/fieldTags.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';
import { openCalculationTraceModal } from '../../components/calculationTraceModal.js';
import { openScenarioModal } from '../../components/scenarioModal.js';
import { showToast } from '../../components/toast.js';
import { getReadiness } from '../../utils/readiness.js';

export function renderStep6(container) {
  const { project, dashboard, activeScenarioId, review, outcomes } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const L = (th, en) => (isTh ? th : en);

  if (!project) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">${L('กรุณาเลือกหรือสร้างโครงการก่อน', 'Please select or create a project first.')}</p>
      </div>`;
    return;
  }

  const cur = project.currency || '฿';
  const isReady = dashboard?.status === 'ready';
  const blockers = getReadiness(review).blockers;

  const result = dashboard?.result || {};
  const summary = result.summary || {};
  const stakeholders = result.stakeholders || [];
  const outcomeLines = result.outcomes || [];
  const annual = result.annual || [];

  const baseInv = Number(
    summary.investment_used ??
      summary.total_investment_present_value ??
      summary.total_investment_nominal ??
      0,
  );
  const basePv = Number(summary.present_value_of_impact ?? 0);
  const baseRatio =
    summary.sroi_ratio != null ? Number(summary.sroi_ratio) : baseInv > 0 ? basePv / baseInv : null;
  const baseNsv = Number(summary.net_social_value ?? basePv - baseInv);
  const baseDiscountRate = project.discount_rate != null ? Number(project.discount_rate) * 100 : 5;
  const periodYears = Number(project.analysis_period_years ?? 3);

  // Baseline averages for impact adjustments
  let avgDw = 0.15;
  let avgAt = 0.15;
  let avgDp = 0.05;
  let avgDo = 0.1;
  if (outcomeLines.length > 0) {
    let sumDw = 0,
      sumAt = 0,
      sumDp = 0,
      sumDo = 0,
      count = 0;
    outcomeLines.forEach((o) => {
      const eff = o.effective || {};
      if (eff.deadweight != null) sumDw += eff.deadweight;
      if (eff.attribution != null) sumAt += eff.attribution;
      if (eff.displacement != null) sumDp += eff.displacement;
      if (eff.drop_off != null) sumDo += eff.drop_off;
      count++;
    });
    if (count > 0) {
      avgDw = sumDw / count;
      avgAt = sumAt / count;
      avgDp = sumDp / count;
      avgDo = sumDo / count;
    }
  }

  // Simulator Initial State
  const sim = {
    invAmount: baseInv,
    qtyMultiplier: 1.0,
    proxyMultiplier: 1.0,
    durationYears: periodYears,
    discountRate: baseDiscountRate,
    deadweight: Math.round(avgDw * 100),
    attribution: Math.round(avgAt * 100),
    displacement: Math.round(avgDp * 100),
    dropoff: Math.round(avgDo * 100),
  };

  container.innerHTML = `
    <div class="form-stack stack-lg" id="dashboardRoot">
      <!-- Incomplete Warning Banner if not ready -->
      ${
        !isReady && blockers.length > 0
          ? `
        <div class="panel status--warn">
          <div class="cluster stack-between">
            <span class="strong">${L('ข้อมูลยังไม่ครบถ้วนสำหรับการคำนวณที่สมบูรณ์', 'Project inputs incomplete for calculation')}</span>
            <a href="#/wizard/step-5" class="btn btn-secondary btn-compact">${L('ตรวจสอบในขั้นตอนที่ 5', 'Review in Step 5')}</a>
          </div>
        </div>`
          : ''
      }

      <!-- Header -->
      <div class="page-head" style="margin-bottom: var(--sp-md);">
        <div>
          <div class="cluster stack-xs" style="margin-bottom: 2px;">
            <span class="status status--neutral">${escapeHtml(project.organization_name || 'มหาวิทยาลัยนเรศวร')}</span>
            <span class="muted-sm">· ${periodYears} ${L('ปี', 'years')}</span>
          </div>
          <h1 class="page-head__title" style="margin: 0;">${escapeHtml(project.name)}</h1>
        </div>
        <div class="page-head__actions">
          <button type="button" class="btn btn-secondary" id="btnSaveRun">
            ${icons.plus} ${L('บันทึกรอบคำนวณ', 'Save Run')}
          </button>
          <button type="button" class="btn btn-primary" id="btnExportMenu">
            ${L('ส่งออกรายงาน', 'Export Report')}
          </button>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- RESULT KPI CARDS (ACTIVE / WHAT-IF SIMULATION)                    -->
      <!-- ================================================================= -->
      <div class="compare-hero" id="kpiHeroGrid">
        <!-- 1: SROI Ratio -->
        <div class="stat-card stat-card--highlight" id="cardSimRatio">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('อัตราส่วน SROI', 'SROI Ratio')}</span>
            <span class="stat-card__badge stat-card__badge--neutral" id="badgeSimVerdict">${L('เดิม', 'Base')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val stat-card__val--primary" id="valSimRatio">${baseRatio !== null ? `${baseRatio.toFixed(2)}:1` : '-'}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('ค่าเดิม', 'Base')}: ${baseRatio !== null ? `${baseRatio.toFixed(2)}:1` : '-'}</span>
            <span class="stat-card__delta" id="deltaSimRatioText">—</span>
          </div>
        </div>

        <!-- 2: Total Investment -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('เงินลงทุนรวม', 'Total Investment')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimInv">${cur} ${formatBahtCompact(baseInv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('งบเดิม', 'Base')}: ${cur} ${formatBahtCompact(baseInv)}</span>
            <span class="stat-card__delta" id="deltaSimInvText">—</span>
          </div>
        </div>

        <!-- 3: Present Value of Impact -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('มูลค่าผลกระทบ (PV)', 'Present Value')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimPv" style="color: var(--positive);">${cur} ${formatBahtCompact(basePv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('เดิม', 'Base')}: ${cur} ${formatBahtCompact(basePv)}</span>
            <span class="stat-card__delta" id="deltaSimPvText">—</span>
          </div>
        </div>

        <!-- 4: Net Present Value -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('มูลค่าปัจจุบันสุทธิ (NPV)', 'Net Present Value')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimNsv">${cur} ${formatBahtCompact(baseNsv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('เดิม', 'Base')}: ${cur} ${formatBahtCompact(baseNsv)}</span>
            <span class="stat-card__delta" id="deltaSimNsvText">—</span>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- INTERACTIVE WHAT-IF SIMULATOR                                     -->
      <!-- ================================================================= -->
      <div class="panel">
        <div class="toolbar" style="margin-bottom: var(--sp-md); justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-xs);">
          <div>
            <h3 class="panel__title" style="margin: 0;">${L('การจำลองสถานการณ์ (What-If Analysis)', 'What-If Analysis')}</h3>
            <span class="muted-sm">${L('ปรับเปลี่ยนตัวแปรสำคัญเพื่อทดสอบผลลัพธ์แบบ Real-time', 'Simulate outcomes by adjusting key parameters')}</span>
          </div>
          <div class="cluster stack-xs" style="margin-left: auto;">
            <button type="button" class="btn btn-secondary btn-compact" id="btnSimReset">
              ${L('รีเซ็ตเป็นค่าเดิม', 'Reset to Base')}
            </button>
            <button type="button" class="btn btn-primary btn-compact" id="btnSimSaveScenario">
              ${L('บันทึกสถานการณ์', 'Save Scenario')}
            </button>
          </div>
        </div>

        <!-- Primary 6-variable grid -->
        <div class="slider-grid" style="margin-bottom: var(--sp-md);">
          <!-- 1: Investment Budget -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('งบประมาณลงทุน', 'Investment Budget')}</span>
              <span class="slider-badge" id="badgeSimInvVal">${cur} ${formatBahtCompact(baseInv)}</span>
            </div>
            <input type="range" id="rangeSimInv" class="range-input" min="${Math.round(baseInv * 0.1)}" max="${Math.max(Math.round(baseInv * 2.5), 1000000)}" step="${baseInv > 500000 ? 10000 : 1000}" value="${baseInv}" />
            <div class="slider-subline">
              <span>${cur} ${formatBahtCompact(Math.round(baseInv * 0.1))}</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: ${formatBahtCompact(baseInv)}</span>
              <span>${cur} ${formatBahtCompact(Math.max(Math.round(baseInv * 2.5), 1000000))}</span>
            </div>
          </div>

          <!-- 2: Beneficiary Reach -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('จำนวนผู้รับประโยชน์', 'Beneficiary Scale')}</span>
              <span class="slider-badge" id="badgeSimQtyVal">100%</span>
            </div>
            <input type="range" id="rangeSimQty" class="range-input" min="20" max="300" step="5" value="100" />
            <div class="slider-subline">
              <span>20%</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: 100%</span>
              <span>300%</span>
            </div>
          </div>

          <!-- 3: Financial Proxy Valuation -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('มูลค่า Proxy ต่อหน่วย', 'Proxy Valuation')}</span>
              <span class="slider-badge" id="badgeSimProxyVal">100%</span>
            </div>
            <input type="range" id="rangeSimProxy" class="range-input" min="20" max="300" step="5" value="100" />
            <div class="slider-subline">
              <span>20%</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: 100%</span>
              <span>300%</span>
            </div>
          </div>

          <!-- 4: Benefit Duration (Years) -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('ระยะเวลาเกิดผล', 'Benefit Duration')}</span>
              <span class="slider-badge" id="badgeSimDurationVal">${periodYears} ${L('ปี', 'yrs')}</span>
            </div>
            <input type="range" id="rangeSimDuration" class="range-input" min="1" max="10" step="1" value="${periodYears}" />
            <div class="slider-subline">
              <span>1 ${L('ปี', 'yr')}</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: ${periodYears} ${L('ปี', 'yrs')}</span>
              <span>10 ${L('ปี', 'yrs')}</span>
            </div>
          </div>

          <!-- 5: Discount Rate -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('อัตราคิดลด', 'Discount Rate')}</span>
              <span class="slider-badge" id="badgeSimDiscountVal">${baseDiscountRate.toFixed(1)}%</span>
            </div>
            <input type="range" id="rangeSimDiscount" class="range-input" min="0" max="15" step="0.5" value="${baseDiscountRate}" />
            <div class="slider-subline">
              <span>0%</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: ${baseDiscountRate.toFixed(1)}%</span>
              <span>15%</span>
            </div>
          </div>

          <!-- 6: Deadweight -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title">${L('Deadweight (เกิดเอง)', 'Deadweight')}</span>
              <span class="slider-badge" id="badgeSimDwVal">${sim.deadweight}%</span>
            </div>
            <input type="range" id="rangeSimDw" class="range-input" min="0" max="80" step="5" value="${sim.deadweight}" />
            <div class="slider-subline">
              <span>0%</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: ${Math.round(avgDw * 100)}%</span>
              <span>80%</span>
            </div>
          </div>
        </div>

        <!-- Advanced Deductions (Collapsible) -->
        <details class="disclosure" style="background: var(--surface-soft); padding: var(--sp-sm) var(--sp-md); border-radius: var(--radius-md);">
          <summary class="strong" style="font-size: 0.8125rem; cursor: pointer;">
            ${L('การหักลดเพิ่มเติม (Attribution, Displacement, Drop-off)', 'Advanced Deductions (Attribution, Displacement, Drop-off)')}
          </summary>
          <div class="slider-grid stack-top-sm">
            <!-- Attribution -->
            <div class="slider-box">
              <div class="slider-box-header">
                <span class="slider-box-title">Attribution (${L('ผลจากผู้อื่น', 'Others')})</span>
                <span class="slider-badge" id="badgeSimAtVal">${sim.attribution}%</span>
              </div>
              <input type="range" id="rangeSimAt" class="range-input" min="0" max="80" step="5" value="${sim.attribution}" />
              <div class="slider-subline">
                <span>0%</span>
                <span class="muted">${L('ค่าเดิม', 'Base')}: ${Math.round(avgAt * 100)}%</span>
                <span>80%</span>
              </div>
            </div>

            <!-- Displacement -->
            <div class="slider-box">
              <div class="slider-box-header">
                <span class="slider-box-title">Displacement (${L('ทดแทนผลอื่น', 'Displaced')})</span>
                <span class="slider-badge" id="badgeSimDpVal">${sim.displacement}%</span>
              </div>
              <input type="range" id="rangeSimDp" class="range-input" min="0" max="60" step="5" value="${sim.displacement}" />
              <div class="slider-subline">
                <span>0%</span>
                <span class="muted">${L('ค่าเดิม', 'Base')}: ${Math.round(avgDp * 100)}%</span>
                <span>60%</span>
              </div>
            </div>

            <!-- Drop-off -->
            <div class="slider-box">
              <div class="slider-box-header">
                <span class="slider-box-title">Drop-off (${L('ลดทอนรายปี', 'Annual Decay')})</span>
                <span class="slider-badge" id="badgeSimDoVal">${sim.dropoff}%</span>
              </div>
              <input type="range" id="rangeSimDo" class="range-input" min="0" max="50" step="5" value="${sim.dropoff}" />
              <div class="slider-subline">
                <span>0%</span>
                <span class="muted">${L('ค่าเดิม', 'Base')}: ${Math.round(avgDo * 100)}%</span>
                <span>50%</span>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- ================================================================= -->
      <!-- CHARTS                                                            -->
      <!-- ================================================================= -->
      <div class="form-row">
        <!-- Pie / Doughnut Chart -->
        <div class="panel">
          <h3 class="panel__title" style="margin-bottom: var(--sp-sm);">
            ${L('สัดส่วนผลประโยชน์ตามผู้มีส่วนได้เสีย', 'Stakeholder Value Share')}
          </h3>
          <div style="min-height: 200px; display: flex; align-items: center; justify-content: center;">
            ${renderStakeholderChart(stakeholders)}
          </div>
        </div>

        <!-- Outcome Bar Chart -->
        <div class="panel">
          <h3 class="panel__title" style="margin-bottom: var(--sp-sm);">
            ${L('มูลค่าผลกระทบแยกตามผลลัพธ์', 'Outcomes Value Breakdown')}
          </h3>
          <div style="min-height: 200px;">
            ${renderOutcomeBarChart(outcomeLines)}
          </div>
        </div>
      </div>

      <!-- Annual Trend Chart -->
      <div class="panel">
        <h3 class="panel__title" style="margin-bottom: var(--sp-sm);">
          ${L('เปรียบเทียบเงินลงทุนและผลตอบแทนทางสังคมรายปี', 'Annual Investment vs Social Value')}
        </h3>
        ${renderAnnualTrendChart(annual)}
      </div>

      <!-- ================================================================= -->
      <!-- DATA TABLES                                                       -->
      <!-- ================================================================= -->
      <div class="panel">
        <div class="tabs" style="margin-bottom: var(--sp-md);">
          <button type="button" class="tab is-active" data-detail-tab="outcomes">
            ${L('ผลลัพธ์รายข้อ', 'Outcomes')} (${outcomeLines.length})
          </button>
          <button type="button" class="tab" data-detail-tab="scenarios">
            ${L('สถานการณ์จำลอง', 'Scenarios')}
          </button>
          <button type="button" class="tab" data-detail-tab="stakeholders">
            ${L('ผู้มีส่วนได้เสีย', 'Stakeholders')} (${stakeholders.length})
          </button>
        </div>

        <!-- Table 1: Outcomes -->
        <div id="detailTab_outcomes">
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>${L('ผลลัพธ์', 'Outcome')}</th>
                  <th>${L('ผู้มีส่วนได้เสีย', 'Stakeholder')}</th>
                  <th class="num">${L('มูลค่าขั้นต้น/ปี', 'Gross/Yr')}</th>
                  <th class="num">${L('คงเหลือ Net%', 'Net%')}</th>
                  <th class="num">${L('มูลค่าสุทธิ (PV)', 'Net PV')}</th>
                  <th class="num">${L('สัดส่วน', 'Share')}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  outcomeLines.length === 0
                    ? `<tr><td colspan="6" class="empty-state">${L('ไม่มีข้อมูล', 'No outcomes')}</td></tr>`
                    : outcomeLines
                        .map((o) => {
                          const netPct = ((o.net_impact_ratio ?? 1) * 100).toFixed(0);
                          const pvVal = o.present_value ?? o.totals?.present_value ?? 0;
                          const totalPv = basePv || 1;
                          const share = ((pvVal / totalPv) * 100).toFixed(1);
                          return `
                        <tr>
                          <td class="strong">${escapeHtml(o.outcome_name || o.name)}</td>
                          <td>${escapeHtml(o.stakeholder_name || '-')}</td>
                          <td class="num">${cur} ${formatBaht(o.annual_gross_value ?? o.totals?.gross ?? 0)}</td>
                          <td class="num">${netPct}%</td>
                          <td class="num strong val--positive">${cur} ${formatBaht(pvVal)}</td>
                          <td class="num muted-sm">${share}%</td>
                        </tr>`;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Table 2: Scenarios -->
        <div id="detailTab_scenarios" hidden>
          <div class="toolbar" style="margin-bottom: var(--sp-xs);">
            <span class="muted-sm">${L('แบบจำลองสถานการณ์ทางเลือก', 'Alternative scenarios')}</span>
            <button type="button" class="btn btn-secondary btn-compact" id="btnAddNewScenario">
              ${icons.plus} ${L('สร้างสถานการณ์ใหม่', 'Add')}
            </button>
          </div>
          <div id="scenariosContainer">
            <div class="empty-state"><p class="empty-state__text">${L('กำลังโหลด...', 'Loading...')}</p></div>
          </div>
        </div>

        <!-- Table 3: Stakeholders -->
        <div id="detailTab_stakeholders" hidden>
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>${L('ผู้มีส่วนได้เสีย', 'Stakeholder')}</th>
                  <th class="num">${L('ทางบวก', 'Positive')}</th>
                  <th class="num">${L('ทางลบ', 'Negative')}</th>
                  <th class="num">${L('สุทธิ (Net PV)', 'Net PV')}</th>
                  <th class="num">${L('สัดส่วน', 'Share')}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  stakeholders.length === 0
                    ? `<tr><td colspan="5" class="empty-state">${L('ไม่มีข้อมูล', 'No stakeholders')}</td></tr>`
                    : stakeholders
                        .map((s) => {
                          const netPv = s.net_present_value ?? s.positive_present_value ?? 0;
                          return `
                        <tr>
                          <td class="strong">${escapeHtml(s.name)}</td>
                          <td class="num val--positive">${cur} ${formatBaht(s.positive_present_value || 0)}</td>
                          <td class="num val--negative">${cur} ${formatBaht(s.negative_present_value || 0)}</td>
                          <td class="num strong">${cur} ${formatBaht(netPv)}</td>
                          <td class="num muted-sm">${s.share_of_positive_pct != null ? `${s.share_of_positive_pct}%` : '-'}</td>
                        </tr>`;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Sticky Wizard Footer -->
      ${wizardFooterHtml(6, {
        canProceed: true,
        nextLabel: L('เสร็จสิ้นการประเมิน', 'Finish Assessment'),
      })}
    </div>
  `;

  // --------------------------------------------------------------------------
  // LIVE SROI RECALCULATION ENGINE (60 FPS CLIENT-SIDE)
  // --------------------------------------------------------------------------
  function recalculate() {
    const curInv = sim.invAmount;
    const qtyM = sim.qtyMultiplier;
    const prxM = sim.proxyMultiplier;
    const dur = sim.durationYears;
    const r = sim.discountRate / 100;
    const dw = sim.deadweight / 100;
    const at = sim.attribution / 100;
    const dp = sim.displacement / 100;
    const doff = sim.dropoff / 100;

    // Retained deduction ratio compared to baseline
    const baseRf = Math.max(0.01, (1 - avgDw) * (1 - avgAt) * (1 - avgDp));
    const curRf = Math.max(0.01, (1 - dw) * (1 - at) * (1 - dp));
    const rfRatio = curRf / baseRf;

    // Multi-year discount + drop-off series:
    // PV_factor = sum_{t=1..dur} (1 - doff)^(t-1) / (1 + r)^t
    let pvFactorCur = 0;
    for (let t = 1; t <= dur; t++) {
      pvFactorCur += Math.pow(1 - doff, t - 1) / Math.pow(1 + r, t);
    }

    let pvFactorBase = 0;
    for (let t = 1; t <= periodYears; t++) {
      pvFactorBase += Math.pow(1 - avgDo, t - 1) / Math.pow(1 + baseDiscountRate / 100, t);
    }
    const durationDiscountRatio = pvFactorBase > 0 ? pvFactorCur / pvFactorBase : 1;

    // Total Simulated PV
    const curPv = basePv * qtyM * prxM * rfRatio * durationDiscountRatio;
    const curRatio = curInv > 0 ? curPv / curInv : 0;
    const curNsv = curPv - curInv;

    const dRatio = baseRatio !== null ? curRatio - baseRatio : 0;
    const dInv = curInv - baseInv;
    const dPv = curPv - basePv;
    const dNsv = curNsv - baseNsv;

    // 1. SROI Card
    const valRatioEl = document.getElementById('valSimRatio');
    const badgeVerdict = document.getElementById('badgeSimVerdict');
    const deltaRatioText = document.getElementById('deltaSimRatioText');

    if (valRatioEl) valRatioEl.textContent = `${curRatio.toFixed(2)}:1`;

    if (badgeVerdict && deltaRatioText) {
      if (Math.abs(dRatio) < 0.01) {
        badgeVerdict.className = 'stat-card__badge stat-card__badge--neutral';
        badgeVerdict.textContent = L('ค่าเดิม', 'Base');
        deltaRatioText.textContent = '0.00';
      } else if (dRatio > 0) {
        badgeVerdict.className = 'stat-card__badge stat-card__badge--ok';
        const pctUp = baseRatio > 0 ? `+${((dRatio / baseRatio) * 100).toFixed(0)}%` : '';
        badgeVerdict.textContent = `+${dRatio.toFixed(2)}`;
        deltaRatioText.innerHTML = `<span class="val--positive strong">+${dRatio.toFixed(2)} ${pctUp ? `(${pctUp})` : ''}</span>`;
      } else {
        badgeVerdict.className = 'stat-card__badge stat-card__badge--warn';
        const pctDown = baseRatio > 0 ? `-${Math.abs((dRatio / baseRatio) * 100).toFixed(0)}%` : '';
        badgeVerdict.textContent = `${dRatio.toFixed(2)}`;
        deltaRatioText.innerHTML = `<span class="val--negative strong">${dRatio.toFixed(2)} ${pctDown ? `(${pctDown})` : ''}</span>`;
      }
    }

    // 2. Investment Card
    const valInvEl = document.getElementById('valSimInv');
    const deltaInvText = document.getElementById('deltaSimInvText');
    if (valInvEl) valInvEl.textContent = `${cur} ${formatBahtCompact(curInv)}`;
    if (deltaInvText) {
      if (Math.abs(dInv) < 1) {
        deltaInvText.textContent = '0%';
      } else {
        const sign = dInv > 0 ? '+' : '-';
        const pct = baseInv > 0 ? Math.abs((dInv / baseInv) * 100).toFixed(0) : '0';
        deltaInvText.innerHTML = `<span class="${dInv <= 0 ? 'val--positive strong' : 'muted-sm'}">${sign}${pct}%</span>`;
      }
    }

    // 3. PV Card
    const valPvEl = document.getElementById('valSimPv');
    const deltaPvText = document.getElementById('deltaSimPvText');
    if (valPvEl) valPvEl.textContent = `${cur} ${formatBahtCompact(curPv)}`;
    if (deltaPvText) {
      if (Math.abs(dPv) < 1) {
        deltaPvText.textContent = '0%';
      } else {
        const sign = dPv > 0 ? '+' : '-';
        const pct = basePv > 0 ? Math.abs((dPv / basePv) * 100).toFixed(0) : '0';
        deltaPvText.innerHTML = `<span class="${dPv >= 0 ? 'val--positive strong' : 'val--negative strong'}">${sign}${pct}%</span>`;
      }
    }

    // 4. NPV Card
    const valNsvEl = document.getElementById('valSimNsv');
    const deltaNsvText = document.getElementById('deltaSimNsvText');
    if (valNsvEl) valNsvEl.textContent = `${cur} ${formatBahtCompact(curNsv)}`;
    if (deltaNsvText) {
      if (Math.abs(dNsv) < 1) {
        deltaNsvText.textContent = '0%';
      } else {
        const sign = dNsv > 0 ? '+' : '-';
        const pct = baseNsv !== 0 ? Math.abs((dNsv / Math.abs(baseNsv)) * 100).toFixed(0) : '0';
        deltaNsvText.innerHTML = `<span class="${dNsv >= 0 ? 'val--positive strong' : 'val--negative strong'}">${sign}${pct}%</span>`;
      }
    }
  }

  // --------------------------------------------------------------------------
  // BIND ALL 9 SLIDERS
  // --------------------------------------------------------------------------
  const rangeInv = document.getElementById('rangeSimInv');
  const badgeInv = document.getElementById('badgeSimInvVal');
  rangeInv?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.invAmount = val;
    if (badgeInv) badgeInv.textContent = `${cur} ${formatBahtCompact(val)}`;
    recalculate();
  });
  container.querySelectorAll('[data-inv-pct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.invPct);
      const newAmt = Math.round(baseInv * (p / 100));
      sim.invAmount = newAmt;
      if (rangeInv) rangeInv.value = String(newAmt);
      if (badgeInv) badgeInv.textContent = `${cur} ${formatBahtCompact(newAmt)}`;
      recalculate();
    });
  });

  // Quantity Slider
  const rangeQty = document.getElementById('rangeSimQty');
  const badgeQty = document.getElementById('badgeSimQtyVal');
  rangeQty?.addEventListener('input', (e) => {
    const p = Number(e.target.value);
    sim.qtyMultiplier = p / 100;
    if (badgeQty) badgeQty.textContent = `${p}%`;
    recalculate();
  });
  container.querySelectorAll('[data-qty-pct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.qtyPct);
      sim.qtyMultiplier = p / 100;
      if (rangeQty) rangeQty.value = String(p);
      if (badgeQty) badgeQty.textContent = `${p}%`;
      recalculate();
    });
  });

  // Proxy Slider
  const rangeProxy = document.getElementById('rangeSimProxy');
  const badgeProxy = document.getElementById('badgeSimProxyVal');
  rangeProxy?.addEventListener('input', (e) => {
    const p = Number(e.target.value);
    sim.proxyMultiplier = p / 100;
    if (badgeProxy) badgeProxy.textContent = `${p}%`;
    recalculate();
  });
  container.querySelectorAll('[data-proxy-pct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.proxyPct);
      sim.proxyMultiplier = p / 100;
      if (rangeProxy) rangeProxy.value = String(p);
      if (badgeProxy) badgeProxy.textContent = `${p}%`;
      recalculate();
    });
  });

  // Duration Slider
  const rangeDuration = document.getElementById('rangeSimDuration');
  const badgeDuration = document.getElementById('badgeSimDurationVal');
  rangeDuration?.addEventListener('input', (e) => {
    const y = Number(e.target.value);
    sim.durationYears = y;
    if (badgeDuration) badgeDuration.textContent = `${y} ${L('ปี', 'yrs')}`;
    recalculate();
  });
  container.querySelectorAll('[data-dur]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const y = Number(btn.dataset.dur);
      sim.durationYears = y;
      if (rangeDuration) rangeDuration.value = String(y);
      if (badgeDuration) badgeDuration.textContent = `${y} ${L('ปี', 'yrs')}`;
      recalculate();
    });
  });

  // Discount Rate Slider
  const rangeDiscount = document.getElementById('rangeSimDiscount');
  const badgeDiscount = document.getElementById('badgeSimDiscountVal');
  rangeDiscount?.addEventListener('input', (e) => {
    const r = Number(e.target.value);
    sim.discountRate = r;
    if (badgeDiscount) badgeDiscount.textContent = `${r.toFixed(1)}%`;
    recalculate();
  });
  container.querySelectorAll('[data-disc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = Number(btn.dataset.disc);
      sim.discountRate = r;
      if (rangeDiscount) rangeDiscount.value = String(r);
      if (badgeDiscount) badgeDiscount.textContent = `${r.toFixed(1)}%`;
      recalculate();
    });
  });

  // Deadweight Slider
  const rangeDw = document.getElementById('rangeSimDw');
  const badgeDw = document.getElementById('badgeSimDwVal');
  rangeDw?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.deadweight = val;
    if (badgeDw) badgeDw.textContent = `${val}%`;
    recalculate();
  });
  container.querySelectorAll('[data-dw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.dw);
      sim.deadweight = val;
      if (rangeDw) rangeDw.value = String(val);
      if (badgeDw) badgeDw.textContent = `${val}%`;
      recalculate();
    });
  });

  // Attribution Slider
  const rangeAt = document.getElementById('rangeSimAt');
  const badgeAt = document.getElementById('badgeSimAtVal');
  rangeAt?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.attribution = val;
    if (badgeAt) badgeAt.textContent = `${val}%`;
    recalculate();
  });

  // Displacement Slider
  const rangeDp = document.getElementById('rangeSimDp');
  const badgeDp = document.getElementById('badgeSimDpVal');
  rangeDp?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.displacement = val;
    if (badgeDp) badgeDp.textContent = `${val}%`;
    recalculate();
  });

  // Drop-off Slider
  const rangeDo = document.getElementById('rangeSimDo');
  const badgeDo = document.getElementById('badgeSimDoVal');
  rangeDo?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.dropoff = val;
    if (badgeDo) badgeDo.textContent = `${val}%`;
    recalculate();
  });

  // Reset Sliders
  document.getElementById('btnSimReset')?.addEventListener('click', () => {
    sim.invAmount = baseInv;
    sim.qtyMultiplier = 1.0;
    sim.proxyMultiplier = 1.0;
    sim.durationYears = periodYears;
    sim.discountRate = baseDiscountRate;
    sim.deadweight = Math.round(avgDw * 100);
    sim.attribution = Math.round(avgAt * 100);
    sim.displacement = Math.round(avgDp * 100);
    sim.dropoff = Math.round(avgDo * 100);

    if (rangeInv) rangeInv.value = String(baseInv);
    if (badgeInv) badgeInv.textContent = `${cur} ${formatBahtCompact(baseInv)}`;

    if (rangeQty) rangeQty.value = '100';
    if (badgeQty) badgeQty.textContent = '100%';

    if (rangeProxy) rangeProxy.value = '100';
    if (badgeProxy) badgeProxy.textContent = '100%';

    if (rangeDuration) rangeDuration.value = String(periodYears);
    if (badgeDuration) badgeDuration.textContent = `${periodYears} ${L('ปี', 'yrs')}`;

    if (rangeDiscount) rangeDiscount.value = String(baseDiscountRate);
    if (badgeDiscount) badgeDiscount.textContent = `${baseDiscountRate.toFixed(1)}%`;

    if (rangeDw) rangeDw.value = String(sim.deadweight);
    if (badgeDw) badgeDw.textContent = `${sim.deadweight}%`;

    if (rangeAt) rangeAt.value = String(sim.attribution);
    if (badgeAt) badgeAt.textContent = `${sim.attribution}%`;

    if (rangeDp) rangeDp.value = String(sim.displacement);
    if (badgeDp) badgeDp.textContent = `${sim.displacement}%`;

    if (rangeDo) rangeDo.value = String(sim.dropoff);
    if (badgeDo) badgeDo.textContent = `${sim.dropoff}%`;

    recalculate();
    showToast(L('รีเซ็ตตัวเลื่อนกลับสู่ค่าเดิมของโครงการแล้ว', 'Reset sliders to project baseline'), 'info');
  });

  // Save What-If as Scenario
  document.getElementById('btnSimSaveScenario')?.addEventListener('click', async () => {
    const curRatio = (
      sim.invAmount > 0 ? (basePv * sim.qtyMultiplier * sim.proxyMultiplier) / sim.invAmount : 0
    ).toFixed(2);
    const defaultName = isTh
      ? `แบบจำลอง What-If (งบ ${cur} ${formatBaht(sim.invAmount)}, SROI ${curRatio})`
      : `What-If Scenario (Budget ${cur} ${formatBaht(sim.invAmount)}, SROI ${curRatio})`;

    const name = prompt(
      isTh ? 'ระบุชื่อแบบจำลองสถานการณ์ใหม่นี้:' : 'Enter a name for this new what-if scenario:',
      defaultName,
    );
    if (!name || !name.trim()) return;

    try {
      const globalAssumptions = {};
      if (sim.qtyMultiplier !== 1.0) globalAssumptions.quantity_multiplier = sim.qtyMultiplier;
      if (sim.proxyMultiplier !== 1.0) globalAssumptions.proxy_multiplier = sim.proxyMultiplier;
      if (sim.discountRate !== baseDiscountRate)
        globalAssumptions.discount_rate = sim.discountRate / 100;
      if (sim.durationYears !== periodYears)
        globalAssumptions.duration_delta_years = sim.durationYears - periodYears;

      const dwDelta = sim.deadweight / 100 - avgDw;
      const atDelta = sim.attribution / 100 - avgAt;
      if (Math.abs(dwDelta) > 0.01)
        globalAssumptions.deadweight_delta = Math.round(dwDelta * 100) / 100;
      if (Math.abs(atDelta) > 0.01)
        globalAssumptions.attribution_delta = Math.round(atDelta * 100) / 100;

      await api.createScenario(project.id, {
        name: name.trim(),
        kind: 'custom',
        description: `Created from What-If Simulator: Budget ${cur} ${formatBaht(sim.invAmount)}, SROI ~${curRatio}`,
        assumptions: {
          global: globalAssumptions,
          outcomes: {},
        },
      });

      showToast(
        L('บันทึกเป็นแบบจำลองสถานการณ์เรียบร้อยแล้ว', 'Saved as scenario successfully'),
        'success',
      );
      renderStep6(container);
    } catch (err) {
      showToast(`Save scenario failed: ${err.message}`, 'error');
    }
  });

  // Initial sync
  recalculate();

  // --------------------------------------------------------------------------
  // DETAIL TABS (Outcomes, Scenarios, Stakeholders)
  // --------------------------------------------------------------------------
  const detailTabButtons = container.querySelectorAll('[data-detail-tab]');
  const detailPanels = {
    outcomes: document.getElementById('detailTab_outcomes'),
    scenarios: document.getElementById('detailTab_scenarios'),
    stakeholders: document.getElementById('detailTab_stakeholders'),
  };

  detailTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.detailTab;
      detailTabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      Object.keys(detailPanels).forEach((k) => {
        if (detailPanels[k]) detailPanels[k].hidden = k !== key;
      });
      if (key === 'scenarios') loadScenarios();
    });
  });

  function loadScenarios() {
    const target = document.getElementById('scenariosContainer');
    if (!target) return;

    api.getScenarioComparison(project.id).then((res) => {
      const list = res?.data || [];
      if (list.length === 0) {
        target.innerHTML = `<div class="empty-state"><p class="empty-state__text">${L('ยังไม่มีแบบจำลอง', 'No scenarios configured.')}</p></div>`;
        return;
      }

      const baseScenario = list.find((s) => s.is_base) || list[0];
      const baseRatioVal = baseScenario?.sroi_ratio ?? null;

      const deltaTag = (val, bVal) => {
        if (val == null || bVal == null) return '';
        const d = val - bVal;
        if (Math.abs(d) < 0.001) return '';
        const sign = d > 0 ? '+' : '';
        const cls = d > 0 ? 'val--positive' : 'val--negative';
        return ` <span class="${cls}" style="font-size:0.75rem">(${sign}${d.toFixed(2)})</span>`;
      };

      target.innerHTML = `
        <div class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th>${L('ชื่อสถานการณ์', 'Scenario')}</th>
                <th>${L('ลักษณะ', 'Type')}</th>
                <th class="num">${L('อัตราส่วน SROI', 'SROI')}</th>
                <th class="num">${L('มูลค่า PV', 'PV')}</th>
                <th class="num">${L('สุทธิ NPV', 'NPV')}</th>
                <th>${L('จัดการ', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${list
                .map((sc) => {
                  const scId = sc.scenario_id ?? sc.id;
                  const isSelected = scId === activeScenarioId || (!activeScenarioId && sc.is_base);
                  const isBase = sc.is_base;
                  const ratioStr =
                    sc.sroi_ratio !== null
                      ? `${sc.sroi_ratio.toFixed(2)}:1${!isBase ? deltaTag(sc.sroi_ratio, baseRatioVal) : ''}`
                      : '-';
                  return `
                <tr class="${isSelected ? 'panel--soft' : ''}">
                  <td class="strong">
                    ${escapeHtml(sc.name)}
                    ${isBase ? `<span class="status status--neutral" style="font-size:0.7rem;margin-left:4px">${L('ต้นทุน', 'Base')}</span>` : ''}
                  </td>
                  <td><span class="status status--neutral">${escapeHtml(sc.kind)}</span></td>
                  <td class="num strong primary-text stat-num--md">${ratioStr}</td>
                  <td class="num">${cur} ${formatBaht(sc.present_value_of_impact ?? sc.present_value ?? 0)}</td>
                  <td class="num strong">${cur} ${formatBaht(sc.net_social_value ?? 0)}</td>
                  <td>
                    <div class="cluster stack-xs">
                      ${
                        isSelected
                          ? `<span class="status status--ok">${L('ใช้งานอยู่', 'Active')}</span>`
                          : `<button type="button" class="btn btn-secondary btn-compact" data-select-scenario="${scId}">${L('ใช้', 'Use')}</button>`
                      }
                      ${
                        !isBase
                          ? `<button type="button" class="btn btn-ghost btn-compact" data-delete-scenario="${scId}" title="${L('ลบ', 'Delete')}" style="color:var(--error)">✕</button>`
                          : ''
                      }
                    </div>
                  </td>
                </tr>`;
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

      target.querySelectorAll('[data-delete-scenario]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scId = Number(btn.dataset.deleteScenario);
          const sc = list.find((s) => (s.scenario_id ?? s.id) === scId);
          if (
            !confirm(
              L(
                `ต้องการลบสถานการณ์ "${sc?.name || scId}"?`,
                `Delete scenario "${sc?.name || scId}"?`,
              ),
            )
          )
            return;
          try {
            await api.deleteScenario(project.id, scId);
            showToast(L('ลบสถานการณ์เรียบร้อย', 'Deleted'), 'success');
            loadScenarios();
          } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
          }
        });
      });
    });
  }

  document.getElementById('btnAddNewScenario')?.addEventListener('click', () => {
    openScenarioModal({ onSave: () => loadScenarios() });
  });

  // Audit Run & Export
  document.getElementById('btnSaveRun')?.addEventListener('click', async () => {
    try {
      const run = await runCalculation(activeScenarioId);
      showToast(
        L(
          `บันทึกประวัติผลคำนวณรอบ #${run?.run?.id || ''} แล้ว`,
          `Calculation run #${run?.run?.id || ''} saved`,
        ),
        'success',
      );
    } catch (err) {
      showToast(`Failed to save run: ${err.message}`, 'error');
    }
  });

  document.getElementById('btnExportMenu')?.addEventListener('click', () => {
    openExportReportModal({ project, activeScenarioId });
  });

  // Calculation Traces
  if (isReady) {
    document.getElementById('traceBtn_sroi')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'sroi_ratio', project, result });
    });
    document.getElementById('traceBtn_inv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'total_investment', project, result });
    });
    document.getElementById('traceBtn_pv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'present_value', project, result });
    });
    document.getElementById('traceBtn_nsv')?.addEventListener('click', () => {
      openCalculationTraceModal({ metricType: 'sroi_ratio', project, result });
    });
  }

  attachWizardFooterEvents(container);
}

// ----------------------------------------------------------------------------
// EXPORT REPORT MODAL
// ----------------------------------------------------------------------------
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
      <!-- Step 1: Create the report -->
      <div id="expStepCreate" class="form-stack stack-md">
        <form id="reportGenForm" class="form-stack">
          <div class="field">
            <label class="field-label" for="expTitle">${t('col_report_title', 'ชื่อรายงาน')} ${reqTag(isTh)}</label>
            <input type="text" id="expTitle" name="title" class="input" value="${escapeHtml(project.name)} — ${L('รายงานผลการประเมิน SROI', 'SROI Assessment Report')}" required />
          </div>
          <div class="field">
            <label class="field-label" for="expType">${t('col_eval_type', 'ประเภทรายงาน')} ${optTag(isTh)}</label>
            <select id="expType" name="type" class="input">
              <option value="detailed" selected>${L('รายงานฉบับสมบูรณ์ (Full Audit)', 'Detailed report (full audit trail)')}</option>
              <option value="executive">${L('รายงานสรุปผู้บริหาร (Executive Summary)', 'Executive summary')}</option>
            </select>
          </div>
        </form>

        <div class="cluster cluster--end">
          <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
          <button type="button" class="btn btn-primary" id="btnCreateAndExport">${L('สร้างรายงาน', 'Create report')}</button>
        </div>
      </div>

      <!-- Step 2: Pick a format -->
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
            desc: L(
              'พิมพ์เป็น PDF รองรับภาษาไทยสมบูรณ์',
              'Print to PDF with complete Thai font support.',
            ),
            action: `<button type="button" class="btn btn-primary btn-compact" id="btnPrintPdf">${L('เปิดหน้าต่างพิมพ์', 'Print PDF')}</button>`,
          })}
          ${row({
            tag: 'CSV',
            title: L('CSV (Excel)', 'CSV (Excel)'),
            desc: L('เลือกตารางข้อมูลที่ต้องการ', 'Choose data table to download.'),
            extra: `<label class="exp-select"><select id="csvDataset" class="input">${CSV_DATASETS.map(([v, label]) => `<option value="${v}">${escapeHtml(label)}</option>`).join('')}</select></label>`,
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadCsv">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'HTML',
            title: L('HTML Web Page', 'HTML Web Page'),
            desc: L('ไฟล์เว็บแบบสแตนด์อโลน', 'Standalone web report.'),
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadHtml">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'JSON',
            title: 'JSON Snapshot',
            desc: L('สแนปช็อตข้อมูลสำหรับตรวจสอบ', 'Raw data snapshot for audit.'),
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnDownloadJson">${L('ดาวน์โหลด', 'Download')}</button>`,
          })}
          ${row({
            tag: 'LINK',
            title: L('ลิงก์แชร์ออนไลน์ (30 วัน)', 'Share link (30 days)'),
            desc: L('เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ', 'Public link for stakeholders.'),
            extra: '<div id="shareLinkContainer" hidden></div>',
            action: `<button type="button" class="btn btn-secondary btn-compact" id="btnShareLink">${L('สร้างลิงก์', 'Create link')}</button>`,
          })}
        </ul>

        <div class="cluster cluster--space-between">
          <button type="button" class="btn btn-secondary" id="btnExpBack">← ${L('สร้างใหม่', 'Back')}</button>
          <button type="button" class="btn btn-primary" data-modal-close>${L('เสร็จสิ้น', 'Done')}</button>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: L('ส่งออกรายงาน SROI', 'Export SROI Report'),
    body: modalHtml,
  });

  let activeReportId = null;
  const showStep = (st) => {
    const c = document.getElementById('expStepCreate');
    const r = document.getElementById('expStepResult');
    if (c && r) {
      c.hidden = st !== 'create';
      r.hidden = st !== 'result';
    }
  };

  const busy = async (btn, fn) => {
    if (!btn || btn.disabled) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = L('กำลังจัดเตรียม...', 'Preparing...');
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  const generate = async () => {
    const form = document.getElementById('reportGenForm');
    if (!form) return;
    const title = form.title.value.trim();
    if (!title) {
      showToast(L('กรุณาระบุชื่อรายงาน', 'Please enter title.'), 'warn');
      return;
    }
    const genBtn = document.getElementById('btnCreateAndExport');
    const label = genBtn?.textContent || '';
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.textContent = L('กำลังสร้าง...', 'Creating...');
    }
    try {
      const runRes = await runCalculation(activeScenarioId);
      const runId = runRes?.run?.id;
      const repRes = await createReport(runId, form.type.value, title, activeScenarioId);
      activeReportId = repRes?.id;
      if (!activeReportId) throw new Error('Failed to create report.');

      const readyTitleEl = document.getElementById('expReadyTitle');
      if (readyTitleEl) readyTitleEl.textContent = title;
      showStep('result');
    } catch (err) {
      showToast(`Report failed: ${err.message}`, 'error');
    } finally {
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.textContent = label;
      }
    }
  };

  document.getElementById('btnCreateAndExport')?.addEventListener('click', generate);
  document.getElementById('reportGenForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    generate();
  });
  document.getElementById('btnExpBack')?.addEventListener('click', () => showStep('create'));

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
      const dataset =
        format === 'csv' ? document.getElementById('csvDataset')?.value || 'outcomes' : null;
      const blob = await api.exportReport(activeReportId, format, dataset, lang);
      saveBlob(
        blob,
        `SROI_Report_${project.id}_${activeReportId}${dataset ? `_${dataset}` : ''}.${format}`,
      );
      showToast(L('เริ่มดาวน์โหลดไฟล์แล้ว', 'Download started'), 'info');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

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
        document.title = w.document.title || prevTitle;
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

  bind('btnShareLink', async () => {
    try {
      const res = await api.shareReport(activeReportId);
      const apiOrigin = API_BASE.replace(/\/api\/v1\/?$/, '');
      const shareUrl =
        res?.data?.url ||
        `${apiOrigin}${res?.data?.path || `/api/v1/shared/${res?.data?.token}`}?format=html&lang=${lang === 'th' ? 'th' : 'en'}`;
      const box = document.getElementById('shareLinkContainer');
      if (!box) return;
      box.innerHTML = `
        <div class="exp-link">
          <input type="text" class="input" readonly value="${escapeHtml(shareUrl)}" id="shareUrlInput" />
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
        showToast(L('คัดลอกลิงก์แล้ว', 'Copied'), 'success');
      });
    } catch (err) {
      showToast(`Share failed: ${err.message}`, 'error');
    }
  });
}
