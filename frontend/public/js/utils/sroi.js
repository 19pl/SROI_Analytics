import { sum } from './math.js';

const percentToRate = (percent) => percent / 100;

/**
 * มูลค่าของผลลัพธ์ 1 รายการ ณ ปีแรก (ก่อนคิดลด)
 * = จำนวน × มูลค่าต่อหน่วย × (1 − Deadweight) × (1 − Attribution)
 */
function baseValue({ quantity, proxyValue, deadweight, attribution }) {
  return quantity * proxyValue * (1 - percentToRate(deadweight)) * (1 - percentToRate(attribution));
}

/**
 * มูลค่าปัจจุบันของผลลัพธ์ 1 รายการ แยกรายปี
 * ปีที่ i (เริ่มที่ 0): ลดลงด้วย Drop-off ปีละ i รอบ แล้วคิดลดด้วยอัตราคิดลด (i + 1) ปี
 */
function yearlyPresentValues(outcome, { years, discountRate }) {
  const base = baseValue(outcome);
  const retention = 1 - percentToRate(outcome.dropOff);
  const discountFactor = 1 + percentToRate(discountRate);

  return Array.from(
    { length: years },
    (_, i) => (base * Math.pow(retention, i)) / Math.pow(discountFactor, i + 1),
  );
}

/**
 * สูตรหลักของ SROI: แก้ที่ไฟล์นี้ไฟล์เดียว
 * @param {object} scenario โครงการ { investment, years, discountRate, outcomes[] }
 * @returns {{ rows, yearlyPV, totalPV, npv, ratio }}
 */
export function calculateSroi(scenario) {
  const rows = scenario.outcomes.map((outcome) => {
    const yearly = yearlyPresentValues(outcome, scenario);
    return { outcome, yearly, presentValue: sum(yearly) };
  });

  const yearlyPV = Array.from({ length: scenario.years }, (_, i) =>
    sum(rows.map((row) => row.yearly[i])),
  );
  const totalPV = sum(yearlyPV);
  const { investment } = scenario;

  return {
    rows,
    yearlyPV,
    totalPV,
    npv: totalPV - investment,
    ratio: investment > 0 ? totalPV / investment : 0,
  };
}
