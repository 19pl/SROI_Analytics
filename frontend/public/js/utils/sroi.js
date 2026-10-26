const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** สูตรหลักของ SROI: แก้ที่ไฟล์นี้ไฟล์เดียว */
export function calculateSroi(s) {
  const rows = s.outcomes.map((outcome) => {
    const base = outcome.quantity * outcome.proxyValue * (1 - outcome.deadweight / 100) * (1 - outcome.attribution / 100);
    const yearly = Array.from(
      { length: s.years },
      (_, i) => (base * Math.pow(1 - outcome.dropOff / 100, i)) / Math.pow(1 + s.discountRate / 100, i + 1),
    );
    return { outcome, yearly, presentValue: sum(yearly) };
  });
  const yearlyPV = Array.from({ length: s.years }, (_, i) => sum(rows.map((r) => r.yearly[i])));
  const totalPV = sum(yearlyPV);
  return { rows, yearlyPV, totalPV, npv: totalPV - s.investment, ratio: s.investment > 0 ? totalPV / s.investment : 0 };
}

const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
export const formatBaht = (v) => baht.format(Math.round(v));
/** แบบย่อ (฿3.42M / ฿850K) สำหรับป้ายบนกราฟที่พื้นที่แคบ */
export const formatBahtCompact = (v) =>
  Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(0)}K` : formatBaht(v);
export const formatRatio = (v) => `${v.toFixed(2)} : 1`;
export const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
