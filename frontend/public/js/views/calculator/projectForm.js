import { card, numberField, textField } from '../../components/ui.js';
import { PROJECT_LIMITS, YEARS_INPUT_MAX } from '../../config/constants.js';

/** การ์ด "ข้อมูลโครงการ": ชื่อ เงินลงทุน ระยะเวลา และอัตราคิดลด */
export function projectFormCard(scenario) {
  return card({
    title: 'ข้อมูลโครงการ',
    description: 'กรอกเงินลงทุนและระยะเวลาที่ต้องการวัดผล',
    body: `<div class="form-grid">
      ${textField({ key: 'name', label: 'ชื่อโครงการ', value: scenario.name })}
      ${numberField({
        key: 'investment',
        label: 'เงินลงทุนรวม',
        suffix: 'บาท',
        value: scenario.investment,
        step: 10000,
        ...PROJECT_LIMITS.investment,
      })}
      ${numberField({
        key: 'years',
        label: 'ระยะเวลาวัดผล (ไม่เกิน 5 ปี)',
        suffix: 'ปี',
        value: scenario.years,
        min: PROJECT_LIMITS.years.min,
        max: YEARS_INPUT_MAX,
      })}
      ${numberField({
        key: 'discountRate',
        label: 'อัตราคิดลด',
        suffix: '%',
        value: scenario.discountRate,
        step: 0.5,
        ...PROJECT_LIMITS.discountRate,
      })}
    </div>`,
  });
}
