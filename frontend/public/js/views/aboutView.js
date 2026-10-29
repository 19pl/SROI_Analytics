import { card } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { getAboutData } from '../data/aboutContent.js';

const heroSection = (data) => `<section class="about-hero">
  <div class="about-hero-icon">${icons.trendUp}</div>
  <div>
    <p class="about-eyebrow">${data.eyebrow}</p>
    <h2>${data.heroTitle}</h2>
    <p>${data.heroDesc}</p>
  </div>
</section>`;

const questionsCard = (data) =>
  card({
    title: data.qCardTitle,
    description: data.qCardDesc,
    body: `<ul class="about-list">
      ${data.questions.map((question) => `<li>${question}</li>`).join('')}
    </ul>`,
  });

const howToReadCard = (data) =>
  card({
    title: data.readCardTitle,
    description: data.readCardDesc,
    body: `<div class="about-ratio">
        <strong>${data.readSample}</strong><span>${data.readSampleLabel}</span>
      </div>
      <p class="muted">${data.readSampleExplain}</p>
      <p class="about-note">${data.readSampleNote}</p>`,
  });

const stepItem = ({ title, description }, index) => `<article class="about-step">
  <span>${index + 1}</span>
  <div><h3>${title}</h3><p>${description}</p></div>
</article>`;

const stepsCard = (data) =>
  card({
    cls: 'about-steps-card',
    title: data.stepsCardTitle,
    description: data.stepsCardDesc,
    body: `<div class="about-steps">${data.steps.map(stepItem).join('')}</div>`,
  });

const termItem = (data, { symbol, title, subtitle, description, example }) => `<article class="about-term">
  <span class="about-term-symbol">${symbol}</span>
  <div>
    <h3>${title} <span>${subtitle}</span></h3>
    <p>${description}</p>
    <p class="about-term-example"><strong>${data.exampleText}</strong> ${example}</p>
  </div>
</article>`;

const termsCard = (data) =>
  card({
    cls: 'about-terms-card',
    title: data.termsCardTitle,
    description: data.termsCardDesc,
    body: `<div class="about-terms-grid">${data.terms.map((item) => termItem(data, item)).join('')}</div>
      <p class="about-terms-note">${data.termsNote}</p>`,
  });

const formulaSection = (data) => `<section class="about-formula">
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
</section>`;

const disclaimer = (data) => `<p class="about-disclaimer">${data.disclaimer}</p>`;

/** หน้าแนะนำ SROI: ประกอบจากส่วนย่อย — เนื้อหาตัวอักษรหลักอยู่ใน data/aboutContent.js */
export function renderAbout(root) {
  const data = getAboutData();
  root.innerHTML = `<div class="about-page">
    <span class="badge badge-mock">${data.badge}</span>
    <h1 class="page-title">${data.title}</h1>
    <p class="muted page-sub">${data.subtitle}</p>
    ${heroSection(data)}
    <div class="about-content-grid">${questionsCard(data)}${howToReadCard(data)}</div>
    ${stepsCard(data)}
    ${termsCard(data)}
    ${formulaSection(data)}
    ${disclaimer(data)}
  </div>`;
}
