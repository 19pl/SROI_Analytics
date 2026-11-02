/**
 * Step 5: Calculation Review & Readiness Check
 * Guided, beginner-friendly experience for university employees.
 * Provides structured overview, actionable blocker resolution, scenario testing, and tornado analysis.
 * Fully bilingual (Thai & English).
 */

import { getState } from '../../store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBaht, formatRatio } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

export function renderStep5(container) {
  const { project, review, activeScenarioId, costs, stakeholders, outcomes, investmentSummary } =
    getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const isReady = review?.ready ?? false;
  const blockers = review?.blockers || [];
  const warnings = review?.warnings || [];
  const completion = review?.completion || {};
  const summary = investmentSummary || { nominal_total: 0, cash_total: 0, in_kind_total: 0 };

  // Helper to determine step link for a blocker
  const getFixLink = (path = '') => {
    const p = String(path).toLowerCase();
    if (p.includes('cost') || p.includes('investment') || p.includes('discount'))
      return {
        step: 1,
        hash: '#/wizard/step-1',
        label: isTh ? 'แก้ไขในขั้นตอนที่ 1 (เงินลงทุน)' : 'Fix in Step 1 (Investment)',
      };
    if (p.includes('stakeholder'))
      return {
        step: 2,
        hash: '#/wizard/step-2',
        label: isTh ? 'แก้ไขในขั้นตอนที่ 2 (ผู้มีส่วนได้ส่วนเสีย)' : 'Fix in Step 2 (Stakeholders)',
      };
    if (p.includes('outcome') || p.includes('proxy') || p.includes('quantity'))
      return {
        step: 3,
        hash: '#/wizard/step-3',
        label: isTh ? 'แก้ไขในขั้นตอนที่ 3 (ผลลัพธ์)' : 'Fix in Step 3 (Outcomes)',
      };
    if (p.includes('adjustment') || p.includes('deadweight') || p.includes('attribution'))
      return {
        step: 4,
        hash: '#/wizard/step-4',
        label: isTh ? 'แก้ไขในขั้นตอนที่ 4 (การปรับปรุง)' : 'Fix in Step 4 (Adjustments)',
      };
    return { step: 1, hash: '#/wizard/step-1', label: isTh ? 'ตรวจสอบข้อมูล' : 'Review Input' };
  };

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Guidance Header -->
      <div class="alert alert-info in-banner" style="background: rgba(25, 118, 210, 0.08); border-left: 4px solid var(--primary); padding: var(--sp-md);">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--primary); display: block; margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 5: ตรวจสอบความถูกต้องและแบบจำลองสถานการณ์ (Review & Scenarios)' : 'Step 5: Review & Readiness Check'}
          </strong>
          <span style="font-size: 0.8125rem; color: var(--on-background);">
            ${
              isTh
                ? 'ตรวจสอบความครบถ้วนของข้อมูลก่อนประมวลผล หากมีข้อมูลจำเป็นที่ยังขาด ระบบจะมีปุ่มช่วยนำทางกลับไปแก้ไขได้ทันที'
                : 'Audit data completeness before running calculations. Resolve any blocking inputs with 1-click links.'
            }
          </span>
        </div>
      </div>

      <!-- Calculation Readiness Banner -->
      <div class="card has-stripe" style="--stripe: ${isReady ? 'var(--positive)' : 'var(--negative)'};">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              ${isReady ? (isTh ? '✅ ข้อมูลครบถ้วน พร้อมสำหรับการคำนวณ SROI' : '✅ Ready to Calculate SROI') : isTh ? '⚠️ พบข้อมูลที่ต้องแก้ไขก่อนคำนวณ (Calculation Blockers)' : '⚠️ Calculation Blockers Identified'}
            </h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${
                isReady
                  ? isTh
                    ? 'ข้อมูลที่จำเป็นทั้งหมดได้รับการตรวจสอบแล้ว คุณสามารถกดปุ่ม "คำนวณผลลัพธ์ SROI" เพื่อดูแดชบอร์ดสรุปผล'
                    : 'All mandatory parameters are satisfied. Review audit notes or proceed to final dashboard.'
                  : isTh
                    ? 'กรุณาแก้ไขรายการที่ติดขัดด้านล่างเพื่อให้ระบบสามารถคำนวณอัตราส่วน SROI ได้อย่างถูกต้อง'
                    : 'Please resolve the following required inputs before generating final results.'
              }
            </p>
          </div>
          <a class="btn btn-primary" href="#/wizard/step-6" ${!isReady ? 'style="opacity: 0.5; pointer-events: none;"' : 'style="font-weight: 600; padding: 10px 20px;"'}>
            ${isTh ? 'คำนวณผลลัพธ์ SROI →' : 'Proceed to Dashboard →'}
          </a>
        </div>

        ${
          blockers.length > 0
            ? `
          <div class="stack" style="gap: var(--sp-xs); margin-top: var(--sp-md);">
            <div style="font-size: 0.8125rem; font-weight: 700; color: var(--negative); margin-bottom: 2px;">
              ${isTh ? `รายการจำเป็นที่ต้องแก้ไขก่อน (${blockers.length} รายการ):` : `Required Items to Resolve (${blockers.length}):`}
            </div>
            ${blockers
              .map((b) => {
                const fix = getFixLink(b.path);
                return `
              <div class="review-item blocker" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; color: var(--negative);">✕</span>
                  <div>
                    <strong style="color: var(--on-background); font-size: 0.875rem;">${escapeHtml(b.message)}</strong>
                    <span class="muted" style="font-size: 0.75rem; margin-left: 6px;">(${escapeHtml(b.path)})</span>
                  </div>
                </div>
                <a href="${fix.hash}" class="btn btn-secondary" style="height: 28px; font-size: 0.75rem; padding: 0 10px;">
                  ${fix.label} →
                </a>
              </div>
            `;
              })
              .join('')}
          </div>
        `
            : ''
        }

        ${
          warnings.length > 0
            ? `
          <div class="stack" style="gap: var(--sp-xs); margin-top: var(--sp-md);">
            <div style="font-size: 0.8125rem; font-weight: 600; color: var(--warning); margin-bottom: 2px;">
              ⚠️ ${isTh ? `ข้อสังเกตและสมมติฐานการวิเคราะห์ (${warnings.length} รายการ):` : `Methodology & Audit Warnings (${warnings.length}):`}
            </div>
            ${warnings
              .map(
                (w) => `
              <div class="review-item warning">
                <span style="color: var(--warning); font-weight: 700;">•</span>
                <div style="font-size: 0.8125rem;">${escapeHtml(w.message)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>

      <!-- Structured Information Overview Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${isTh ? 'สรุปภาพรวมข้อมูลที่บันทึกไว้ (Assessment Summary Overview)' : 'Assessment Summary Overview'}</h3>
            <p class="muted" style="font-size: 0.8125rem;">${isTh ? 'คลิกที่ชื่อหัวข้อเพื่อย้อนกลับไปแก้ไขข้อมูลในขั้นตอนนั้นๆ ได้ทันที' : 'Click any section to quickly revisit and edit data'}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--sp-md);">
          <!-- Step 1 Summary -->
          <div style="background: var(--surface-soft); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.875rem; color: var(--primary);">1. ${isTh ? 'ข้อมูลโครงการและการลงทุน' : 'Project & Costs'}</strong>
              <a href="#/wizard/step-1" class="muted" style="font-size: 0.75rem;"><u>${isTh ? 'แก้ไข' : 'Edit'}</u></a>
            </div>
            <div style="font-size: 0.8125rem; line-height: 1.6;">
              <div>• ${isTh ? 'ชื่อ:' : 'Name:'} <strong>${escapeHtml(project.name)}</strong></div>
              <div>• ${isTh ? 'ระยะเวลาประเมิน:' : 'Horizon:'} <strong>${project.analysis_period_years || 1} ${t('years', 'ปี')}</strong></div>
              <div>• ${isTh ? 'เงินลงทุนรวม:' : 'Total Investment:'} <strong>${project.currency} ${formatBaht(summary.nominal_total || 0)}</strong></div>
            </div>
          </div>

          <!-- Step 2 Summary -->
          <div style="background: var(--surface-soft); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.875rem; color: var(--primary);">2. ${isTh ? 'ผู้มีส่วนได้ส่วนเสีย' : 'Stakeholders'}</strong>
              <a href="#/wizard/step-2" class="muted" style="font-size: 0.75rem;"><u>${isTh ? 'แก้ไข' : 'Edit'}</u></a>
            </div>
            <div style="font-size: 0.8125rem; line-height: 1.6;">
              <div>• ${isTh ? 'จำนวนกลุ่มที่ระบุ:' : 'Total Groups:'} <strong>${stakeholders.length} ${t('people', 'กลุ่ม')}</strong></div>
              <div>• ${isTh ? 'กลุ่มเป้าหมายหลัก (S1):' : 'Primary (S1):'} <strong>${stakeholders.filter((s) => s.stakeholder_group === 'primary_beneficiary').length} กลุ่ม</strong></div>
              <div>• ${isTh ? 'หน่วยงานสนับสนุน (S3/S4):' : 'Supporters (S3/S4):'} <strong>${stakeholders.filter((s) => s.stakeholder_group === 'project_supporter' || s.stakeholder_group === 'other_agency').length} แห่ง</strong></div>
            </div>
          </div>

          <!-- Step 3 Summary -->
          <div style="background: var(--surface-soft); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.875rem; color: var(--primary);">3. ${isTh ? 'ผลลัพธ์และตัวแทนทางการเงิน' : 'Outcomes & Proxies'}</strong>
              <a href="#/wizard/step-3" class="muted" style="font-size: 0.75rem;"><u>${isTh ? 'แก้ไข' : 'Edit'}</u></a>
            </div>
            <div style="font-size: 0.8125rem; line-height: 1.6;">
              <div>• ${isTh ? 'ผลลัพธ์ที่ระบุ:' : 'Total Outcomes:'} <strong>${outcomes.length} รายการ</strong></div>
              <div>• ${isTh ? 'ผลเชิงบวก (+):' : 'Positive:'} <strong>${outcomes.filter((o) => o.polarity !== 'negative').length}</strong> | ${isTh ? 'ผลเสีย (-):' : 'Harms:'} <strong>${outcomes.filter((o) => o.polarity === 'negative').length}</strong></div>
              <div>• ${isTh ? 'ประเมินมูลค่าแล้ว:' : 'Monetized:'} <strong>${outcomes.filter((o) => o.proxy_value !== null).length}/${outcomes.length}</strong></div>
            </div>
          </div>

          <!-- Step 4 Summary -->
          <div style="background: var(--surface-soft); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.875rem; color: var(--primary);">4. ${isTh ? 'การปรับปรุงผลกระทบส่วนเกิน' : 'Impact Adjustments'}</strong>
              <a href="#/wizard/step-4" class="muted" style="font-size: 0.75rem;"><u>${isTh ? 'แก้ไข' : 'Edit'}</u></a>
            </div>
            <div style="font-size: 0.8125rem; line-height: 1.6;">
              <div>• ${isTh ? 'สถานะการประเมิน:' : 'Status:'} <strong>${completion.adjustments ? (isTh ? 'ครบถ้วนสมบูรณ์ ✓' : 'Complete ✓') : isTh ? 'ยังมีช่องว่างที่ไม่ได้ประเมิน' : 'Partially assessed'}</strong></div>
              <div>• ${isTh ? 'ตัวปรับปรุง:' : 'Deductions:'} Deadweight, Attribution, Displacement, Drop-off</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(5, {
        canProceed: isReady,
        nextLabel: isTh
          ? 'คำนวณและดูแดชบอร์ดผลลัพธ์ (Step 6) →'
          : 'Proceed to Results Dashboard (Step 6) →',
      })}
    </div>
  `;

  attachWizardFooterEvents(container);
}

function openAddScenarioModal({ project, onSaved }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const formHtml = `
    <form id="scenarioForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('col_scenario', 'ชื่อสถานการณ์')} *</label>
        <input type="text" name="name" class="input" required placeholder="${isTh ? 'เช่น สถานการณ์แบบระมัดระวัง (ลดทอนผลลัพธ์ 20%)' : 'e.g. Conservative Cohort Retention'}" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'ประเภทสถานการณ์')} *</label>
          <select name="kind" class="input" required>
            <option value="conservative">${isTh ? 'สถานการณ์แบบระมัดระวัง (Conservative)' : 'Conservative Scenario'}</option>
            <option value="optimistic">${isTh ? 'สถานการณ์เชิงบวก (Optimistic)' : 'Optimistic Scenario'}</option>
            <option value="custom">${isTh ? 'สถานการณ์เฉพาะนโยบาย (Custom Policy)' : 'Custom Policy Scenario'}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'อัตราคิดลดเฉพาะสถานการณ์นี้ (%)' : 'Global Discount Rate Override (%)'}</label>
          <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" placeholder="${isTh ? 'เว้นว่างเพื่อใช้อัตราตามโครงการเดิม' : 'Leave blank to use base rate'}" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">${t('description', 'คำอธิบายและสมมติฐาน')}</label>
        <textarea name="description" class="input" rows="2" placeholder="${isTh ? 'ระบุเหตุผลและสมมติฐานของการทดสอบสถานการณ์นี้' : 'Document the purpose of this sensitivity scenario'}"></textarea>
      </div>
      <div id="scenarioModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: isTh ? 'สร้างแบบจำลองสถานการณ์ใหม่ (Add Scenario)' : 'Create Alternative Scenario',
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
      <button class="btn btn-primary" id="btnSaveScenario">${isTh ? 'บันทึกสถานการณ์' : 'Create Scenario'}</button>
    `,
  });

  document.getElementById('btnSaveScenario')?.addEventListener('click', async () => {
    const form = document.getElementById('scenarioForm');
    const errBox = document.getElementById('scenarioModalError');
    if (!form) return;

    const rateVal = form.discount_rate.value ? parseFloat(form.discount_rate.value) / 100 : null;

    const data = {
      name: form.name.value.trim(),
      kind: form.kind.value,
      description: form.description.value.trim(),
      assumptions: {
        global: rateVal !== null ? { discount_rate: rateVal } : {},
        outcomes: {},
      },
    };

    if (!data.name) {
      if (errBox) {
        errBox.textContent = isTh ? 'กรุณาระบุชื่อสถานการณ์' : 'Please enter a scenario name.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      await addScenario(data);
      closeModal();
      onSaved();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
