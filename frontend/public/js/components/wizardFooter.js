/**
 * Wizard Bottom Navigation Footer Component
 * Provides unified, consistent navigation across all assessment steps (0 to 6)
 * Includes live save indicator, Back button, Next/Continue button, and Glossary shortcut.
 */

import { t, getLanguage } from '../i18n.js';
import { STEPS } from './stepper.js';
import { openGlossaryModal } from './glossaryModal.js';
import { getState } from '../store.js';
import { nextGate } from '../utils/readiness.js';
import { showToast } from './toast.js';

/**
 * Generates the HTML for the wizard sticky bottom navigation bar
 * @param {number} currentStep - current step number (0 - 6)
 * @param {Object} options - optional custom handlers or flags
 * @returns {string} HTML string
 */
const SHORT = {
  0: { th: 'เริ่มต้น', en: 'Start' },
  1: { th: 'โครงการ', en: 'Project' },
  2: { th: 'ผู้มีส่วนได้เสีย', en: 'Stakeholders' },
  3: { th: 'ผลลัพธ์', en: 'Outcomes' },
  4: { th: 'การปรับค่า', en: 'Adjust' },
  5: { th: 'ตรวจสอบ', en: 'Review' },
  6: { th: 'ผลลัพธ์', en: 'Results' },
};
const shortLabel = (n) => SHORT[n]?.[getLanguage() === 'en' ? 'en' : 'th'] ?? '';

export function wizardFooterHtml(currentStep = 1, options = {}) {
  // Labels are intentionally short and derived from the step; per-step overrides are ignored for consistency.
  const isTh = getLanguage() !== 'en';
  // The next step stays locked until this step is complete (the rule lives in utils/readiness.js).
  const gate = currentStep >= 1 && currentStep <= 5 ? nextGate(getState(), currentStep, isTh) : { blocked: false, message: '' };
  const canProceed = options.canProceed !== false && !gate.blocked;
  const gateMsg = gate.message || (isTh ? 'กรอกข้อมูลที่จำเป็นของขั้นนี้ให้ครบก่อนไปต่อ' : 'Complete the required inputs of this step first');

  let prevStep = null;
  let nextStep = null;

  if (currentStep === 0) {
    nextStep = STEPS.find((s) => s.step === 1);
  } else if (currentStep > 0) {
    if (currentStep === 1) {
      prevStep = {
        step: 0,
        hash: '#/wizard/step-0',
        label: t('step0_nav_label', '0. บทนำและเตรียมข้อมูล (Overview)'),
      };
    } else {
      prevStep = STEPS.find((s) => s.step === currentStep - 1);
    }
    nextStep = STEPS.find((s) => s.step === currentStep + 1);
  }

  const prevText = prevStep ? `${t('back', 'ย้อนกลับ')}` : null;
  const nextText = nextStep ? `${t('btn_next_short', 'ถัดไป:')} ${shortLabel(nextStep.step)}` : null;

  return `
    <nav class="wizard-footer" aria-label="${t('wizard_nav_aria', 'การนำทางขั้นตอนการประเมิน')}">
      <div class="wizard-footer-left">
        ${
          prevStep
            ? `<a href="${prevStep.hash}" class="btn btn-secondary wizard-btn-back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>${prevText}</span>
              </a>`
            : `<button class="btn btn-secondary wizard-btn-back" disabled >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>${t('back', 'ย้อนกลับ')}</span>
              </button>`
        }
      </div>

      <div class="wizard-footer-right">
        ${
          nextStep
            ? canProceed
              ? `<a href="${nextStep.hash}" class="btn btn-primary wizard-btn-next">
                <span>${nextText}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </a>`
              : `<span class="wizard-gate-hint" role="status">${gateMsg}</span>
              <button type="button" class="btn btn-primary wizard-btn-next is-disabled" aria-disabled="true" data-step="${currentStep}" data-gate-msg="${gateMsg.replace(/"/g, '&quot;')}">
                <span>${nextText}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>`
            : currentStep === 6
              ? `<a href="#/projects" class="btn btn-primary wizard-btn-finish">
                  <span>${t('btn_finish_assessment', 'เสร็จสิ้นการประเมิน')}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </a>`
              : ''
        }
      </div>
    </nav>
  `;
}

/**
 * Attaches event listeners for wizard footer elements (e.g. glossary modal)
 * @param {HTMLElement} container
 */
export function attachWizardFooterEvents(container) {
  // Locked "Next": explain why instead of doing nothing. Step 1 has its own handler (it saves the form first).
  container.querySelectorAll('.wizard-btn-next.is-disabled').forEach((btn) => {
    if (btn.dataset.step === '1') return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(btn.dataset.gateMsg, 'error');
    });
  });

  container.querySelectorAll('.btn-open-glossary').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openGlossaryModal();
    });
  });
}