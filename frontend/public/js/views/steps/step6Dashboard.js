/**
 * Step 6: SROI Analytics Dashboard & Results
 *
 * Modern, executive-grade visual analytics dashboard.
 * - Dynamic KPI Hero Cards (Base vs What-If live comparison).
 * - Interactive What-If Simulation Studio with 9 reactive parameter sliders.
 * - Vibrant SVG Donut/Pie Chart for Stakeholder Impact Share.
 * - Outcomes Impact Leaderboard (ranked by social value creation).
 * - Multi-Year Value Realization & Payback Break-Even Timeline.
 * - Strategic Health & Evidence Metrics.
 * - Comprehensive Report Export & Scenario Management.
 */

import { getState, runCalculation, createReport, setActiveScenario } from '../../store.js';
import {
  renderStakeholderChart,
  renderOutcomeBarChart,
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
  const { project, dashboard, activeScenarioId, review } = getState();
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
  const outcomeLines = result.outcomes || [];
  const annual = result.annual || [];

  // Normalize stakeholders data: Backend calculation returns `by_stakeholder`
  let stakeholders =
    result.by_stakeholder && result.by_stakeholder.length > 0
      ? result.by_stakeholder
      : result.stakeholders || [];

  // Fallback: aggregate from outcomes if stakeholder list is empty
  if (stakeholders.length === 0 && outcomeLines.length > 0) {
    const map = {};
    outcomeLines.forEach((o) => {
      const name = o.stakeholder_name || L('ผู้มีส่วนได้เสีย', 'Stakeholder');
      const pv = o.present_value ?? o.totals?.present_value ?? 0;
      if (!map[name]) {
        map[name] = { name, positive_present_value: 0, net_present_value: 0 };
      }
      if (pv > 0) map[name].positive_present_value += pv;
      map[name].net_present_value += pv;
    });
    stakeholders = Object.values(map);
  }

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

  // Baseline averages for impact deductions
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

  // Retention Efficiency %
  const avgRetention = Math.round((1 - avgDw) * (1 - avgAt) * (1 - avgDp) * 100);

  // Evidence Quality Count
  const verifiedOutcomesCount = outcomeLines.filter(
    (o) => o.evidence_quality === 'measured' || o.evidence_quality === 'proxy',
  ).length;
  const evidenceScore =
    outcomeLines.length > 0
      ? Math.round((verifiedOutcomesCount / outcomeLines.length) * 100)
      : 100;

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
      <!-- Incomplete Inputs Warning Banner if not ready -->
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

      <!-- Page Header & Action Bar -->
      <div class="page-head" style="margin-bottom: var(--sp-md);">
        <div>
          <div class="cluster stack-xs" style="margin-bottom: 4px;">
            <span class="status status--neutral">${escapeHtml(project.organization_name || 'มหาวิทยาลัยนเรศวร')}</span>
            <span class="muted-sm">· ${periodYears} ${L('ปี', 'years')}</span>
            <span class="status status--ok" style="font-size: 0.7rem;">${L('พร้อมประเมินผล', 'Active Model')}</span>
          </div>
          <h1 class="page-head__title" style="margin: 0; font-size: 1.5rem;">${escapeHtml(project.name)}</h1>
        </div>
        <div class="page-head__actions">
          <button type="button" class="btn btn-secondary" id="btnOpenScenarioDrawer">
            ${L('แบบจำลองสถานการณ์', 'Scenarios')}
          </button>
          <button type="button" class="btn btn-secondary" id="btnSaveRun">
            ${icons.plus} ${L('บันทึกรอบคำนวณ', 'Save Run')}
          </button>
          <button type="button" class="btn btn-primary" id="btnExportMenu">
            ${L('ส่งออกรายงาน', 'Export Report')}
          </button>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- TOP KPI HERO CARDS (BASE VS WHAT-IF COMPARISON)                   -->
      <!-- ================================================================= -->
      <div class="compare-hero" id="kpiHeroGrid">
        <!-- 1: SROI Ratio -->
        <div class="stat-card stat-card--highlight" id="cardSimRatio">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('อัตราส่วน SROI (ผลตอบแทนต่อการลงทุน)', 'SROI Ratio')}</span>
            <span class="stat-card__badge stat-card__badge--neutral" id="badgeSimVerdict">${L('เดิม', 'Base')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val stat-card__val--primary" id="valSimRatio">${baseRatio !== null ? `${baseRatio.toFixed(2)} : 1` : '-'}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('ค่าเดิม', 'Base')}: ${baseRatio !== null ? `${baseRatio.toFixed(2)}:1` : '-'}</span>
            <span class="stat-card__delta" id="deltaSimRatioText">—</span>
          </div>
        </div>

        <!-- 2: Total Investment -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('เงินลงทุนรวมของโครงการ', 'Total Investment')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimInv">${formatBahtCompact(baseInv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('งบเดิม', 'Base')}: ${formatBahtCompact(baseInv)}</span>
            <span class="stat-card__delta" id="deltaSimInvText">—</span>
          </div>
        </div>

        <!-- 3: Present Value of Impact -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('มูลค่าผลกระทบทางสังคมรวม (PV)', 'Present Value (Impact)')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimPv" style="color: var(--positive);">${formatBahtCompact(basePv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('เดิม', 'Base')}: ${formatBahtCompact(basePv)}</span>
            <span class="stat-card__delta" id="deltaSimPvText">—</span>
          </div>
        </div>

        <!-- 4: Net Present Value -->
        <div class="stat-card">
          <div class="stat-card__head">
            <span class="stat-card__label">${L('มูลค่าปัจจุบันสุทธิ (Net Social Value)', 'Net Present Value')}</span>
          </div>
          <div class="stat-card__value-wrap">
            <span class="stat-card__val" id="valSimNsv">${formatBahtCompact(baseNsv)}</span>
          </div>
          <div class="stat-card__foot">
            <span>${L('เดิม', 'Base')}: ${formatBahtCompact(baseNsv)}</span>
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
            <h3 class="panel__title" style="margin: 0;">${L('การจำลองสถานการณ์ผลกระทบ (What-If Analysis Studio)', 'What-If Analysis Studio')}</h3>
            <span class="muted-sm">${L('ปรับเปลี่ยนตัวแปรสำคัญเพื่อทดสอบความคุ้มค่าและความอ่อนไหวแบบ Real-time', 'Simulate outcomes in real-time by adjusting key parameters')}</span>
          </div>
          <div class="cluster stack-xs" style="margin-left: auto;">
            <button type="button" class="btn btn-secondary btn-compact" id="btnSimReset">
              ${L('รีเซ็ตเป็นค่าเดิม', 'Reset to Base')}
            </button>
            <button type="button" class="btn btn-primary btn-compact" id="btnSimSaveScenario">
              ${L('บันทึกเป็นแบบจำลองใหม่', 'Save Scenario')}
            </button>
          </div>
        </div>

        <!-- 6 Main Sliders Grid -->
        <div class="slider-grid" style="margin-bottom: var(--sp-md);">
          <!-- 1: Investment Budget -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title strong">${L('งบประมาณลงทุน', 'Investment Budget')}</span>
              <span class="slider-badge" id="badgeSimInvVal">${formatBahtCompact(baseInv)}</span>
            </div>
            <input type="range" id="rangeSimInv" class="range-input" min="${Math.round(baseInv * 0.1)}" max="${Math.max(Math.round(baseInv * 2.5), 1000000)}" step="${baseInv > 500000 ? 10000 : 1000}" value="${baseInv}" />
            <div class="slider-subline">
              <span>${formatBahtCompact(Math.round(baseInv * 0.1))}</span>
              <span class="muted">${L('ค่าเดิม', 'Base')}: ${formatBahtCompact(baseInv)}</span>
              <span>${formatBahtCompact(Math.max(Math.round(baseInv * 2.5), 1000000))}</span>
            </div>
          </div>

          <!-- 2: Beneficiary Reach -->
          <div class="slider-box">
            <div class="slider-box-header">
              <span class="slider-box-title strong">${L('จำนวนผู้รับประโยชน์', 'Beneficiary Scale')}</span>
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
              <span class="slider-box-title strong">${L('มูลค่า Proxy ต่อหน่วย', 'Proxy Valuation')}</span>
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
              <span class="slider-box-title strong">${L('ระยะเวลาเกิดผลตอบแทน', 'Benefit Duration')}</span>
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
              <span class="slider-box-title strong">${L('อัตราคิดลด (Discount Rate)', 'Discount Rate')}</span>
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
              <span class="slider-box-title strong">${L('Deadweight (เกิดเองตามธรรมชาติ)', 'Deadweight')}</span>
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
      <!-- BRAND-NEW VISUAL ANALYTICS GRID                                   -->
      <!-- ================================================================= -->
      <div class="dashboard-grid-2col">
        <!-- 1: STAKEHOLDER VALUE SHARE (PIE / DONUT CHART) -->
        <div class="panel">
          <div class="cluster stack-between" style="margin-bottom: var(--sp-md);">
            <div>
              <h3 class="panel__title" style="margin: 0;">
                ${L('สัดส่วนคุณค่าทางสังคมตามกลุ่มผู้มีส่วนได้เสีย', 'Stakeholder Value Share')}
              </h3>
              <span class="muted-sm">${L('การกระจายตัวของผลตอบแทนทางสังคมตามกลุ่มผู้รับผลประโยชน์', 'Distribution of monetized impact across beneficiary groups')}</span>
            </div>
            <span class="badge badge-primary">${stakeholders.length} ${L('กลุ่ม', 'groups')}</span>
          </div>

          <div id="stakeholderChartContainer" style="min-height: 220px; display: flex; align-items: center; justify-content: center;">
            ${renderStakeholderChart(stakeholders)}
          </div>
        </div>

        <!-- 2: TOP OUTCOMES LEADERBOARD -->
        <div class="panel">
          <div class="cluster stack-between" style="margin-bottom: var(--sp-md);">
            <div>
              <h3 class="panel__title" style="margin: 0;">
                ${L('อันดับผลลัพธ์ที่สร้างคุณค่าทางสังคมสูงสุด', 'Top Value Drivers')}
              </h3>
              <span class="muted-sm">${L('ผลลัพธ์ที่มีมูลค่าคิดลดสูงสุดและสัดส่วนคงเหลือสุทธิ', 'Highest impact outcomes and net retention rates')}</span>
            </div>
            <span class="badge badge-neutral">${outcomeLines.length} ${L('ผลลัพธ์', 'outcomes')}</span>
          </div>

          <div id="outcomeLeaderboardContainer">
            ${renderOutcomeBarChart(outcomeLines)}
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- STRATEGIC HEALTH & METHODOLOGY METRICS                            -->
      <!-- ================================================================= -->
      <div class="strategic-tiles-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
        <!-- Tile 1: Net Return on Investment -->
        <div class="strategic-tile">
          <span class="strategic-tile__label">${L('อัตราผลตอบแทนสุทธิต่อสังคม', 'Net Social Return')}</span>
          <span class="strategic-tile__value" style="color: var(--positive);">
            ${baseInv > 0 ? `+${Math.round((baseNsv / baseInv) * 100)}%` : '-'}
          </span>
          <span class="strategic-tile__sub">${L('คุณค่าทางสังคมส่วนเกินหลังหักงบประมาณ', 'Surplus value generated above cost')}</span>
        </div>

        <!-- Tile 2: Impact Retention -->
        <div class="strategic-tile">
          <span class="strategic-tile__label">${L('ประสิทธิภาพการคงอยู่ของผลลัพธ์', 'Net Retention Efficiency')}</span>
          <span class="strategic-tile__value">${avgRetention}%</span>
          <span class="strategic-tile__sub">${L('คงเหลือหลังหัก Deadweight และ Attribution', 'Retained after deducting external factors')}</span>
        </div>

        <!-- Tile 3: Evidence Health -->
        <div class="strategic-tile">
          <span class="strategic-tile__label">${L('ความน่าเชื่อถือของหลักฐาน', 'Evidence Confidence')}</span>
          <span class="strategic-tile__value">${evidenceScore}%</span>
          <span class="strategic-tile__sub">${L('สัดส่วนข้อมูลที่มีการตรวจวัดและตัวแทนการเงิน', 'Measured inputs & verified proxies')}</span>
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

    const baseDw = Math.round(avgDw * 100) / 100;
    const baseAt = Math.round(avgAt * 100) / 100;
    const baseDp = Math.round(avgDp * 100) / 100;
    const baseDo = Math.round(avgDo * 100) / 100;

    const isUntouched =
      curInv === baseInv &&
      qtyM === 1.0 &&
      prxM === 1.0 &&
      dur === periodYears &&
      Math.abs(sim.discountRate - baseDiscountRate) < 0.001 &&
      sim.deadweight === Math.round(avgDw * 100) &&
      sim.attribution === Math.round(avgAt * 100) &&
      sim.displacement === Math.round(avgDp * 100) &&
      sim.dropoff === Math.round(avgDo * 100);

    let curPv = basePv;
    let curRatio = baseRatio;
    let curNsv = baseNsv;
    let dRatio = 0;
    let dInv = 0;
    let dPv = 0;
    let dNsv = 0;

    if (!isUntouched) {
      // Retained deduction ratio compared to baseline
      const baseRf = Math.max(0.01, (1 - baseDw) * (1 - baseAt) * (1 - baseDp));
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
        pvFactorBase += Math.pow(1 - baseDo, t - 1) / Math.pow(1 + baseDiscountRate / 100, t);
      }
      const durationDiscountRatio = pvFactorBase > 0 ? pvFactorCur / pvFactorBase : 1;

      // Total Simulated PV
      curPv = basePv * qtyM * prxM * rfRatio * durationDiscountRatio;
      curRatio = curInv > 0 ? curPv / curInv : 0;
      curNsv = curPv - curInv;

      dRatio = baseRatio !== null ? curRatio - baseRatio : 0;
      dInv = curInv - baseInv;
      dPv = curPv - basePv;
      dNsv = curNsv - baseNsv;
    }

    // 1. SROI Card
    const valRatioEl = document.getElementById('valSimRatio');
    const badgeVerdict = document.getElementById('badgeSimVerdict');
    const deltaRatioText = document.getElementById('deltaSimRatioText');

    if (valRatioEl) valRatioEl.textContent = `${curRatio.toFixed(2)} : 1`;

    if (badgeVerdict && deltaRatioText) {
      if (Math.abs(dRatio) < 0.01) {
        badgeVerdict.className = 'stat-card__badge stat-card__badge--neutral';
        badgeVerdict.textContent = L('ค่าเดิม', 'Base');
        deltaRatioText.textContent = '—';
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
    if (valInvEl) valInvEl.textContent = formatBahtCompact(curInv);
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
    if (valPvEl) valPvEl.textContent = formatBahtCompact(curPv);
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
    if (valNsvEl) valNsvEl.textContent = formatBahtCompact(curNsv);
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
  // BIND ALL SLIDERS
  // --------------------------------------------------------------------------
  const rangeInv = document.getElementById('rangeSimInv');
  const badgeInv = document.getElementById('badgeSimInvVal');
  rangeInv?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.invAmount = val;
    if (badgeInv) badgeInv.textContent = formatBahtCompact(val);
    recalculate();
  });

  const rangeQty = document.getElementById('rangeSimQty');
  const badgeQty = document.getElementById('badgeSimQtyVal');
  rangeQty?.addEventListener('input', (e) => {
    const p = Number(e.target.value);
    sim.qtyMultiplier = p / 100;
    if (badgeQty) badgeQty.textContent = `${p}%`;
    recalculate();
  });

  const rangeProxy = document.getElementById('rangeSimProxy');
  const badgeProxy = document.getElementById('badgeSimProxyVal');
  rangeProxy?.addEventListener('input', (e) => {
    const p = Number(e.target.value);
    sim.proxyMultiplier = p / 100;
    if (badgeProxy) badgeProxy.textContent = `${p}%`;
    recalculate();
  });

  const rangeDuration = document.getElementById('rangeSimDuration');
  const badgeDuration = document.getElementById('badgeSimDurationVal');
  rangeDuration?.addEventListener('input', (e) => {
    const y = Number(e.target.value);
    sim.durationYears = y;
    if (badgeDuration) badgeDuration.textContent = `${y} ${L('ปี', 'yrs')}`;
    recalculate();
  });

  const rangeDiscount = document.getElementById('rangeSimDiscount');
  const badgeDiscount = document.getElementById('badgeSimDiscountVal');
  rangeDiscount?.addEventListener('input', (e) => {
    const r = Number(e.target.value);
    sim.discountRate = r;
    if (badgeDiscount) badgeDiscount.textContent = `${r.toFixed(1)}%`;
    recalculate();
  });

  const rangeDw = document.getElementById('rangeSimDw');
  const badgeDw = document.getElementById('badgeSimDwVal');
  rangeDw?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.deadweight = val;
    if (badgeDw) badgeDw.textContent = `${val}%`;
    recalculate();
  });

  const rangeAt = document.getElementById('rangeSimAt');
  const badgeAt = document.getElementById('badgeSimAtVal');
  rangeAt?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.attribution = val;
    if (badgeAt) badgeAt.textContent = `${val}%`;
    recalculate();
  });

  const rangeDp = document.getElementById('rangeSimDp');
  const badgeDp = document.getElementById('badgeSimDpVal');
  rangeDp?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sim.displacement = val;
    if (badgeDp) badgeDp.textContent = `${val}%`;
    recalculate();
  });

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
    if (badgeInv) badgeInv.textContent = formatBahtCompact(baseInv);

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
    showToast(L('รีเซ็ตตัวเลื่อนกลับสู่ค่าเดิมของโครงการแล้ว', 'Reset sliders to baseline'), 'info');
  });

  // Save What-If as Scenario
  document.getElementById('btnSimSaveScenario')?.addEventListener('click', async () => {
    const curRatio = (
      sim.invAmount > 0 ? (basePv * sim.qtyMultiplier * sim.proxyMultiplier) / sim.invAmount : 0
    ).toFixed(2);
    const defaultName = isTh
      ? `แบบจำลอง What-If (งบ ${formatBahtCompact(sim.invAmount)}, SROI ${curRatio})`
      : `What-If Scenario (Budget ${formatBahtCompact(sim.invAmount)}, SROI ${curRatio})`;

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
        description: `Created from What-If Studio: Budget ${formatBaht(sim.invAmount)}, SROI ~${curRatio}`,
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

  // Scenario Management Modal Drawer
  document.getElementById('btnOpenScenarioDrawer')?.addEventListener('click', () => {
    openScenarioDrawerModal({ project, activeScenarioId, onSelect: () => renderStep6(container) });
  });

  // Audit Run
  document.getElementById('btnSaveRun')?.addEventListener('click', async () => {
    try {
      const run = await runCalculation(activeScenarioId);
      showToast(
        L(
          `บันทึกประวัติผลคำนวณรอบ #${run?.run?.id || ''} เรียบร้อยแล้ว`,
          `Calculation run #${run?.run?.id || ''} saved`,
        ),
        'success',
      );
    } catch (err) {
      showToast(`Failed to save run: ${err.message}`, 'error');
    }
  });

  // Export Report Modal
  document.getElementById('btnExportMenu')?.addEventListener('click', () => {
    openExportReportModal({ project, activeScenarioId });
  });

  attachWizardFooterEvents(container);

  // Initial calculation sync
  recalculate();
}

// ----------------------------------------------------------------------------
// SCENARIO DRAWER MODAL
// ----------------------------------------------------------------------------
function openScenarioDrawerModal({ project, activeScenarioId, onSelect }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const L = (th, en) => (isTh ? th : en);

  const modalHtml = `
    <div class="form-stack stack-md">
      <div class="toolbar" style="justify-content: space-between; align-items: center;">
        <span class="muted-sm">${L('เลือกแบบจำลองสถานการณ์เพื่อดูผลการประเมิน', 'Select an alternative scenario to evaluate')}</span>
        <button type="button" class="btn btn-secondary btn-compact" id="btnModalAddScenario">
          ${icons.plus} ${L('สร้างแบบจำลองใหม่', 'Add Scenario')}
        </button>
      </div>

      <div id="modalScenariosList">
        <div class="empty-state"><span class="muted-sm">${L('กำลังโหลด...', 'Loading...')}</span></div>
      </div>
    </div>
  `;

  const modal = openModal({
    title: L('จัดการแบบจำลองสถานการณ์ (Scenarios)', 'Manage Scenarios'),
    body: modalHtml,
  });

  const loadList = () => {
    const target = document.getElementById('modalScenariosList');
    if (!target) return;

    api.getScenarioComparison(project.id).then((res) => {
      const list = res?.data || [];
      if (list.length === 0) {
        target.innerHTML = `<div class="empty-state"><span class="muted-sm">${L('ยังไม่มีแบบจำลองทางเลือก', 'No scenarios configured')}</span></div>`;
        return;
      }

      const baseScenario = list.find((s) => s.is_base) || list[0];
      const baseRatioVal = baseScenario?.sroi_ratio ?? null;

      target.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${list
            .map((sc) => {
              const scId = sc.scenario_id ?? sc.id;
              const isSelected = scId === activeScenarioId || (!activeScenarioId && sc.is_base);
              const isBase = sc.is_base;
              const dRatio =
                sc.sroi_ratio != null && baseRatioVal != null ? sc.sroi_ratio - baseRatioVal : 0;
              const ratioTag =
                !isBase && Math.abs(dRatio) >= 0.01
                  ? `<span class="${dRatio > 0 ? 'val--positive' : 'val--negative'}" style="font-size: 0.75rem;">(${dRatio > 0 ? '+' : ''}${dRatio.toFixed(2)})</span>`
                  : '';

              return `
              <div style="padding: 10px 14px; background: ${isSelected ? 'var(--primary-soft)' : 'var(--surface)'}; border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--outline)'}; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="strong" style="font-size: 0.875rem;">${escapeHtml(sc.name)}</span>
                    ${isBase ? `<span class="badge badge-neutral" style="font-size: 0.625rem;">${L('ค่าตั้งต้น', 'Base')}</span>` : ''}
                  </div>
                  <div class="muted-sm" style="font-size: 0.75rem; margin-top: 2px;">
                    SROI: <strong class="primary-text">${sc.sroi_ratio != null ? `${sc.sroi_ratio.toFixed(2)}:1` : '-'}</strong> ${ratioTag}
                    · PV: ${formatBahtCompact(sc.present_value_of_impact ?? sc.present_value ?? 0)}
                  </div>
                </div>
                <div class="cluster stack-xs">
                  ${
                    isSelected
                      ? `<span class="status status--ok">${L('กำลังใช้งาน', 'Active')}</span>`
                      : `<button type="button" class="btn btn-secondary btn-compact" data-pick-scenario="${scId}">${L('เปิดใช้งาน', 'Activate')}</button>`
                  }
                  ${
                    !isBase
                      ? `<button type="button" class="btn btn-ghost btn-compact" data-del-scenario="${scId}" title="${L('ลบ', 'Delete')}" style="color:var(--error)">✕</button>`
                      : ''
                  }
                </div>
              </div>`;
            })
            .join('')}
        </div>
      `;

      target.querySelectorAll('[data-pick-scenario]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scId = Number(btn.dataset.pickScenario);
          await setActiveScenario(scId);
          modal.close();
          onSelect?.();
        });
      });

      target.querySelectorAll('[data-del-scenario]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const scId = Number(btn.dataset.delScenario);
          if (!confirm(L('ต้องการลบแบบจำลองสถานการณ์นี้ใช่หรือไม่?', 'Delete this scenario?')))
            return;
          try {
            await api.deleteScenario(project.id, scId);
            showToast(L('ลบเรียบร้อยแล้ว', 'Deleted successfully'), 'success');
            loadList();
          } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
          }
        });
      });
    });
  };

  document.getElementById('btnModalAddScenario')?.addEventListener('click', () => {
    openScenarioModal({
      onSave: () => {
        loadList();
        onSelect?.();
      },
    });
  });

  loadList();
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
