import { card } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { getAboutData } from '../data/aboutContent.js';
import { escapeHtml } from '../utils/html.js';

const heroSection = (data) => `
  <section class="about-hero">
    <div class="about-hero-icon">${icons.trendUp}</div>
    <div>
      <p class="about-eyebrow">${data.eyebrow}</p>
      <h2>${data.heroTitle}</h2>
      <p>${data.heroDesc}</p>
    </div>
  </section>
`;

const keyIdeasSection = (data) => `
  <div class="about-key-ideas">
    <strong class="strong primary-text">${escapeHtml(data.keyIdeasTitle || '5 Key Ideas')}</strong>
    <ol>
      ${(data.keyIdeas || []).map((idea) => `<li>${escapeHtml(idea)}</li>`).join('')}
    </ol>
  </div>
`;

const tableOfContents = (data) => `
  <nav class="about-toc" aria-label="Methodology sections">
    <span class="muted-sm uppercase strong about-toc-title">เนื้อหา / Contents:</span>
    <a href="#sec-questions">${escapeHtml(data.qCardTitle)}</a>
    <a href="#sec-ratio">${escapeHtml(data.readCardTitle)}</a>
    <a href="#sec-steps">${escapeHtml(data.stepsCardTitle)}</a>
    <a href="#sec-terms">${escapeHtml(data.termsCardTitle)}</a>
    <a href="#sec-formula">${escapeHtml(data.formulaTitle)}</a>
  </nav>
`;

const stepItem = ({ title, description }, index) => `
  <article class="about-step">
    <span>${index + 1}</span>
    <div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  </article>
`;

const termItem = (data, { symbol, title, subtitle, description, example }) => `
  <article class="about-term">
    <span class="about-term-symbol">${escapeHtml(symbol)}</span>
    <div>
      <h3>${escapeHtml(title)} <span>${escapeHtml(subtitle)}</span></h3>
      <p>${escapeHtml(description)}</p>
      <p class="about-term-example"><strong>${escapeHtml(data.exampleText)}</strong> ${escapeHtml(example)}</p>
    </div>
  </article>
`;

const formulaContent = (data) => `
  <div class="about-formula">
    <div>
      <p class="about-eyebrow">${data.formulaEyebrow}</p>
      <h2>${data.formulaTitle}</h2>
      <p>${data.formulaDesc}</p>
    </div>
    <div class="about-formula-equation">
      <strong class="about-formula-label">SROI <span>=</span></strong>
      <div class="about-formula-fraction">
        <span class="about-formula-numerator">${data.formulaNumerator}</span>
        <i aria-hidden="true"></i>
        <span class="about-formula-denominator">${data.formulaDenominator}</span>
      </div>
    </div>
  </div>
`;

export function renderAbout(root) {
  const data = getAboutData();

  root.innerHTML = `
    <div class="about-page">
      <div class="page-head">
        <div>
          <span class="status status--neutral">${escapeHtml(data.badge)}</span>
          <h1 class="page-head__title">${escapeHtml(data.title)}</h1>
          <p class="page-head__sub">${escapeHtml(data.subtitle)}</p>
        </div>
      </div>

      ${heroSection(data)}

      ${keyIdeasSection(data)}

      ${tableOfContents(data)}

      <!-- Section 1: Questions (Accordion - collapsed) -->
      <details class="disclosure about-accordion" id="sec-questions">
        <summary class="disclosure__summary">
          <strong class="strong">${escapeHtml(data.qCardTitle)}</strong>
          <span class="muted-sm">${escapeHtml(data.qCardDesc)}</span>
        </summary>
        <div class="panel__hint">
          <ul class="about-list">
            ${data.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
          </ul>
        </div>
      </details>

      <!-- Section 2: How to read SROI (Accordion - collapsed) -->
      <details class="disclosure about-accordion" id="sec-ratio">
        <summary class="disclosure__summary">
          <strong class="strong">${escapeHtml(data.readCardTitle)}</strong>
          <span class="muted-sm">${escapeHtml(data.readCardDesc)}</span>
        </summary>
        <div class="panel__hint">
          <div class="about-ratio">
            <strong>${escapeHtml(data.readSample)}</strong>
            <span>${escapeHtml(data.readSampleLabel)}</span>
          </div>
          <p class="muted-sm">${escapeHtml(data.readSampleExplain)}</p>
          <p class="about-note">${escapeHtml(data.readSampleNote)}</p>
        </div>
      </details>

      <!-- Section 3: Evaluation Steps (Accordion - collapsed) -->
      <details class="disclosure about-accordion" id="sec-steps">
        <summary class="disclosure__summary">
          <strong class="strong">${escapeHtml(data.stepsCardTitle)}</strong>
          <span class="muted-sm">${escapeHtml(data.stepsCardDesc)}</span>
        </summary>
        <div class="panel__hint">
          <div class="about-steps">
            ${data.steps.map(stepItem).join('')}
          </div>
        </div>
      </details>

      <!-- Section 4: Terms & Deductions (Accordion - collapsed) -->
      <details class="disclosure about-accordion" id="sec-terms">
        <summary class="disclosure__summary">
          <strong class="strong">${escapeHtml(data.termsCardTitle)}</strong>
          <span class="muted-sm">${escapeHtml(data.termsCardDesc)}</span>
        </summary>
        <div class="panel__hint">
          <div class="about-terms-grid">
            ${data.terms.map((item) => termItem(data, item)).join('')}
          </div>
          <p class="about-terms-note">${escapeHtml(data.termsNote)}</p>
        </div>
      </details>

      <!-- Section 5: Formula (Accordion - STAYS OPEN) -->
      <details class="disclosure about-accordion" id="sec-formula" open>
        <summary class="disclosure__summary">
          <strong class="strong">${escapeHtml(data.formulaTitle)}</strong>
          <span class="muted-sm">${escapeHtml(data.formulaEyebrow)}</span>
        </summary>
        <div class="panel__hint">
          ${formulaContent(data)}
        </div>
      </details>

      <p class="about-disclaimer">${escapeHtml(data.disclaimer)}</p>
    </div>
  `;

  // Auto-expand accordion when clicking TOC anchor
  root.querySelectorAll('.about-toc a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.getElementById(href.substring(1));
        if (target && target.tagName === 'DETAILS') {
          target.open = true;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}
