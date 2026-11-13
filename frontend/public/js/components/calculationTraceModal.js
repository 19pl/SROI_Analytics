/**
 * Calculation Trace Modal (ดูที่มาของตัวเลข / How Was This Calculated?)
 * Provides radical mathematical transparency for every key calculated metric in NU SROI.
 * Supports: SROI Ratio, Present Value of Impact, Total Investment, Net Social Value, and Individual Outcome lines.
 * Fully bilingual (Thai & English).
 */

import { openModal, closeModal } from './modal.js';
import { formatBaht } from '../utils/format.js';
import { escapeHtml } from '../utils/html.js';
import { getLanguage, t } from '../i18n.js';

export function openCalculationTraceModal({ metricType, project, result, outcome }) {
  const isTh = getLanguage() !== 'en';
  const summary = result?.summary || {};
  const currency = project?.currency || 'THB';
  const horizon = project?.analysis_period_years || 1;
  const discountRate = project?.discount_rate !== null ? (project?.discount_rate * 100).toFixed(1) : '0.0';

  let title = '';
  let contentHtml = '';

  switch (metricType) {
    case 'sroi_ratio': {
      title = isTh ? 'ที่มาของตัวเลข: อัตราส่วนผลตอบแทนทางสังคม (SROI Ratio)' : 'Trace: SROI Ratio Calculation';
      const pv = summary.present_value_of_impact || 0;
      const inv = summary.investment_used || 0;
      const ratio = summary.sroi_ratio !== null ? Number(summary.sroi_ratio).toFixed(2) : 'N/A';

      contentHtml = `
        <div class="form-stack stack-md">
          <div class="trace-card--primary">
            <div class="trace-card-title primary-text">
              ${isTh ? '1. สูตรการคำนวณหลัก (Core Formula)' : '1. Core Formula'}
            </div>
            <div class="trace-formula">
              ${isTh ? 'อัตราส่วน SROI = มูลค่าปัจจุบันของผลประโยชน์ทางสังคมสุทธิ (PV) ÷ เงินลงทุนรวม (Total Investment)' : 'SROI Ratio = Net Present Value of Social Benefits (PV) ÷ Total Investment'}
            </div>
            <div class="muted-sm">
              ${isTh ? 'คำนวณจากมูลค่าปัจจุบันสุทธิที่หักลบ Deadweight, Attribution และคิดลดแล้ว หารด้วยงบประมาณเงินลงทุนทั้งหมด' : 'Monetized present value of net societal benefits divided by total investment.'}
            </div>
          </div>

          <div>
            <div class="trace-card-title">${isTh ? '2. ตัวเลขที่นำมาคำนวณจริง (Actual Figures)' : '2. Actual Figures'}</div>
            <table class="table table--compact">
              <tbody>
                <tr>
                  <td><strong>${isTh ? 'ตัวตั้ง (Numerator):' : 'Numerator:'}</strong> ${isTh ? 'มูลค่าปัจจุบันของผลประโยชน์ (PV of Impact)' : 'Present Value of Impact'}</td>
                  <td class="num strong" class="val--positive">${currency} ${formatBaht(pv)}</td>
                </tr>
                <tr>
                  <td><strong>${isTh ? 'ตัวหาร (Denominator):' : 'Denominator:'}</strong> ${isTh ? 'เงินลงทุนรวม (Total Investment)' : 'Total Investment'}</td>
                  <td class="num strong" class="val--warning">${currency} ${formatBaht(inv)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="trace-card--positive">
            <div class="trace-card-title val--positive">
              ${isTh ? '3. ผลลัพธ์การคำนวณ (Calculation Step)' : '3. Result Step'}
            </div>
            <div class="trace-result-val">
              ${currency} ${formatBaht(pv)} ÷ ${currency} ${formatBaht(inv)} = <span class="primary-text trace-result-hero">${ratio} : 1</span>
            </div>
            <p class="muted" class="trace-subtext muted-sm">
              ${isTh ? `หมายความว่า ทุก 1 บาทที่มหาวิทยาลัยลงทุนในโครงการนี้ ก่อให้เกิดมูลค่าผลประโยชน์ทางสังคมประมาณ ${ratio} บาท` : `For every 1 unit invested, an estimated ${ratio} units of social value is generated.`}
            </p>
          </div>

          <div class="stack-top-sm border-top muted-sm" class="muted">
            <strong>${isTh ? 'สมมติฐานที่ใช้:' : 'Underlying Parameters:'}</strong> ${isTh ? 'ระยะเวลาประเมิน' : 'Horizon'} ${horizon} ${isTh ? 'ปี' : 'yr(s)'} | ${isTh ? 'อัตราคิดลด' : 'Discount Rate'} ${discountRate}% | ${isTh ? 'เกณฑ์เงินลงทุน' : 'Investment Basis'} ${project?.investment_basis === 'present_value' ? (isTh ? 'คิดลดเป็นมูลค่าปัจจุบัน' : 'Present Value') : (isTh ? 'ตามมูลค่าเงินสดจริง' : 'Nominal Cash')}
          </div>
        </div>
      `;
      break;
    }

    case 'total_investment': {
      title = isTh ? 'ที่มาของตัวเลข: เงินลงทุนรวม (Total Investment)' : 'Trace: Total Investment';
      const inv = summary.investment_used || 0;
      const cash = summary.cash_total || inv;
      const inKind = summary.in_kind_total || 0;

      contentHtml = `
        <div class="form-stack stack-md">
          <div class="trace-card--warning">
            <div class="trace-card-title val--warning">
              ${isTh ? 'นิยามของเงินลงทุนใน SROI (Investment Definition)' : 'Investment Definition in SROI'}
            </div>
            <p class="muted-sm">
              ${isTh ? 'เงินลงทุนรวมคือมูลค่ารวมของทรัพยากรทั้งหมดที่โครงการนำมาใช้จริงเพื่อขับเคลื่อนกิจกรรม ประกอบด้วยงบประมาณเงินสด (งบดำเนินงาน/อุปกรณ์/ค่าตอบแทน) และสิ่งสนับสนุนที่ไม่ใช่ตัวเงิน (In-Kind / อาสาสมัคร)' : 'Total value of resources committed to project activities, including cash outlays and in-kind / volunteer contributions.'}
            </p>
          </div>

          <div>
            <div class="trace-card-title">${isTh ? 'โครงสร้างงบประมาณที่บันทึกไว้ในขั้นตอนที่ 1' : 'Itemized Cost Structure (Step 1)'}</div>
            <table class="table table--compact">
              <tbody>
                <tr>
                  <td>${isTh ? 'ค่าใช้จ่ายเงินสดจริง (Cash Expenditures)' : 'Direct Cash Expenditures'}</td>
                  <td class="num strong">${currency} ${formatBaht(cash)}</td>
                </tr>
                <tr>
                  <td>${isTh ? 'สิ่งสนับสนุนที่ไม่ใช่ตัวเงิน / อาสาสมัคร (In-Kind Contributions)' : 'In-Kind / Volunteer Contributions'}</td>
                  <td class="num strong">${currency} ${formatBaht(inKind)}</td>
                </tr>
                <tr class="panel--soft strong">
                  <td>${isTh ? 'ยอดรวมเงินลงทุนที่นำไปคิดอัตราส่วน SROI' : 'Total Investment Used in Calculation'}</td>
                  <td class="num" class="val--warning">${currency} ${formatBaht(inv)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      break;
    }

    case 'present_value': {
      title = isTh ? 'ที่มาของตัวเลข: มูลค่าปัจจุบันของผลกระทบทางสังคม (PV of Impact)' : 'Trace: Present Value of Impact';
      const pv = summary.present_value_of_impact || 0;
      const positivePv = summary.positive_present_value || pv;
      const negativePv = summary.negative_present_value || 0;
      const outcomesList = result?.outcomes || [];

      contentHtml = `
        <div class="form-stack stack-md">
          <div class="trace-card--positive">
            <div class="trace-card-title val--positive">
              ${isTh ? 'สูตรการคำนวณมูลค่าปัจจุบัน (Present Value Formula)' : 'Present Value Formula'}
            </div>
            <div class="trace-formula">
              ${isTh ? 'PV = Σ [ มูลค่าสุทธิรายปี ÷ (1 + r)^t ]' : 'PV = Σ [ Annual Net Value ÷ (1 + r)^t ]'}
            </div>
            <p class="muted" class="muted-sm">
              ${isTh ? `คำนวณโดยนำมูลค่าผลลัพธ์สุทธิแต่ละปีมาคิดลดด้วยอัตรา ${discountRate}% ต่อปี เพื่อปรับมูลค่าในอนาคตให้เป็นมูลค่าเงิน ณ ปัจจุบัน` : `Discounted at ${discountRate}% annually to adjust future value to present terms.`}
            </p>
          </div>

          <div>
            <div class="trace-card-title">${isTh ? 'มูลค่าปัจจุบันจำแนกตามผลลัพธ์แต่ละรายการ' : 'Breakdown by Outcome Line'}</div>
            <div class="table-wrap">
              <table class="table table--compact">
                <thead>
                  <tr>
                    <th>${isTh ? 'ผลลัพธ์' : 'Outcome'}</th>
                    <th class="num">${isTh ? 'มูลค่าขั้นต้น' : 'Gross'}</th>
                    <th class="num">${isTh ? 'สัดส่วนสุทธิ' : 'Retained %'}</th>
                    <th class="num">${isTh ? 'มูลค่าปัจจุบัน (PV)' : 'Discounted PV'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${outcomesList.map(o => `
                    <tr>
                      <td class="strong">${escapeHtml(o.name)}</td>
                      <td class="num">${currency} ${formatBaht(o.totals?.gross || 0)}</td>
                      <td class="num">${((o.adjustment_factor || 0) * 100).toFixed(1)}%</td>
                      <td class="num strong" class="${(o.totals?.present_value || 0) < 0 ? 'val--negative' : 'val--positive'}">
                        ${currency} ${formatBaht(o.totals?.present_value || 0)}
                      </td>
                    </tr>
                  `).join('')}
                  <tr class="panel--soft strong">
                    <td>${isTh ? 'รวมมูลค่าปัจจุบันสุทธิทั้งหมด' : 'Total Present Value'}</td>
                    <td colspan="2"></td>
                    <td class="num" class="val--positive">${currency} ${formatBaht(pv)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      break;
    }

    case 'outcome_line': {
      if (!outcome) return;
      title = isTh ? `ที่มาของผลลัพธ์: ${escapeHtml(outcome.name)}` : `Trace: ${escapeHtml(outcome.name)}`;
      const o = outcome;
      const sign = o.polarity === 'negative' ? -1 : 1;
      const qty = o.quantity || 0;
      const proxy = o.proxy_value || 0;
      const gross = proxy * sign; // operating-year value is the total, not multiplied by people
      const dw = o.deadweight !== null && o.deadweight !== undefined ? Number(o.deadweight) : 0;
      const at = o.attribution !== null && o.attribution !== undefined ? Number(o.attribution) : 0;
      const dp = o.displacement !== null && o.displacement !== undefined ? Number(o.displacement) : 0;
      const retained = (1 - dw) * (1 - at) * (1 - dp);
      const netAnnual = gross * retained;

      contentHtml = `
        <div class="form-stack stack-md">
          <div class="panel panel--soft">
            <div class="trace-card-title">${isTh ? 'ขั้นตอนที่ 1: การประมาณมูลค่าขั้นต้น (Gross Valuation)' : 'Step 1: Gross Valuation'}</div>
            <div class="muted-sm">
              ${isTh ? 'มูลค่าในปีดำเนินงาน (บาทต่อปี)' : 'Value in operating year (THB per year)'}: <strong>${currency} ${formatBaht(proxy)}</strong> = <strong class="primary-text">${currency} ${formatBaht(gross)}/ปี</strong>
            </div>
            ${o.proxy_source ? `<div class="muted" class="trace-subtext muted-sm">${isTh ? 'แหล่งอ้างอิงตัวแทนทางการเงิน' : 'Financial proxy source'}: ${escapeHtml(o.proxy_source)}</div>` : ''}
          </div>

          <div class="panel panel--soft">
            <div class="trace-card-title">${isTh ? 'ขั้นตอนที่ 2: การหักลบผลกระทบส่วนเกิน (Impact Deductions)' : 'Step 2: Impact Deductions'}</div>
            <ul class="trace-list muted-sm">
              <li>${isTh ? 'Deadweight (สิ่งที่เกิดขึ้นอยู่แล้ว)' : 'Deadweight (would have occurred anyway)'}: <strong>${(dw * 100).toFixed(1)}%</strong></li>
              <li>${isTh ? 'Attribution (ผลจากหน่วยงานอื่น)' : 'Attribution (contribution by other parties)'}: <strong>${(at * 100).toFixed(1)}%</strong></li>
              <li>${isTh ? 'Displacement (ผลกระทบที่ย้ายไปยังกลุ่มอื่น)' : 'Displacement (impact displaced to other groups)'}: <strong>${(dp * 100).toFixed(1)}%</strong></li>
            </ul>
            <div class="trace-formula">
              ${isTh ? 'สัดส่วนผลประโยชน์สุทธิที่อ้างสิทธิ์ได้' : 'Net attributable share'} = (1 - ${(dw).toFixed(2)}) × (1 - ${(at).toFixed(2)}) × (1 - ${(dp).toFixed(2)}) = ${(retained * 100).toFixed(1)}%
            </div>
          </div>

          <div class="trace-card--primary">
            <div class="trace-card-title primary-text">${isTh ? 'ขั้นตอนที่ 3: มูลค่าสุทธิต่อปี (Net Retained Value)' : 'Step 3: Net Annual Retained Value'}</div>
            <div class="trace-result-val">
              ${currency} ${formatBaht(gross)} × ${(retained * 100).toFixed(1)}% = <span class="primary-text">${currency} ${formatBaht(netAnnual)}</span>
            </div>
          </div>
        </div>
      `;
      break;
    }

    default: {
      title = isTh ? 'คำอธิบายการคำนวณ' : 'Calculation Trace';
      contentHtml = `<p class="muted">${isTh ? 'ไม่มีข้อมูลรายละเอียด' : 'No trace details available.'}</p>`;
    }
  }

  openModal({
    title,
    body: contentHtml,
    footer: `
      <button class="btn btn-primary" data-modal-close>${isTh ? 'เข้าใจแล้ว (ปิดหน้าต่าง)' : 'Close'}</button>
    `,
  });
}
