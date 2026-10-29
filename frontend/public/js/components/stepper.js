/**
 * 6-Stage Stepper Navigation Component
 */

export const STEPS = [
  { step: 1, label: '1. Project & Costs', hash: '#/wizard/step-1', desc: 'Scope & Investment' },
  { step: 2, label: '2. Stakeholders', hash: '#/wizard/step-2', desc: 'Affected Groups' },
  { step: 3, label: '3. Outcomes & Proxies', hash: '#/wizard/step-3', desc: 'Changes & Valuation' },
  { step: 4, label: '4. Adjustments', hash: '#/wizard/step-4', desc: 'Additionality & Drop-off' },
  { step: 5, label: '5. Review & Scenarios', hash: '#/wizard/step-5', desc: 'Assumptions & Check' },
  { step: 6, label: '6. Dashboard & Reports', hash: '#/wizard/step-6', desc: 'Results & Export' },
];

export function stepperHtml(currentStep = 1, completedSteps = []) {
  const items = STEPS.map(({ step, label, hash }, index) => {
    const isActive = step === currentStep;
    const isDone = completedSteps.includes(step) || step < currentStep;

    const itemHtml = `
      <a class="step-item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}" href="${hash}">
        <span class="step-num">${isDone && !isActive ? '✓' : step}</span>
        <span>${label}</span>
      </a>
    `;

    const dividerHtml = index < STEPS.length - 1 ? `<div class="step-divider"></div>` : '';
    return `${itemHtml}${dividerHtml}`;
  }).join('');

  return `<nav class="stepper" aria-label="SROI 6-Step Workflow">${items}</nav>`;
}
