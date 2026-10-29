/**
 * Contextual Help & Methodology Panel Component
 * Bilingual support (Thai & English)
 */

import { getLanguage } from '../i18n.js';

const HELP_CONTENT = {
  th: {
    1: {
      title: 'ขั้นตอนที่ 1: ขอบเขตและเงินลงทุน',
      body: `
        <p>กำหนดขอบเขตของโครงการ กรอบเวลาในการประเมิน และทรัพยากรเงินลงทุนทั้งหมด</p>
        <div class="formula-box">เงินลงทุนรวม = Σ (จำนวนเงินแต่ละรายการ × อัตราแลกเปลี่ยน)</div>
        <p><strong>มูลค่าตามราคาปัจจุบัน vs มูลค่าปัจจุบัน:</strong> หากมีต้นทุนที่เกิดขึ้นในปีอนาคต ให้เลือกว่าจะคิดลดต้นทุนเพื่อเปรียบเทียบในรูปมูลค่าปัจจุบัน (PV) หรือไม่</p>
        <p><strong>สิ่งสนับสนุนที่ไม่ใช่ตัวเงิน (In-Kind):</strong> สามารถระบุมูลค่าของเวลาอาสาสมัครหรือทรัพยากรที่ได้รับบริจาคได้ เพื่อสะท้อนการลงทุนจริงของสังคม</p>
      `,
    },
    2: {
      title: 'ขั้นตอนที่ 2: แผนผังผู้มีส่วนได้ส่วนเสีย',
      body: `
        <p>ระบุบุคคล ชุมชน และองค์กรทั้งหมดที่ได้รับผลกระทบหรือเกิดการเปลี่ยนแปลงจากโครงการ</p>
        <p><strong>หลักการ:</strong> มีส่วนร่วมกับผู้มีส่วนได้ส่วนเสียเพื่อเข้าใจสิ่งที่เปลี่ยนแปลงสำหรับพวกเขา ทั้งผลประโยชน์เชิงบวกและผลกระทบทางลบที่ไม่ได้ตั้งใจ</p>
        <p><strong>ข้อควรระวัง:</strong> ระวังกลุ่มเป้าหมายที่ซ้ำซ้อนกันเพื่อหลีกเลี่ยงการนับคุณค่าทางสังคมซ้ำ (Double-counting)</p>
      `,
    },
    3: {
      title: 'ขั้นตอนที่ 3: ผลลัพธ์และตัวแทนทางการเงิน',
      body: `
        <p>แยกแยะความแตกต่างระหว่าง:</p>
        <ul>
          <li><strong>กิจกรรม (Activity):</strong> จัดอบรม 500 ชั่วโมง</li>
          <li><strong>ผลผลิต (Output):</strong> มีผู้เข้าร่วมอบรม 200 คน</li>
          <li><strong>ผลลัพธ์ (Outcome):</strong> ทักษะและรายได้ของผู้เข้าอบรมเพิ่มขึ้นจริง</li>
        </ul>
        <div class="formula-box">มูลค่ารวม = จำนวนผู้ได้รับผล × ตัวแทนทางการเงิน (Proxy)</div>
        <p><strong>ตัวแทนทางการเงิน (Proxy):</strong> การประมาณมูลค่าเงินตราของคุณค่าที่เกิดขึ้น ซึ่งไม่จำเป็นต้องเป็นรายได้ที่เป็นตัวเงินจริง</p>
        <p><strong>ผลลัพธ์เชิงลบ:</strong> บันทึกความเสียหายหรือผลเสียด้วยเครื่องหมายลบ เพื่อหักออกจากผลกระทบรวม</p>
      `,
    },
    4: {
      title: 'ขั้นตอนที่ 4: การปรับปรุงผลกระทบ',
      body: `
        <p>ตรวจสอบเพื่อให้แน่ใจว่าจะไม่กล่าวอ้างผลลัพธ์เกินจริง:</p>
        <ul>
          <li><strong>Deadweight:</strong> ผลที่น่าจะเกิดขึ้นอยู่แล้วแม้ไม่มีโครงการ</li>
          <li><strong>Attribution:</strong> ผลที่เกิดจากบุคคลหรือหน่วยงานอื่น</li>
          <li><strong>Displacement:</strong> ผลที่เพียงแค่ย้ายจากที่หนึ่งไปอีกที่หนึ่ง</li>
          <li><strong>Drop-off:</strong> อัตราการลดทอนของผลลัพธ์ในแต่ละปี</li>
        </ul>
        <div class="formula-box">ผลสุทธิ = ผลลัพธ์ × (1-Deadweight) × (1-Attribution) × (1-Displacement)</div>
      `,
    },
    5: {
      title: 'ขั้นตอนที่ 5: ทบทวนและแบบจำลองสถานการณ์',
      body: `
        <p>ทดสอบความอ่อนไหวของผลลัพธ์ก่อนสรุปผล:</p>
        <ul>
          <li><strong>แบบระมัดระวัง (Conservative):</strong> ประเมินจำนวนต่ำกว่า, Deadweight สูงกว่า</li>
          <li><strong>สถานการณ์ปกติ (Base Case):</strong> สมมติฐานหลักตามหลักฐานเชิงประจักษ์</li>
          <li><strong>สถานการณ์เชิงบวก (Optimistic):</strong> การเข้าถึงและผลลัพธ์ระดับสูงสุดที่เป็นไปได้</li>
        </ul>
        <p><strong>Tornado Analysis:</strong> แสดงให้เห็นว่าตัวแปรใด (อัตราคิดลด, ตัวแทนทางการเงิน, Deadweight) ส่งผลต่ออัตราส่วน SROI มากที่สุด</p>
      `,
    },
    6: {
      title: 'ขั้นตอนที่ 6: แดชบอร์ดและรายงานสรุป',
      body: `
        <div class="formula-box">อัตราส่วน SROI = มูลค่าปัจจุบันของผลประโยชน์รวม ÷ เงินลงทุนรวม</div>
        <p><strong>มูลค่าปัจจุบันสุทธิ (NPV):</strong> มูลค่าปัจจุบันของผลประโยชน์ − เงินลงทุนรวม</p>
        <p><strong>การตรวจสอบ (Audit Trail):</strong> ส่งออกรายงานสรุปแบบเป็นทางการ (PDF, Excel) พร้อมบันทึกสมมติฐานและระเบียบวิธีครบถ้วน</p>
      `,
    },
  },
  en: {
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
        <p><strong>Audit Trail:</strong> Export a formal reproducible report snapshot (PDF, Excel) with complete methodology notes.</p>
      `,
    },
  },
};

export function renderHelpPanel(container, stepNumber = 1) {
  const lang = getLanguage();
  const langDict = HELP_CONTENT[lang] || HELP_CONTENT.th;
  const content = langDict[stepNumber] || langDict[1];
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
