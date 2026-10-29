/**
 * 6-Stage Stepper Navigation Component
 */

import { t } from '../i18n.js';

export const STEPS = [
  { step: 1, labelKey: 'step1_title', descKey: 'step1_desc', label: '1. Project & Costs', hash: '#/wizard/step-1', desc: 'Scope & Investment' },
  { step: 2, labelKey: 'step2_title', descKey: 'step2_desc', label: '2. Stakeholders', hash: '#/wizard/step-2', desc: 'Affected Groups' },
  { step: 3, labelKey: 'step3_title', descKey: 'step3_desc', label: '3. Outcomes & Proxies', hash: '#/wizard/step-3', desc: 'Changes & Valuation' },
  { step: 4, labelKey: 'step4_title', descKey: 'step4_desc', label: '4. Adjustments', hash: '#/wizard/step-4', desc: 'Additionality & Drop-off' },
  { step: 5, labelKey: 'step5_title', descKey: 'step5_desc', label: '5. Review & Scenarios', hash: '#/wizard/step-5', desc: 'Assumptions & Check' },
  { step: 6, labelKey: 'step6_title', descKey: 'step6_desc', label: '6. Dashboard & Reports', hash: '#/wizard/step-6', desc: 'Results & Export' },
];

export function stepperHtml(currentStep = 1, completedSteps = []) {
  const items = STEPS.map(({ step, labelKey, descKey, label, desc, hash }, index) => {
    const isActive = step === currentStep;
    const isDone = completedSteps.includes(step) || step < currentStep;
    const displayLabel = labelKey ? t(labelKey, label) : label;
    const displayDesc = descKey ? t(descKey, desc) : desc;

    const itemHtml = `
      <a class="step-item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}" href="${hash}" title="${displayDesc}">
        <span class="step-num">${isDone && !isActive ? '✓' : step}</span>
        <span>${displayLabel}</span>
      </a>
    `;

    const dividerHtml = index < STEPS.length - 1 ? `<div class="step-divider"></div>` : '';
    return `${itemHtml}${dividerHtml}`;
  }).join('');

  return `<nav class="stepper" aria-label="SROI 6-Step Workflow">${items}</nav>`;
}
