/**
 * ImpactValue SROI Guided Wizard View
 * Supports Step 0 (Welcome & Preparation) followed by Stages 1 to 6
 */

import { getState } from '../store.js';
import { icons } from '../components/icons.js';
import { stepperHtml } from '../components/stepper.js';
import { renderHelpPanel } from '../components/helpPanel.js';
import { isGuest, guestStepHtml } from '../components/guestNotice.js';
import { renderStep0 } from './steps/step0Welcome.js';
import { renderStep1 } from './steps/step1Project.js';
import { renderStep2 } from './steps/step2Stakeholders.js';
import { renderStep3 } from './steps/step3Outcomes.js';
import { renderStep4 } from './steps/step4Adjustments.js';
import { renderStep5 } from './steps/step5Review.js';
import { renderStep6 } from './steps/step6Dashboard.js';
import { renderSheet } from './sheetView.js';
import { t } from '../i18n.js';

let isHelpOpen = false;

export function renderCalculator(root) {
  const hash = window.location.hash || '#/wizard/step-0';
  let stepNum = 0;
  const match = hash.match(/step-(\d)/);
  if (match) {
    stepNum = parseInt(match[1], 10);
  } else if (hash === '#/calculator') {
    stepNum = 1;
  }

  const { project, costs, stakeholders, outcomes, review } = getState();

  // Sheet-mode plans (Excel-style entry) have their own single-page view; wizard plans are unchanged.
  if (project?.calc_method === 'sheet' && !isGuest()) {
    renderSheet(root);
    return;
  }

  // Calculate completed steps dynamically based on store state
  const completedSteps = [];
  if (project) {
    completedSteps.push(0); // Welcome reviewed
    if (costs && costs.length > 0) completedSteps.push(1);
    if (stakeholders && stakeholders.length > 0) completedSteps.push(2);
    if (outcomes && outcomes.length > 0) completedSteps.push(3);
    if (review?.completion?.adjustments) completedSteps.push(4);
    if (review?.ready) completedSteps.push(5);
  }

  root.innerHTML = `
    <div class="wizard-container">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--sp-md);">
        <div style="flex: 1; min-width: 0;">
          ${stepperHtml(stepNum, completedSteps)}
        </div>
        <button type="button" class="btn btn-secondary" id="btnToggleHelp" style="align-self: flex-start; margin-top: 2px; white-space: nowrap;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>${t('help', 'Help')}</span>
        </button>
      </div>

      <div class="wizard-content-layout ${isHelpOpen ? 'has-help-open' : ''}">
        <div id="wizardStepContent" class="stack"></div>
        <div id="wizardHelpPanel" style="${isHelpOpen ? '' : 'display: none;'}"></div>
      </div>
    </div>
  `;

  const contentContainer = document.getElementById('wizardStepContent');
  const helpContainer = document.getElementById('wizardHelpPanel');

  const toggleHelp = () => {
    isHelpOpen = !isHelpOpen;
    const layout = root.querySelector('.wizard-content-layout');
    if (layout) layout.classList.toggle('has-help-open', isHelpOpen);
    if (helpContainer) helpContainer.style.display = isHelpOpen ? 'block' : 'none';
  };

  document.getElementById('btnToggleHelp')?.addEventListener('click', toggleHelp);
  renderHelpPanel(helpContainer, stepNum, toggleHelp);

  // If no project is selected at all, prompt user to select or create a project
  if (!project && !isGuest()) {
    contentContainer.innerHTML = `
      <div class="card" style="padding: var(--sp-2xl); text-align: center;">
        <div style="margin-bottom: 12px; color: var(--muted);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
        <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">${t('no_active_project_title', 'ยังไม่ได้เลือกแผนงานที่ต้องการประเมิน')}</h2>
        <p class="muted" style="max-width: 500px; margin: 0 auto 20px auto; font-size: 0.875rem;">
          ${t('no_active_project_desc', 'กรุณาเลือกโครงการจากรายการโครงการ หรือสร้างแผนงานใหม่เพื่อเริ่มต้นการประเมิน SROI')}
        </p>
        <div style="display: flex; gap: var(--sp-md); justify-content: center;">
          <a href="#/projects" class="btn btn-primary">${t('go_to_projects', 'ไปยังรายการโครงการ (Projects Workspace)')}</a>
        </div>
      </div>
    `;
    return;
  }

  // Guests see the stepper, help text and a description of the step; the forms need project data
  if (isGuest()) {
    contentContainer.innerHTML = guestStepHtml(stepNum);
    return;
  }

  // Render Step View
  switch (stepNum) {
    case 0:
      renderStep0(contentContainer);
      break;
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
