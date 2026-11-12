import { getLanguage } from '../i18n.js';

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

/**
 * Preset measurement units are stored as Thai text. Show them in the active language
 * (custom units typed by the user are shown exactly as entered).
 */
const UNIT_EN = {
  'คน': 'person',
  'คน / ปี': 'person / year',
  'คน / เดือน': 'person / month',
  'ครัวเรือน': 'household',
  'ครัวเรือน / ปี': 'household / year',
  'คณะ': 'faculty',
  'ภาควิชา': 'department',
  'แห่ง': 'site',
  'แห่ง / ปี': 'site / year',
  'หน่วยงาน': 'agency',
  'กลุ่ม': 'group',
  'ตัน / ปี': 'tonne / year',
};
const UNIT_TH = Object.fromEntries(Object.entries(UNIT_EN).map(([th, en]) => [en, th]));

export function displayUnit(unit) {
  const u = String(unit ?? '');
  return getLanguage() === 'en' ? (UNIT_EN[u] ?? u) : (UNIT_TH[u] ?? u);
}
