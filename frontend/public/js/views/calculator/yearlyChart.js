import { card } from '../../components/ui.js';
import { formatBaht, formatBahtCompact } from '../../utils/format.js';
import { t } from '../../i18n.js';

/** แท่งกราฟ 1 ปี — ปีที่สูงสุดจะเน้นสีเข้ม */
function chartColumn(value, index, max) {
  const isPeak = value === max;
  const yearText = `${t('year', 'Year')} ${index + 1}`;

  return `<div class="chart-col">
    <span class="chart-value" title="${formatBaht(value)}">${formatBahtCompact(value)}</span>
    <div class="chart-bar ${isPeak ? 'is-peak' : ''}" style="height:${(value / max) * 100}%"
      title="${yearText}: ${formatBaht(value)}"></div>
    <span class="chart-label ${isPeak ? 'strong' : ''}">${yearText}</span>
  </div>`;
}

/** การ์ดกราฟแท่ง "มูลค่าปัจจุบันรายปี" */
export function yearlyChartCard({ yearlyPV }) {
  // ขั้นต่ำ 1 เพื่อไม่ให้หารด้วยศูนย์เมื่อทุกปีมีค่า 0
  const max = Math.max(...yearlyPV, 1);
  const columns = yearlyPV.map((value, i) => chartColumn(value, i, max)).join('');

  return card({
    title: t('yearly_pv_title', 'มูลค่าปัจจุบันรายปี'),
    description: t('yearly_pv_desc', 'หลังหัก Deadweight, Attribution, Drop-off และคิดลดแล้ว'),
    body: `<div class="chart chart-nu" role="img" aria-label="${t('yearly_pv_title', 'มูลค่าปัจจุบันรายปี')}">
      ${columns}
    </div>`,
  });
}
