/**
 * Contextual Help & Methodology Panel Component
 * Bilingual support (Thai & English)
 * Dynamically updates across all steps (0 to 6) and links to the SROI Glossary.
 */

import { getLanguage, t } from '../i18n.js';
import { openGlossaryModal } from './glossaryModal.js';

const HELP_CONTENT = {
  th: {
    0: {
      title: 'บทนำและการเตรียมตัว',
      body: `
        <p>ยินดีต้อนรับสู่ระบบประเมิน SROI ของมหาวิทยาลัยนเรศวร</p>
        <p><strong>SROI คืออะไร?</strong> เครื่องมือแปลงคุณค่าทางสังคม สุขภาพ และการศึกษา ให้เป็นมูลค่าเทียบเคียงตัวเงิน เพื่อเปรียบเทียบกับงบประมาณลงทุน</p>
        <p><strong>3 สิ่งที่ควรเตรียม:</strong></p>
        <ul>
          <li>ข้อมูลโครงการและงบประมาณที่ใช้</li>
          <li>กลุ่มคนที่เกี่ยวข้องและจำนวน</li>
          <li>การเปลี่ยนแปลงจริงที่เกิดขึ้นกับพวกเขา</li>
        </ul>
        <p>ระบบบันทึกความคืบหน้าให้อัตโนมัติ สามารถกลับมาทำต่อได้เสมอ</p>
      `,
    },
    1: {
      title: 'ขั้นตอนที่ 1: ขอบเขตและเงินลงทุน',
      body: `
        <p>กำหนดขอบเขตโครงการ กรอบเวลาในการประเมิน และทรัพยากรเงินลงทุนทั้งหมด</p>
        <div class="formula-box">เงินลงทุนรวม = Σ ค่าใช้จ่ายเงินสด + มูลค่าสิ่งสนับสนุน In-Kind</div>
        <p><strong>เงินลงทุนนับรวมอะไรบ้าง?</strong> งบประมาณจัดกิจกรรม, ค่าตอบแทนวิทยากร, ค่าวัสดุเวชภัณฑ์/อุปกรณ์, รวมถึงเวลาของอาสาสมัคร</p>
        <p><strong>ระยะเวลาประเมิน:</strong> โครงการทั่วไปนิยมประเมิน 1-3 ปี ขึ้นอยู่กับว่าผลประโยชน์จะส่งผลต่อเนื่องยาวนานเพียงใด</p>
      `,
    },
    2: {
      title: 'ขั้นตอนที่ 2: แผนผังผู้มีส่วนได้ส่วนเสีย',
      body: `
        <p>ระบุบุคคล ชุมชน และหน่วยงานที่เกี่ยวข้อง แบ่งตามกลุ่มมาตรฐาน S1–S4:</p>
        <ul>
          <li><strong>S1:</strong> กลุ่มเป้าหมาย / ผู้รับประโยชน์หลัก (นิสิต, ชุมชน, ผู้ป่วย)</li>
          <li><strong>S2:</strong> คณะทำงาน (อาจารย์, นักวิจัย, เจ้าหน้าที่)</li>
          <li><strong>S3:</strong> หน่วยงานสนับสนุนภายใน (คณะ, กอง, มหาวิทยาลัย)</li>
          <li><strong>S4:</strong> ภาคีภายนอก (อปท., รพ.สต., ภาคเอกชน)</li>
        </ul>
        <p><strong>ข้อควรระวัง:</strong> ระวังกลุ่มเป้าหมายที่ซ้ำซ้อนกันเพื่อหลีกเลี่ยงการนับผลประโยชน์ซ้ำซ้อน (Double-counting)</p>
      `,
    },
    3: {
      title: 'ขั้นตอนที่ 3: ผลลัพธ์และตัวแทนทางการเงิน',
      body: `
        <p><strong>กิจกรรม vs ผลลัพธ์:</strong></p>
        <ul>
          <li><strong>กิจกรรม (Activity):</strong> จัดอบรม 500 ชม.</li>
          <li><strong>ผลผลิต (Output):</strong> ผู้เข้าอบรม 200 คน</li>
          <li><strong>ผลลัพธ์ (Outcome):</strong> ทักษะและรายได้เพิ่มขึ้นจริง</li>
        </ul>
        <div class="formula-box">มูลค่าขั้นต้น = จำนวนผู้ได้รับผล × ตัวแทนทางการเงิน (Proxy)</div>
        <p><strong>ตัวแทนทางการเงิน (Proxy):</strong> มูลค่าประมาณการของคุณค่าทางสังคม เช่น ค่าคอร์สอบรมในตลาด หรือค่ารักษาพยาบาลที่ประหยัดได้</p>
      `,
    },
    4: {
      title: 'ขั้นตอนที่ 4: การปรับปรุงผลกระทบ',
      body: `
        <p>หักลบส่วนที่ไม่ใช่ผลงานของโครงการจริง เพื่อความน่าเชื่อถือทางวิชาการ:</p>
        <ul>
          <li><strong>Deadweight:</strong> สิ่งที่น่าจะเกิดขึ้นอยู่แล้วแม้ไม่มีโครงการ</li>
          <li><strong>Attribution:</strong> สิ่งที่เกิดจากหน่วยงานอื่นหรือภาคีร่วม</li>
          <li><strong>Displacement:</strong> ผลลัพธ์ที่ไปย้ายปัญหาหรือสร้างผลเสียให้กลุ่มอื่น</li>
          <li><strong>Drop-off:</strong> อัตราการลดทอนของผลลัพธ์ในแต่ละปี</li>
        </ul>
        <div class="formula-box">ผลสุทธิ = มูลค่าขั้นต้น × (1-Deadweight) × (1-Attribution) × (1-Displacement)</div>
      `,
    },
    5: {
      title: 'ขั้นตอนที่ 5: ทบทวนและแบบจำลองสถานการณ์',
      body: `
        <p>ตรวจสอบความสมบูรณ์ของข้อมูลก่อนประมวลผลจริง:</p>
        <ul>
          <li><strong>การแก้ไขจุดติดขัด:</strong> หากมีข้อมูลจำเป็นที่ยังขาด สามารถคลิกปุ่มนำทางเพื่อกลับไปแก้ไขได้ทันที</li>
          <li><strong>การทดสอบสถานการณ์:</strong> ทดสอบความอ่อนไหวในสถานการณ์ระมัดระวัง (Conservative) หรือเชิงบวก (Optimistic)</li>
          <li><strong>Tornado Analysis:</strong> ดูว่าตัวแปรใดส่งผลต่ออัตราส่วน SROI มากที่สุด</li>
        </ul>
      `,
    },
    6: {
      title: 'ขั้นตอนที่ 6: แดชบอร์ดและรายงานสรุป',
      body: `
        <div class="formula-box">อัตราส่วน SROI = มูลค่าปัจจุบันของผลประโยชน์รวม ÷ เงินลงทุนรวม</div>
        <p><strong>มูลค่าปัจจุบันสุทธิ (NPV):</strong> มูลค่าผลประโยชน์ทางสังคมรวม − เงินลงทุนทั้งหมด</p>
        <p><strong>การรายงานผล:</strong> อัตราส่วน SROI ควรนำเสนอควบคู่กับเรื่องเล่าเชิงคุณภาพและพันธกิจของมหาวิทยาลัยเสมอ</p>
      `,
    },
  },
  en: {
    0: {
      title: 'Overview & Preparation',
      body: `
        <p>Welcome to NU SROI Analytics assessment platform.</p>
        <p><strong>What is SROI?</strong> A framework for measuring societal value generated per ฿1 of resources invested.</p>
        <p><strong>3 Things to Prepare:</strong></p>
        <ul>
          <li>Project budget and timeline</li>
          <li>Key people affected (beneficiaries, staff)</li>
          <li>Actual meaningful changes created</li>
        </ul>
      `,
    },
    1: {
      title: 'Step 1: Scope & Investment',
      body: `
        <p>Establish project boundaries, evaluation timeframe, and all resources invested.</p>
        <div class="formula-box">Total Investment = Σ Cash Costs + In-Kind Inputs</div>
        <p><strong>What counts as investment?</strong> Operating budget, equipment, personnel time, and volunteer contributions.</p>
      `,
    },
    2: {
      title: 'Step 2: Stakeholder Mapping',
      body: `
        <p>Identify all individuals, communities, and organizations grouped into S1–S4:</p>
        <ul>
          <li><strong>S1:</strong> Primary beneficiaries (students, patients, public)</li>
          <li><strong>S2:</strong> Project operators (faculty, researchers, staff)</li>
          <li><strong>S3:</strong> Internal supporters (faculties, university funds)</li>
          <li><strong>S4:</strong> External partners (local government, clinics)</li>
        </ul>
      `,
    },
    3: {
      title: 'Step 3: Outcomes & Financial Proxies',
      body: `
        <p>Differentiate between Activities and Outcomes:</p>
        <ul>
          <li><strong>Activity:</strong> 500 hours tutoring delivered</li>
          <li><strong>Output:</strong> 200 participants attended</li>
          <li><strong>Outcome:</strong> Measurable improvement in skills or income</li>
        </ul>
        <div class="formula-box">Gross Value = Quantity × Financial Proxy</div>
      `,
    },
    4: {
      title: 'Step 4: Impact Adjustments',
      body: `
        <p>Deduct non-additional effects for credibility:</p>
        <ul>
          <li><strong>Deadweight:</strong> Would have happened anyway</li>
          <li><strong>Attribution:</strong> Caused by other partners</li>
          <li><strong>Displacement:</strong> Moved problems elsewhere</li>
          <li><strong>Drop-off:</strong> Annual fade of outcome effect</li>
        </ul>
      `,
    },
    5: {
      title: 'Step 5: Review & Scenarios',
      body: `
        <p>Verify data completeness before calculating:</p>
        <ul>
          <li><strong>Blocker Resolution:</strong> Click direct links to resolve missing items</li>
          <li><strong>Scenarios:</strong> Compare Conservative vs Optimistic assumptions</li>
          <li><strong>Tornado:</strong> Identify parameters with largest swing</li>
        </ul>
      `,
    },
    6: {
      title: 'Step 6: Dashboard & Reports',
      body: `
        <div class="formula-box">SROI Ratio = Present Value of Impact ÷ Total Investment</div>
        <p><strong>Net Social Value:</strong> Total Impact Present Value − Total Investment</p>
        <p><strong>Governance:</strong> SROI estimates should always be paired with qualitative narrative context.</p>
      `,
    },
  },
};

