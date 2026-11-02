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
      title = isTh ? '🔍 ที่มาของตัวเลข: อัตราส่วนผลตอบแทนทางสังคม (SROI Ratio)' : '🔍 Trace: SROI Ratio Calculation';
      const pv = summary.present_value_of_impact || 0;
      const inv = summary.investment_used || 0;
      const ratio = summary.sroi_ratio !== null ? Number(summary.sroi_ratio).toFixed(2) : 'N/A';

      contentHtml = `
        <div class="stack" style="gap: var(--sp-md); font-size: 0.875rem; line-height: 1.6;">
          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">
              ${isTh ? '1. สูตรการคำนวณหลัก (Core Formula)' : '1. Core Formula'}
            </div>
            <div style="font-family: monospace; font-size: 0.9375rem; background: var(--surface-card); padding: 8px 12px; border-radius: 4px; margin: 6px 0;">
              SROI Ratio = มูลค่าปัจจุบันของผลประโยชน์ทางสังคมสุทธิ (PV) ÷ เงินลงทุนรวม (Total Investment)
            </div>
            <div class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'คำนวณจากมูลค่าปัจจุบันสุทธิที่หักลบ Deadweight, Attribution และคิดลดแล้ว หารด้วยงบประมาณเงินลงทุนทั้งหมด' : 'Monetized present value of net societal benefits divided by total investment.'}
            </div>
          </div>

          <div>
            <div style="font-weight: 700; margin-bottom: 6px;">${isTh ? '2. ตัวเลขที่นำมาคำนวณจริง (Actual Figures)' : '2. Actual Figures'}</div>
            <table class="table" style="font-size: 0.8125rem;">
              <tbody>
                <tr>
                  <td><strong>${isTh ? 'ตัวตั้ง (Numerator):' : 'Numerator:'}</strong> ${isTh ? 'มูลค่าปัจจุบันของผลประโยชน์ (PV of Impact)' : 'Present Value of Impact'}</td>
                  <td class="num strong" style="color: var(--positive);">${currency} ${formatBaht(pv)}</td>
                </tr>
                <tr>
                  <td><strong>${isTh ? 'ตัวหาร (Denominator):' : 'Denominator:'}</strong> ${isTh ? 'เงินลงทุนรวม (Total Investment)' : 'Total Investment'}</td>
                  <td class="num strong" style="color: var(--warning);">${currency} ${formatBaht(inv)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="background: rgba(46, 125, 50, 0.08); padding: var(--sp-md); border-radius: var(--radius-md); border-left: 4px solid var(--positive);">
            <div style="font-weight: 700; color: var(--positive); margin-bottom: 4px;">
              ${isTh ? '3. ผลลัพธ์การคำนวณ (Calculation Step)' : '3. Result Step'}
            </div>
            <div style="font-size: 1.125rem; font-weight: 800; color: var(--on-background);">
              ${currency} ${formatBaht(pv)} ÷ ${currency} ${formatBaht(inv)} = <span style="color: var(--primary); font-size: 1.35rem;">${ratio} : 1</span>
            </div>
            <p class="muted" style="font-size: 0.8125rem; margin: 4px 0 0 0;">
              ${isTh ? `หมายความว่า ทุก 1 บาทที่มหาวิทยาลัยลงทุนในโครงการนี้ ก่อให้เกิดมูลค่าผลประโยชน์ทางสังคมประมาณ ${ratio} บาท` : `For every 1 unit invested, an estimated ${ratio} units of social value is generated.`}
            </p>
          </div>

          <div style="border-top: 1px solid var(--outline); padding-top: var(--sp-sm); font-size: 0.8125rem;" class="muted">
            <strong>${isTh ? 'สมมติฐานที่ใช้:' : 'Underlying Parameters:'}</strong> ${isTh ? 'ระยะเวลาประเมิน' : 'Horizon'} ${horizon} ${isTh ? 'ปี' : 'yr(s)'} | ${isTh ? 'อัตราคิดลด' : 'Discount Rate'} ${discountRate}% | ${isTh ? 'เกณฑ์เงินลงทุน' : 'Investment Basis'} ${project?.investment_basis === 'present_value' ? (isTh ? 'คิดลดเป็นมูลค่าปัจจุบัน' : 'Present Value') : (isTh ? 'ตามมูลค่าเงินสดจริง' : 'Nominal Cash')}
          </div>
        </div>
      `;
      break;
    }

    case 'total_investment': {
      title = isTh ? '🔍 ที่มาของตัวเลข: เงินลงทุนรวม (Total Investment)' : '🔍 Trace: Total Investment';
      const inv = summary.investment_used || 0;
      const cash = summary.cash_total || inv;
      const inKind = summary.in_kind_total || 0;

      contentHtml = `
        <div class="stack" style="gap: var(--sp-md); font-size: 0.875rem; line-height: 1.6;">
          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border-left: 4px solid var(--warning);">
            <div style="font-weight: 700; color: var(--warning); margin-bottom: 4px;">
              ${isTh ? 'นิยามของเงินลงทุนใน SROI (Investment Definition)' : 'Investment Definition in SROI'}
            </div>
            <p style="margin: 0; font-size: 0.8125rem;">
              ${isTh ? 'เงินลงทุนรวมคือมูลค่ารวมของทรัพยากรทั้งหมดที่โครงการนำมาใช้จริงเพื่อขับเคลื่อนกิจกรรม ประกอบด้วยงบประมาณเงินสด (งบดำเนินงาน/อุปกรณ์/ค่าตอบแทน) และสิ่งสนับสนุนที่ไม่ใช่ตัวเงิน (In-Kind / อาสาสมัคร)' : 'Total value of resources committed to project activities, including cash outlays and in-kind / volunteer contributions.'}
            </p>
          </div>

          <div>
            <div style="font-weight: 700; margin-bottom: 6px;">${isTh ? 'โครงสร้างงบประมาณที่บันทึกไว้ในขั้นตอนที่ 1' : 'Itemized Cost Structure (Step 1)'}</div>
            <table class="table" style="font-size: 0.8125rem;">
              <tbody>
                <tr>
                  <td>${isTh ? 'ค่าใช้จ่ายเงินสดจริง (Cash Expenditures)' : 'Direct Cash Expenditures'}</td>
                  <td class="num strong">${currency} ${formatBaht(cash)}</td>
                </tr>
                <tr>
                  <td>${isTh ? 'สิ่งสนับสนุนที่ไม่ใช่ตัวเงิน / อาสาสมัคร (In-Kind Contributions)' : 'In-Kind / Volunteer Contributions'}</td>
                  <td class="num strong">${currency} ${formatBaht(inKind)}</td>
                </tr>
                <tr style="background: var(--surface-soft); font-weight: 700;">
                  <td>${isTh ? 'ยอดรวมเงินลงทุนที่นำไปคิดอัตราส่วน SROI' : 'Total Investment Used in Calculation'}</td>
                  <td class="num" style="color: var(--warning); font-size: 1rem;">${currency} ${formatBaht(inv)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      break;
    }

    case 'present_value': {
      title = isTh ? '🔍 ที่มาของตัวเลข: มูลค่าปัจจุบันของผลกระทบทางสังคม (PV of Impact)' : '🔍 Trace: Present Value of Impact';
      const pv = summary.present_value_of_impact || 0;
      const positivePv = summary.positive_present_value || pv;
      const negativePv = summary.negative_present_value || 0;
      const outcomesList = result?.outcomes || [];

      contentHtml = `
        <div class="stack" style="gap: var(--sp-md); font-size: 0.875rem; line-height: 1.6;">
          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border-left: 4px solid var(--positive);">
            <div style="font-weight: 700; color: var(--positive); margin-bottom: 4px;">
              ${isTh ? 'สูตรการคำนวณมูลค่าปัจจุบัน (Present Value Formula)' : 'Present Value Formula'}
            </div>
            <div style="font-family: monospace; font-size: 0.8125rem; background: var(--surface-card); padding: 8px 12px; border-radius: 4px; margin: 6px 0;">
              PV = Σ [ มูลค่าสุทธิรายปี ÷ (1 + r)^t ]
            </div>
            <p class="muted" style="margin: 0; font-size: 0.8125rem;">
              ${isTh ? `คำนวณโดยนำมูลค่าผลลัพธ์สุทธิแต่ละปีมาคิดลดด้วยอัตรา ${discountRate}% ต่อปี เพื่อปรับมูลค่าในอนาคตให้เป็นมูลค่าเงิน ณ ปัจจุบัน` : `Discounted at ${discountRate}% annually to adjust future value to present terms.`}
            </p>
          </div>

          <div>
            <div style="font-weight: 700; margin-bottom: 6px;">${isTh ? 'มูลค่าปัจจุบันจำแนกตามผลลัพธ์แต่ละรายการ' : 'Breakdown by Outcome Line'}</div>
            <div class="table-wrap">
              <table class="table" style="font-size: 0.8125rem;">
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
                      <td class="num strong" style="color: ${(o.totals?.present_value || 0) < 0 ? 'var(--negative)' : 'var(--positive)'};">
                        ${currency} ${formatBaht(o.totals?.present_value || 0)}
                      </td>
                    </tr>
                  `).join('')}
                  <tr style="background: var(--surface-soft); font-weight: 700;">
                    <td>${isTh ? 'รวมมูลค่าปัจจุบันสุทธิทั้งหมด' : 'Total Present Value'}</td>
                    <td colspan="2"></td>
                    <td class="num" style="color: var(--positive); font-size: 0.9375rem;">${currency} ${formatBaht(pv)}</td>
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
      title = isTh ? `🔍 ที่มาของผลลัพธ์: ${escapeHtml(outcome.name)}` : `🔍 Trace: ${escapeHtml(outcome.name)}`;
      const o = outcome;
      const sign = o.polarity === 'negative' ? -1 : 1;
      const qty = o.quantity || 0;
      const proxy = o.proxy_value || 0;
      const gross = qty * proxy * sign;
      const dw = o.deadweight !== null && o.deadweight !== undefined ? Number(o.deadweight) : 0;
      const at = o.attribution !== null && o.attribution !== undefined ? Number(o.attribution) : 0;
      const dp = o.displacement !== null && o.displacement !== undefined ? Number(o.displacement) : 0;
      const retained = (1 - dw) * (1 - at) * (1 - dp);
      const netAnnual = gross * retained;

      contentHtml = `
        <div class="stack" style="gap: var(--sp-md); font-size: 0.875rem; line-height: 1.6;">
          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md);">
            <div style="font-weight: 700; margin-bottom: 4px;">${isTh ? 'ขั้นตอนที่ 1: การประมาณมูลค่าขั้นต้น (Gross Valuation)' : 'Step 1: Gross Valuation'}</div>
            <div style="font-size: 0.8125rem;">
              ${isTh ? 'จำนวนผู้รับผล' : 'Beneficiaries'}: <strong>${Number(qty).toLocaleString()}</strong> × ${isTh ? 'ตัวแทนทางการเงิน' : 'Financial Proxy'}: <strong>${currency} ${formatBaht(proxy)}</strong> = <strong style="color: var(--primary);">${currency} ${formatBaht(gross)}/ปี</strong>
            </div>
            ${o.proxy_source ? `<div class="muted" style="font-size: 0.75rem; margin-top: 4px;">แหล่งอ้างอิงตัวแทนทางการเงิน: ${escapeHtml(o.proxy_source)}</div>` : ''}
          </div>

          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md);">
            <div style="font-weight: 700; margin-bottom: 4px;">${isTh ? 'ขั้นตอนที่ 2: การหักลบผลกระทบส่วนเกิน (Impact Deductions)' : 'Step 2: Impact Deductions'}</div>
            <ul style="font-size: 0.8125rem; margin: 0; padding-left: 18px;">
              <li>Deadweight (เกิดอยู่แล้ว): <strong>${(dw * 100).toFixed(1)}%</strong></li>
              <li>Attribution (หน่วยงานอื่นมีส่วนร่วม): <strong>${(at * 100).toFixed(1)}%</strong></li>
              <li>Displacement (ย้ายปัญหา): <strong>${(dp * 100).toFixed(1)}%</strong></li>
            </ul>
            <div style="font-family: monospace; font-size: 0.8125rem; background: var(--surface-card); padding: 6px 10px; border-radius: 4px; margin-top: 6px;">
              สัดส่วนผลประโยชน์สุทธิที่อ้างสิทธิ์ได้ = (1 - ${(dw).toFixed(2)}) × (1 - ${(at).toFixed(2)}) × (1 - ${(dp).toFixed(2)}) = ${(retained * 100).toFixed(1)}%
            </div>
          </div>

          <div style="background: rgba(25, 118, 210, 0.08); padding: var(--sp-md); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${isTh ? 'ขั้นตอนที่ 3: มูลค่าสุทธิต่อปี (Net Retained Value)' : 'Step 3: Net Annual Retained Value'}</div>
            <div style="font-size: 1.125rem; font-weight: 800;">
              ${currency} ${formatBaht(gross)} × ${(retained * 100).toFixed(1)}% = <span style="color: var(--primary);">${currency} ${formatBaht(netAnnual)}</span>
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
