import { icons } from '../../components/icons.js';
import { formatBaht } from '../../utils/format.js';

/** ตัวเลขสรุปเล็ก ๆ 1 กล่อง ในแถวสามกล่อง */
const metricBox = (title, value) => `<div class="summary-metric-card">
  <span class="metric-title">${title}</span>
  <span class="metric-num">${value}</span>
</div>`;

/** แบนเนอร์สีส้ม: อัตราส่วน SROI + ป้ายคุ้มค่า/ต่ำกว่าเงินลงทุน */
function ratioBanner(ratio) {
  const isWorthy = ratio >= 1;

  return `<div class="sroi-banner-nu ${isWorthy ? 'is-worthy' : 'is-deficit'}">
    <div class="sroi-banner-info">
      <span class="sroi-banner-sub">ผลตอบแทนทางสังคม (SROI)</span>
      <div class="sroi-banner-ratio">${ratio.toFixed(2)} <small>เท่าของต้นทุน</small></div>
    </div>
    <span class="sroi-banner-badge">${isWorthy ? 'คุ้มค่าการลงทุน' : 'ต่ำกว่าเงินลงทุน'}</span>
  </div>`;
}

/** แถบ NPV: สีเขียวเมื่อบวก สีแดงเมื่อลบ */
function npvStrip(npv) {
  const isPositive = npv >= 0;

  return `<div class="summary-npv-strip ${isPositive ? 'is-pos' : 'is-neg'}">
    <span class="npv-icon">${icons.trendUp}</span>
    <div class="npv-details">
      <span class="npv-label">มูลค่าปัจจุบันสุทธิ (NPV)</span>
      <span class="npv-val">${isPositive ? '+' : ''}${formatBaht(npv)}</span>
    </div>
  </div>`;
}

/** การ์ดสรุปผล: แบนเนอร์ SROI + 3 ตัวเลขสรุป + NPV */
export function summaryHtml(scenario, result) {
  return `<section class="card summary-card-nu">
    ${ratioBanner(result.ratio)}
    <div class="summary-metrics-grid">
      ${metricBox('มูลค่าปัจจุบันรวม', formatBaht(result.totalPV))}
      ${metricBox('เงินลงทุน', formatBaht(scenario.investment))}
      ${metricBox('อัตราคิดลด', `${scenario.discountRate}%`)}
    </div>
    ${npvStrip(result.npv)}
  </section>`;
}
