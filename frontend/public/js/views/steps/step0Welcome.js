/**
 * Step 0: Welcome & Guided Assessment Orientation
 * Professional university standard, uncluttered, no emoji, fits on a laptop screen.
 */

import { getState } from '../../store.js';
import { getLanguage } from '../../i18n.js';
import { escapeHtml } from '../../utils/html.js';

export function renderStep0(container) {
  const { project } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const facultyName =
    project?.faculty_name ||
    project?.organization_name ||
    (isTh ? 'มหาวิทยาลัยนเรศวร' : 'Naresuan University');

  container.innerHTML = `
    <div class="stack-md">
      <header class="page-head">
        <div>
          <p class="muted-sm">${escapeHtml(facultyName)}</p>
          <h1 class="page-head__title">
            ${isTh ? 'เริ่มต้นการประเมินความคุ้มค่าทางสังคม (SROI)' : 'Social Return on Investment (SROI) Assessment'}
          </h1>
          <p class="page-head__sub">
            ${
              isTh
                ? 'ระบบประเมินผลตอบแทนทางสังคม เพื่อแปลงคุณค่าที่เกิดขึ้นต่อชุมชนและสังคมให้เป็นมูลค่าเทียบเคียงตัวเงิน ระบบจะแนะนำการดำเนินการทีละขั้นตอน และบันทึกข้อมูลให้อัตโนมัติทุกช่วงเวลา'
                : 'A standardized framework to measure and account for the broader social and economic value created by university initiatives. This guided assistant leads you through each step and auto-saves your progress.'
            }
          </p>
        </div>
        <div class="page-head__actions">
          <a href="#/wizard/step-1" class="btn btn-primary">
            ${isTh ? 'เริ่มต้นการประเมิน' : 'Start Assessment'} &rarr;
          </a>
        </div>
      </header>

      <div class="stack-sm">
        <details class="disclosure">
          <summary class="disclosure__summary">
            ${isTh ? 'SROI คืออะไร? (คำอธิบายสั้น)' : 'What is SROI? (Quick Overview)'}
          </summary>
          <div class="stack-sm muted-sm">
            <p>
              <strong>1. ${isTh ? 'วัดคุณค่าที่มากกว่าตัวเงิน' : 'Measures beyond money'}:</strong>
              ${
                isTh
                  ? 'แปลงคุณค่าทางสังคม สุขภาพ การศึกษา และสิ่งแวดล้อม ให้อยู่ในรูปตัวเลขทางการเงินที่เข้าใจง่าย'
                  : 'Translates social, health, and educational impacts into an understandable financial metric.'
              }
            </p>
            <p>
              <strong>2. ${isTh ? 'เปรียบเทียบกับงบประมาณลงทุน' : 'Compares value to investment'}:</strong>
              ${
                isTh
                  ? 'แสดงในรูปอัตราส่วน เช่น 2.50:1 หมายถึง ทุก ๆ 1 บาทที่ลงทุน สร้างคุณค่าทางสังคมคืนสู่ชุมชน 2.50 บาท'
                  : 'Expressed as a ratio (e.g. 2.50:1), meaning every ฿1 invested creates ฿2.50 in social value.'
              }
            </p>
            <p>
              <strong>3. ${isTh ? 'ไม่กล่าวอ้างเกินจริง' : 'Honest & defensible'}:</strong>
              ${
                isTh
                  ? 'หักสิ่งที่น่าจะเกิดขึ้นอยู่แล้ว (Deadweight) และผลจากหน่วยงานอื่น (Attribution) เพื่อความถูกต้องทางวิชาการ'
                  : 'Deducts deadweight and attribution so findings are academically sound and defensible.'
              }
            </p>
          </div>
        </details>

        <details class="disclosure">
          <summary class="disclosure__summary">
            ${isTh ? 'สิ่งที่ควรเตรียมก่อนเริ่มบันทึกข้อมูล' : 'What to Prepare Before Starting'}
          </summary>
          <div class="stack-sm muted-sm">
            <p>1. ${isTh ? 'ชื่อโครงการและวัตถุประสงค์โดยสรุป' : 'Project name and concise objectives'}</p>
            <p>2. ${isTh ? 'กรอบเวลาดำเนินงานและระยะเวลาที่คาดว่าจะเกิดผลกระทบ (1–3 ปี)' : 'Implementation timeline and expected impact period (1–3 years)'}</p>
            <p>3. ${isTh ? 'งบประมาณค่าใช้จ่ายจริง ทั้งเงินสดและสิ่งสนับสนุน (In-Kind เช่น เวลาอาสาสมัคร)' : 'Actual project costs, including cash expenses and in-kind contributions (e.g. volunteer hours)'}</p>
            <p>4. ${isTh ? 'กลุ่มผู้มีส่วนได้ส่วนเสียและจำนวนผู้ได้รับประโยชน์จริง (นิสิต, ชุมชน, ผู้ป่วย)' : 'Target stakeholder groups and participant counts (students, community members, patients)'}</p>
            <p>5. ${isTh ? 'การเปลี่ยนแปลงที่สังเกตได้ชัดเจน (ทักษะใหม่, สุขภาพที่ดีขึ้น, รายได้ที่เพิ่มขึ้น)' : 'Observed positive changes (new skills, improved health, increased income)'}</p>
            <p>6. ${isTh ? 'ข้อมูลหลักฐานหรือเอกสารอ้างอิงประกอบโครงการ' : 'Supporting evidence or project documentation'}</p>
          </div>
        </details>
      </div>
    </div>
  `;
}
