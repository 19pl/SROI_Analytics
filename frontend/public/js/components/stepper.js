/**
 * Guided Workflow Stepper Navigation Component
 * Features Step 0 (Welcome & Preparation) followed by Stages 1 to 6
 */

import { t } from '../i18n.js';

export const STEPS = [
  {
    step: 0,
    labelKey: 'step0_title',
    descKey: 'step0_desc',
    label: '0. Welcome & Prep',
    hash: '#/wizard/step-0',
    desc: 'Overview & Preparation',
  },
  {
    step: 1,
    labelKey: 'step1_title',
    descKey: 'step1_desc',
    label: '1. Project & Costs',
    hash: '#/wizard/step-1',
    desc: 'Scope & Investment',
  },
  {
    step: 2,
    labelKey: 'step2_title',
    descKey: 'step2_desc',
    label: '2. Stakeholders',
    hash: '#/wizard/step-2',
    desc: 'Affected Groups',
  },
  {
    step: 3,
    labelKey: 'step3_title',
    descKey: 'step3_desc',
    label: '3. Outcomes & Proxies',
    hash: '#/wizard/step-3',
    desc: 'Changes & Valuation',
  },
  {
    step: 4,
    labelKey: 'step4_title',
    descKey: 'step4_desc',
    label: '4. Adjustments',
    hash: '#/wizard/step-4',
    desc: 'Additionality & Drop-off',
  },
  {
    step: 5,
    labelKey: 'step5_title',
    descKey: 'step5_desc',
    label: '5. Review & Scenarios',
    hash: '#/wizard/step-5',
    desc: 'Assumptions & Check',
  },
  {
    step: 6,
    labelKey: 'step6_title',
    descKey: 'step6_desc',
    label: '6. Dashboard & Reports',
    hash: '#/wizard/step-6',
    desc: 'Results & Export',
  },
];

export function stepperHtml(currentStep = 1, completedSteps = []) {
  const currentObj = STEPS.find((s) => s.step === currentStep) || STEPS[1];
  const currentLabel = currentObj.labelKey ? t(currentObj.labelKey, currentObj.label) : currentObj.label;
  const mobileLabel = currentStep === 0
    ? currentLabel
    : `${t('step_mobile_word', 'Step')} ${currentStep} ${t('of_word', 'of')} 6`;

  const items = STEPS.map(({ step, labelKey, descKey, label, desc, hash }, index) => {
    const isActive = step === currentStep;
    const isDone = (completedSteps.includes(step) || step < currentStep) && step > 0;
    const displayLabel = labelKey ? t(labelKey, label) : label;
    const displayDesc = descKey ? t(descKey, desc) : desc;

    const iconContent = isDone && !isActive ? '✓' : step;

    const itemHtml = `
      <a class="step-item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${step === 0 ? 'step-welcome' : ''}" href="${hash}" aria-label="${displayLabel}: ${displayDesc}" title="${displayLabel}: ${displayDesc}">
        <span class="step-num">${iconContent}</span>
        ${isActive ? `<span class="step-label">${displayLabel}</span><span class="step-mobile-label">${mobileLabel}</span>` : ''}
      </a>
    `;

    const dividerHtml = index < STEPS.length - 1 ? `<div class="step-divider"></div>` : '';
    return `${itemHtml}${dividerHtml}`;
  }).join('');

  return `<nav class="stepper" aria-label="SROI Guided Workflow">${items}</nav>`;
}
