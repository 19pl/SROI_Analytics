import { card } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { ABOUT_QUESTIONS, ABOUT_STEPS, ABOUT_TERMS } from '../data/aboutContent.js';

const heroSection = () => `<section class="about-hero">
  <div class="about-hero-icon">${icons.trendUp}</div>
  <div>
    <p class="about-eyebrow">SOCIAL RETURN ON INVESTMENT</p>
    <h2>วัดคุณค่าที่โครงการสร้างให้สังคม</h2>
    <p>
      SROI (Social Return on Investment) คือแนวทางประเมินคุณค่าทางสังคม เศรษฐกิจ
      และสิ่งแวดล้อมที่เกิดจากโครงการ โดยเปรียบเทียบมูลค่าผลลัพธ์ที่เกิดขึ้นกับเงินลงทุน
    </p>
  </div>
</section>`;

const questionsCard = () =>
  card({
    title: 'SROI ช่วยให้เราเข้าใจอะไร?',
    description: 'มองให้ไกลกว่าตัวเลขรายรับและรายจ่าย',
    body: `<ul class="about-list">
      ${ABOUT_QUESTIONS.map((question) => `<li>${question}</li>`).join('')}
    </ul>`,
  });

const howToReadCard = () =>
  card({
    title: 'อ่านค่า SROI อย่างไร?',
    description: 'ตัวอย่างการตีความอัตราส่วน',
    body: `<div class="about-ratio">
        <strong>3 : 1</strong><span>ตัวอย่างอัตราส่วน SROI</span>
      </div>
      <p class="muted">
        หมายถึง ทุกการลงทุน 1 บาท สร้างมูลค่าผลลัพธ์ทางสังคมที่ประเมินได้ประมาณ 3 บาท
        ภายใต้สมมติฐานและวิธีประเมินของโครงการนั้น
      </p>
      <p class="about-note">อัตราส่วนนี้เป็นเพียงตัวอย่าง ไม่ใช่ผลการประเมินของโครงการใดโดยเฉพาะ</p>`,
  });

const stepItem = ({ title, description }, index) => `<article class="about-step">
  <span>${index + 1}</span>
  <div><h3>${title}</h3><p>${description}</p></div>
</article>`;

const stepsCard = () =>
  card({
    cls: 'about-steps-card',
    title: 'ประเมิน SROI อย่างไร?',
    description: 'ขั้นตอนหลักในการประเมินผลตอบแทนทางสังคม',
    body: `<div class="about-steps">${ABOUT_STEPS.map(stepItem).join('')}</div>`,
  });

const termItem = ({
  symbol,
  title,
  subtitle,
  description,
  example,
}) => `<article class="about-term">
  <span class="about-term-symbol">${symbol}</span>
  <div>
    <h3>${title} <span>${subtitle}</span></h3>
    <p>${description}</p>
    <p class="about-term-example"><strong>ตัวอย่าง:</strong> ${example}</p>
  </div>
</article>`;

const termsCard = () =>
  card({
    cls: 'about-terms-card',
    title: 'คำศัพท์สำคัญในการประเมิน SROI',
    description: 'ค่าที่ใช้ปรับผลลัพธ์ให้สะท้อนผลกระทบของโครงการอย่างสมเหตุสมผล',
    body: `<div class="about-terms-grid">${ABOUT_TERMS.map(termItem).join('')}</div>
      <p class="about-terms-note">
        หมายเหตุ: ค่าร้อยละควรอ้างอิงจากข้อมูลหรือหลักฐานของโครงการ
        ไม่ควรกำหนดจากการคาดเดาเพียงอย่างเดียว และควรระบุสมมติฐานที่ใช้ให้ชัดเจน
      </p>`,
  });

const formulaSection = () => `<section class="about-formula">
  <div>
    <p class="about-eyebrow">แนวคิดการคำนวณ</p>
    <h2>อัตราส่วน SROI</h2>
    <p>เปรียบเทียบมูลค่าปัจจุบันของผลลัพธ์ทางสังคมกับมูลค่าการลงทุน</p>
  </div>
  <div class="about-formula-equation">
    <strong class="about-formula-label">SROI <span>=</span></strong>
    <div class="about-formula-fraction">
      <span class="about-formula-numerator">มูลค่าปัจจุบันของผลลัพธ์</span>
      <i aria-hidden="true"></i>
      <span class="about-formula-denominator">มูลค่าการลงทุน</span>
    </div>
  </div>
</section>`;

const disclaimer = () => `<p class="about-disclaimer">
  หมายเหตุ: การประเมิน SROI ที่น่าเชื่อถือควรใช้ข้อมูลที่ตรวจสอบได้ เปิดเผยสมมติฐาน
  และให้ผู้มีส่วนได้ส่วนเสียมีส่วนร่วม ผลลัพธ์เป็นค่าประมาณตามขอบเขตและวิธีประเมินที่กำหนด
</p>`;

/** หน้าแนะนำ SROI: ประกอบจากส่วนย่อย — เนื้อหาตัวอักษรหลักอยู่ใน data/aboutContent.js */
export function renderAbout(root) {
  root.innerHTML = `<div class="about-page">
    <span class="badge badge-mock">NU SROI มหาวิทยาลัยนเรศวร</span>
    <h1 class="page-title">SROI คืออะไร?</h1>
    <p class="muted page-sub">
      ทำความเข้าใจการประเมินผลตอบแทนทางสังคมจากการลงทุน และขั้นตอนการประเมินอย่างเป็นระบบ
    </p>
    ${heroSection()}
    <div class="about-content-grid">${questionsCard()}${howToReadCard()}</div>
    ${stepsCard()}
    ${termsCard()}
    ${formulaSection()}
    ${disclaimer()}
  </div>`;
}
