/**
 * Wizard Bottom Navigation Footer Component
 * Provides unified, consistent navigation across all assessment steps (0 to 6)
 * Includes live save indicator, Back button, Next/Continue button, and Glossary shortcut.
 */

import { t } from '../i18n.js';
import { STEPS } from './stepper.js';
import { openGlossaryModal } from './glossaryModal.js';

/**
 * Generates the HTML for the wizard sticky bottom navigation bar
 * @param {number} currentStep - current step number (0 - 6)
 * @param {Object} options - optional custom handlers or flags
 * @returns {string} HTML string
 */
export function wizardFooterHtml(currentStep = 1, options = {}) {
  const { canProceed = true, nextLabel = null, prevLabel = null, isSaving = false } = options;

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

  const prevText =
    prevLabel ||
    (prevStep
      ? `${t('btn_back_to', 'ย้อนกลับ:')} ${prevStep.labelKey ? t(prevStep.labelKey, prevStep.label) : prevStep.label}`
      : null);
  const nextText =
    nextLabel ||
    (nextStep
      ? `${t('btn_continue_to', 'บันทึกและไปต่อ:')} ${nextStep.labelKey ? t(nextStep.labelKey, nextStep.label) : nextStep.label}`
      : null);

  const saveStatusText = isSaving
    ? `<span class="save-status is-saving">⏳ ${t('status_saving', 'กำลังบันทึก...')}</span>`
    : `<span class="save-status is-saved">✓ ${t('status_all_saved', 'บันทึกข้อมูลเรียบร้อยแล้ว')}</span>`;

  return `
    <nav class="wizard-footer" aria-label="${t('wizard_nav_aria', 'การนำทางขั้นตอนการประเมิน')}">
      <div class="wizard-footer-left">
        ${
          prevStep
            ? `<a href="${prevStep.hash}" class="btn btn-secondary wizard-btn-back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>${prevText}</span>
              </a>`
            : `<button class="btn btn-secondary wizard-btn-back" disabled style="opacity: 0.5;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>${t('back', 'ย้อนกลับ')}</span>
              </button>`
        }
      </div>

      <div class="wizard-footer-center">
        ${saveStatusText}
        <button type="button" class="btn-text btn-open-glossary" style="font-size: 0.75rem; color: var(--primary); display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; cursor: pointer; background: transparent; border: none;">
          📖 <u>${t('glossary_quick_btn', 'พจนานุกรมคำศัพท์ SROI')}</u>
        </button>
      </div>

      <div class="wizard-footer-right">
        ${
          nextStep
            ? `<a href="${nextStep.hash}" class="btn btn-primary wizard-btn-next ${canProceed ? '' : 'is-disabled'}" ${canProceed ? '' : 'aria-disabled="true" style="pointer-events: none; opacity: 0.6;"'}>
                <span>${nextText}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </a>`
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
  container.querySelectorAll('.btn-open-glossary').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openGlossaryModal();
    });
  });
}
