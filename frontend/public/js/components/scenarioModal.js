/**
 * Shared Scenario Modal Component
 * Used across Step 5 Review and Step 6 Dashboard
 */

import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/html.js';
import { t, getLanguage } from '../i18n.js';
import { addScenario } from '../store.js';

export function openScenarioModal({ onSave, existing = null } = {}) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const isEdit = Boolean(existing && existing.id);
  const existingName = existing?.name || '';
  const existingKind = existing?.kind || 'conservative';
  const existingDesc = existing?.description || '';
  const existingDiscountRate =
    existing?.assumptions?.global?.discount_rate != null
      ? (Number(existing?.assumptions?.global?.discount_rate) * 100).toFixed(1).replace(/\.0$/, '')
      : '';
  const hasCustomRate = Boolean(existingDiscountRate);

  const title = isEdit
    ? isTh
      ? 'แก้ไขแบบจำลองสถานการณ์'
      : 'Edit Alternative Scenario'
    : isTh
      ? 'สร้างแบบจำลองสถานการณ์ใหม่'
      : 'Create Alternative Scenario';

  const modalHtml = `
    <form id="sharedScenarioForm" class="form-stack">
      <div class="field">
        <label class="field-label">${t('col_scenario', 'ชื่อสถานการณ์')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span></label>
        <input
          type="text"
          name="name"
          class="input"
          required
          value="${escapeHtml(existingName)}"
          placeholder="${isTh ? 'เช่น สถานการณ์แบบระมัดระวัง (ลดทอนผลลัพธ์ 20%)' : 'e.g. Conservative Cohort Retention'}"
        />
      </div>

      <div class="form-row">
        <div class="field">
          <label class="field-label">${t('col_eval_type', 'ประเภทสถานการณ์')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span></label>
          <select name="kind" class="input" required>
            <option value="conservative" ${existingKind === 'conservative' ? 'selected' : ''}>
              ${isTh ? 'สถานการณ์แบบระมัดระวัง (Conservative)' : 'Conservative Scenario'}
            </option>
            <option value="optimistic" ${existingKind === 'optimistic' ? 'selected' : ''}>
              ${isTh ? 'สถานการณ์เชิงบวก (Optimistic)' : 'Optimistic Scenario'}
            </option>
            <option value="custom" ${existingKind === 'custom' ? 'selected' : ''}>
              ${isTh ? 'สถานการณ์เฉพาะนโยบาย (Custom Policy)' : 'Custom Policy Scenario'}
            </option>
          </select>
        </div>

        <div class="field">
          <label class="field-label">${isTh ? 'อัตราคิดลด' : 'Discount Rate Option'}</label>
          <label class="cluster stack-xs" style="margin-top: 8px;">
            <input type="checkbox" id="chkCustomDiscount" ${hasCustomRate ? 'checked' : ''} />
            <span>${isTh ? 'ใช้อัตราคิดลดเฉพาะสถานการณ์นี้' : 'Use a custom discount rate'}</span>
          </label>
        </div>
      </div>

      <div class="field" id="customDiscountWrap" ${hasCustomRate ? '' : 'hidden'}>
        <label class="field-label">${isTh ? 'อัตราคิดลดเฉพาะสถานการณ์นี้ (%)' : 'Global Discount Rate Override (%)'}</label>
        <div class="pct-wrap">
          <input
            type="number"
            name="discount_rate"
            step="0.1"
            min="0"
            max="100"
            class="input"
            value="${escapeHtml(existingDiscountRate)}"
            placeholder="${isTh ? 'เว้นว่างเพื่อใช้อัตราตามโครงการเดิม' : 'Leave blank to use base rate'}"
          />
          <span class="muted-sm pct-wrap__suffix">%</span>
        </div>
        <p class="field-hint">${isTh ? 'อัตราคิดลดนี้จะนำมาใช้แทนอัตราคิดลดเดิมของโครงการเฉพาะในสถานการณ์นี้' : 'This rate will override the project discount rate for this scenario calculation.'}</p>
      </div>

      <div class="field">
        <label class="field-label">${t('description', 'คำอธิบายและสมมติฐาน')}</label>
        <textarea
          name="description"
          class="input"
          rows="2"
          placeholder="${isTh ? 'ระบุเหตุผลและสมมติฐานของการทดสอบสถานการณ์นี้' : 'Document the purpose and assumptions of this sensitivity scenario'}"
        >${escapeHtml(existingDesc)}</textarea>
      </div>

      <div id="sharedScenarioError" class="field-error" hidden></div>
    </form>
  `;

  openModal({
    title,
    body: modalHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
      <button class="btn btn-primary" id="btnSubmitSharedScenario">${isEdit ? (isTh ? 'บันทึกการเปลี่ยนแปลง' : 'Save Changes') : (isTh ? 'บันทึกสถานการณ์' : 'Create Scenario')}</button>
    `,
  });

  const form = document.getElementById('sharedScenarioForm');
  const errBox = document.getElementById('sharedScenarioError');
  const chkCustom = document.getElementById('chkCustomDiscount');
  const discountWrap = document.getElementById('customDiscountWrap');

  chkCustom?.addEventListener('change', () => {
    if (discountWrap) {
      discountWrap.hidden = !chkCustom.checked;
      if (!chkCustom.checked && form.discount_rate) {
        form.discount_rate.value = '';
      }
    }
  });

  document.getElementById('btnSubmitSharedScenario')?.addEventListener('click', async () => {
    if (!form) return;

    const name = form.name.value.trim();
    const kind = form.kind.value;
    const description = form.description.value.trim();

    if (!name) {
      if (errBox) {
        errBox.textContent = isTh ? 'กรุณาระบุชื่อสถานการณ์' : 'Please enter a scenario name.';
        errBox.hidden = false;
      }
      return;
    }

    const isCustomRate = chkCustom?.checked;
    const rawRate = form.discount_rate?.value;
    const rateVal = isCustomRate && rawRate !== '' && !isNaN(rawRate) ? parseFloat(rawRate) / 100 : null;

    const data = {
      name,
      kind,
      description,
      assumptions: {
        global: rateVal !== null ? { discount_rate: rateVal } : {},
        outcomes: existing?.assumptions?.outcomes || {},
      },
    };

    try {
      let saved;
      if (typeof onSave === 'function') {
        if (onSave.length === 1) {
          saved = await onSave(data);
        } else {
          saved = await addScenario(data);
          await onSave(saved);
        }
      } else {
        saved = await addScenario(data);
      }
      showToast(isTh ? 'บันทึกสถานการณ์เรียบร้อย' : 'Scenario saved successfully', 'success');
      closeModal();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
      showToast(err.message, 'error');
    }
  });
}
