const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

export const formatBaht = (value) => baht.format(Math.round(value));

/** แบบย่อ (฿3.42M / ฿850K) สำหรับป้ายบนกราฟที่พื้นที่แคบ */
export function formatBahtCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `฿${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `฿${(value / 1e3).toFixed(0)}K`;
  return formatBaht(value);
}

export const formatRatio = (value) => `${value.toFixed(2)} : 1`;

export const formatNumber = (value, fractionDigits = 0) =>
  new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(Number(value) || 0);

export const formatCurrency = (value, currency = 'THB') =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
