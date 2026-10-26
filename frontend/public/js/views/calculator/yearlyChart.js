import { card } from '../../components/ui.js';
import { formatBaht, formatBahtCompact } from '../../utils/format.js';

/** แท่งกราฟ 1 ปี — ปีที่สูงสุดจะเน้นสีเข้ม */
function chartColumn(value, index, max) {
  const isPeak = value === max;

  return `<div class="chart-col">
    <span class="chart-value" title="${formatBaht(value)}">${formatBahtCompact(value)}</span>
    <div class="chart-bar ${isPeak ? 'is-peak' : ''}" style="height:${(value / max) * 100}%"
      title="ปี ${index + 1}: ${formatBaht(value)}"></div>
    <span class="chart-label ${isPeak ? 'strong' : ''}">ปี ${index + 1}</span>
  </div>`;
}

/** การ์ดกราฟแท่ง "มูลค่าปัจจุบันรายปี" */
export function yearlyChartCard({ yearlyPV }) {
  // ขั้นต่ำ 1 เพื่อไม่ให้หารด้วยศูนย์เมื่อทุกปีมีค่า 0
  const max = Math.max(...yearlyPV, 1);
  const columns = yearlyPV.map((value, i) => chartColumn(value, i, max)).join('');

  return card({
    title: 'มูลค่าปัจจุบันรายปี',
    description: 'หลังหัก Deadweight, Attribution, Drop-off และคิดลดแล้ว',
    body: `<div class="chart chart-nu" role="img" aria-label="กราฟแท่งมูลค่าปัจจุบันรายปี">
      ${columns}
    </div>`,
  });
}
