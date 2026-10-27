/**
 * Contextual Help & Methodology Panel Component
 */

const HELP_CONTENT = {
  1: {
    title: 'Step 1: Scope & Investment',
    body: `
      <p>Establish the project's boundaries, evaluation timeframe, and all resources invested.</p>
      <div class="formula-box">Total Investment = Σ (Item Amount × Exchange Rate)</div>
      <p><strong>Nominal vs Present Value:</strong> If project costs occur in future years, choose whether to compare nominal expenditure or discount investment into present-value terms.</p>
      <p><strong>In-Kind Inputs:</strong> Volunteer time and donated resources can be included to reflect total societal investment.</p>
    `,
  },
  2: {
    title: 'Step 2: Stakeholder Mapping',
    body: `
      <p>Identify all individuals, communities, and organizations that experience material change from the initiative.</p>
      <p><strong>Principle:</strong> Involve stakeholders to understand what changes for them—both positive benefits and unintended harms.</p>
      <p><strong>Safeguard:</strong> Watch for overlapping groups to avoid double-counting the same societal value.</p>
    `,
  },
  3: {
    title: 'Step 3: Outcomes & Financial Proxies',
    body: `
      <p>Differentiate between:</p>
      <ul>
        <li><strong>Activity:</strong> Deliver 500 hours tutoring</li>
        <li><strong>Output:</strong> 200 students attended</li>
        <li><strong>Outcome:</strong> Measurable improvement in grades</li>
      </ul>
      <div class="formula-box">Gross Value = Quantity × Financial Proxy</div>
      <p><strong>Proxy:</strong> An estimate of the monetary value of a change. It is not necessarily cash income.</p>
      <p><strong>Negative Outcomes:</strong> Record monetized harms with negative polarity so they subtract from total impact.</p>
    `,
  },
  4: {
    title: 'Step 4: Impact Adjustments',
    body: `
      <p>Ensure the analysis does not over-claim change:</p>
      <ul>
        <li><strong>Deadweight:</strong> Would have happened anyway without the project.</li>
        <li><strong>Attribution:</strong> Caused by other programs or people.</li>
        <li><strong>Displacement:</strong> Merely moved from somewhere else.</li>
        <li><strong>Drop-off:</strong> Annual fade of the outcome effect.</li>
      </ul>
      <div class="formula-box">Adjusted = Retained × (1-Deadweight) × (1-Attribution) × (1-Displacement)</div>
    `,
  },
  5: {
    title: 'Step 5: Review & Scenarios',
    body: `
      <p>Test the sensitivity of the results before finalizing:</p>
      <ul>
        <li><strong>Conservative:</strong> Lower quantities, higher deadweight, shorter horizon.</li>
        <li><strong>Base case:</strong> Central evidence-based assumptions.</li>
        <li><strong>Optimistic:</strong> Higher plausible outcome reach.</li>
      </ul>
      <p><strong>Tornado Analysis:</strong> Shows which assumption swings (discount rate, proxies, deadweight) most heavily influence the SROI ratio.</p>
    `,
  },
  6: {
    title: 'Step 6: Dashboard & Reports',
    body: `
      <div class="formula-box">SROI Ratio = Present Value of Impact ÷ Total Investment</div>
      <p><strong>Net Social Value:</strong> Total Present Value − Total Investment.</p>
      <p><strong>Audit Trail:</strong> Export a formal reproducible report snapshot (PDF, HTML, CSV) with complete methodology notes.</p>
    `,
  },
};

export function renderHelpPanel(container, stepNumber = 1) {
  const content = HELP_CONTENT[stepNumber] || HELP_CONTENT[1];
  container.innerHTML = `
    <div class="help-drawer">
      <div class="help-drawer-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>${content.title}</span>
      </div>
      <div class="help-drawer-body">${content.body}</div>
    </div>
  `;
}
