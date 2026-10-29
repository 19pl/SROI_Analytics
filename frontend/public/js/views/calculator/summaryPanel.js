import { icons } from '../../components/icons.js';
import { formatBaht } from '../../utils/format.js';
import { t } from '../../i18n.js';

/** ตัวเลขสรุปเล็ก ๆ 1 กล่อง ในแถวสามกล่อง */
const metricBox = (title, value) => `<div class="summary-metric-card">
  <span class="metric-title">${title}</span>
  <span class="metric-num">${value}</span>
</div>`;

/** แบนเนอร์สีส้ม: อัตราส่วน SROI + ป้ายคุ้มค่า/ต่ำกว่าเงินลงทุน */
function ratioBanner(ratio) {
  const isWorthy = ratio >= 1;

  const worthyBadge = isWorthy
    ? t('worthy_return', 'คุ้มค่าการลงทุน')
    : t('deficit_return', 'ต่ำกว่าเงินลงทุน');

  const unitLabel = t('ratio_unit_label', 'เท่าของต้นทุน');

  return `<div class="sroi-banner-nu ${isWorthy ? 'is-worthy' : 'is-deficit'}">
    <div class="sroi-banner-info">
      <span class="sroi-banner-sub">${t('card_sroi_ratio', 'ผลตอบแทนทางสังคม (SROI)')}</span>
      <div class="sroi-banner-ratio">${ratio.toFixed(2)} <small>${unitLabel}</small></div>
    </div>
    <span class="sroi-banner-badge">${worthyBadge}</span>
  </div>`;
}

/** แถบ NPV: สีเขียวเมื่อบวก สีแดงเมื่อลบ */
function npvStrip(npv) {
  const isPositive = npv >= 0;

  return `<div class="summary-npv-strip ${isPositive ? 'is-pos' : 'is-neg'}">
    <span class="npv-icon">${icons.trendUp}</span>
    <div class="npv-details">
      <span class="npv-label">${t('card_net_impact', 'มูลค่าปัจจุบันสุทธิ (NPV)')}</span>
      <span class="npv-val">${isPositive ? '+' : ''}${formatBaht(npv)}</span>
    </div>
  </div>`;
}

/** การ์ดสรุปผล: แบนเนอร์ SROI + 3 ตัวเลขสรุป + NPV */
export function summaryHtml(scenario, result) {
  return `<section class="card summary-card-nu">
    ${ratioBanner(result.ratio)}
    <div class="summary-metrics-grid">
      ${metricBox(t('card_total_benefits', 'มูลค่าปัจจุบันรวม'), formatBaht(result.totalPV))}
      ${metricBox(t('cost_total_investment', 'เงินลงทุน'), formatBaht(scenario.investment))}
      ${metricBox(t('field_discount_rate', 'อัตราคิดลด'), `${scenario.discountRate}%`)}
    </div>
    ${npvStrip(result.npv)}
  </section>`;
}