export function renderHelpPanel(container, stepNumber = 1, onClose = null) {
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const langDict = HELP_CONTENT[lang] || HELP_CONTENT.th;
  const content = langDict[stepNumber] || langDict[1];

  container.innerHTML = `
    <div class="help-drawer">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
        <div class="help-drawer-title" style="margin-bottom: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>${content.title}</span>
        </div>
        ${onClose ? `<button type="button" class="btn-icon btn-close-help" aria-label="${t('close', 'Close')}" style="padding: 2px 6px; cursor: pointer;">&times;</button>` : ''}
      </div>
      <div class="help-drawer-body">${content.body}</div>
      <div style="margin-top: var(--sp-md); pt: var(--sp-sm); border-top: 1px dashed var(--outline); padding-top: 10px;">
        <button type="button" class="btn btn-secondary btn-drawer-glossary" style="width: 100%; font-size: 0.75rem; justify-content: center;">
          ${isTh ? 'เปิดพจนานุกรมคำศัพท์ SROI' : 'Open SROI Glossary'}
        </button>
      </div>
    </div>
  `;

  container.querySelector('.btn-close-help')?.addEventListener('click', () => {
    if (onClose) onClose();
  });

  container.querySelector('.btn-drawer-glossary')?.addEventListener('click', () => {
    openGlossaryModal();
  });
}
