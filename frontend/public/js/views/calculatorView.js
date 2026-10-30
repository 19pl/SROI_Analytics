/**
 * ImpactValue SROI 6-Stage Guided Wizard View
 */

import { getState, subscribe } from '../store.js';
import { stepperHtml } from '../components/stepper.js';
import { renderHelpPanel } from '../components/helpPanel.js';
import { isGuest, guestStepHtml } from '../components/guestNotice.js';
import { renderStep1 } from './steps/step1Project.js';
import { renderStep2 } from './steps/step2Stakeholders.js';
import { renderStep3 } from './steps/step3Outcomes.js';
import { renderStep4 } from './steps/step4Adjustments.js';
import { renderStep5 } from './steps/step5Review.js';
import { renderStep6 } from './steps/step6Dashboard.js';
import { renderSheet } from './sheetView.js';

export function renderCalculator(root) {
  const hash = window.location.hash || '#/wizard/step-1';
  let stepNum = 1;
  const match = hash.match(/step-(\d)/);
  if (match) {
    stepNum = parseInt(match[1], 10);
  } else if (hash === '#/calculator') {
    stepNum = 1;
  }

  const { project } = getState();

  // Sheet-mode plans (Excel-style entry) have their own single-page view; wizard plans are unchanged.
  if (project?.calc_method === 'sheet' && !isGuest()) {
    renderSheet(root);
    return;
  }

  root.innerHTML = `
    <div class="wizard-container">
      ${stepperHtml(stepNum, [1])}

      <div class="wizard-content-layout">
        <div id="wizardStepContent" class="stack"></div>
        <div id="wizardHelpPanel"></div>
      </div>
    </div>
  `;

  const contentContainer = document.getElementById('wizardStepContent');
  const helpContainer = document.getElementById('wizardHelpPanel');

  renderHelpPanel(helpContainer, stepNum);

  // Guests see the stepper, help text and a description of the step; the forms need project data
  if (isGuest()) {
    contentContainer.innerHTML = guestStepHtml(stepNum);
    return;
  }

  // Render Step View
  switch (stepNum) {
    case 1:
      renderStep1(contentContainer);
      break;
    case 2:
      renderStep2(contentContainer);
      break;
    case 3:
      renderStep3(contentContainer);
      break;
    case 4:
      renderStep4(contentContainer);
      break;
    case 5:
      renderStep5(contentContainer);
      break;
    case 6:
      renderStep6(contentContainer);
      break;
    default:
      renderStep1(contentContainer);
  }
}
