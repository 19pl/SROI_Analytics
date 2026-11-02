/**
 * Step 0: Welcome & Guided Assessment Orientation
 * Designed for first-time university employees, project managers, and faculty staff.
 * Explains SROI, outlines the preparation checklist, and provides a calm, reassuring entry point.
 */

import { getState } from '../../store.js';
import { t, getLanguage } from '../../i18n.js';
import { escapeHtml } from '../../utils/html.js';
import { openGlossaryModal } from '../../components/glossaryModal.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

export function renderStep0(container) {
  const { project } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const projectName = project?.name || (isTh ? 'โครงการใหม่' : 'New Project');
  const facultyName =
    project?.faculty_name ||
    project?.organization_name ||
    (isTh ? 'มหาวิทยาลัยนเรศวร' : 'Naresuan University');

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Hero Welcome Card -->
      <div class="card has-stripe" style="--stripe: var(--primary); background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); padding: var(--sp-xl);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span class="badge badge-integrated" style="font-size: 0.75rem; font-weight: 600;">
            🏛️ ${escapeHtml(facultyName)}
          </span>
          <span class="badge badge-production" style="font-size: 0.75rem;">
            ${isTh ? 'ระบบแนะนำทีละขั้นตอน (Guided Assistant)' : 'Guided Assessment'}
          </span>
        </div>

        <h1 style="font-size: 1.5rem; font-weight: 800; color: var(--on-background); margin-bottom: 8px;">
          ${isTh ? 'มาเริ่มต้นวัดมูลค่าทางสังคม (SROI) ของโครงการคุณกัน' : "Let's Measure the Social Value of Your Project"}
        </h1>
        <p style="font-size: 0.9375rem; line-height: 1.6; color: var(--muted); max-width: 800px; margin-bottom: var(--sp-lg);">
          ${
            isTh
              ? 'ยินดีต้อนรับสู่ระบบประเมินความคุ้มค่าทางสังคมของมหาวิทยาลัยนเรศวร ไม่ต้องกังวลหากคุณไม่เคยคำนวณ SROI มาก่อน ระบบจะช่วยแนะนำคุณทีละขั้นตอน คุณไม่จำเป็นต้องมีข้อมูลครบทุกอย่างในตอนนี้ และสามารถบันทึกไว้เพื่อกลับมาทำต่อได้ตลอดเวลา'
              : "Don't worry if you've never calculated SROI before. We'll guide you through each step. You don't need to know all the answers right now, and your progress is saved automatically so you can return at any time."
          }
        </p>

        <div style="display: flex; gap: var(--sp-md); flex-wrap: wrap; align-items: center;">
          <a href="#/wizard/step-1" class="btn btn-primary" style="padding: 10px 24px; font-size: 0.9375rem; font-weight: 600;">
            ${isTh ? 'เริ่มต้นการประเมิน (Start Assessment) →' : 'Start Assessment →'}
          </a>
          <button type="button" id="btnOpenWelcomeGlossary" class="btn btn-secondary">
            📖 ${isTh ? 'เปิดพจนานุกรมคำศัพท์ SROI' : 'View SROI Glossary'}
          </button>
        </div>
      </div>

      <!-- What is SROI 3-Column Educational Grid -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${isTh ? '💡 SROI คืออะไร? ทำความเข้าใจใน 1 นาที' : '💡 What is SROI? 1-Minute Overview'}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'ทำไมมหาวิทยาลัยถึงใช้การประเมินผลตอบแทนทางสังคม?' : 'Why does the university measure Social Return on Investment?'}
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--sp-lg); margin-top: var(--sp-xs);">
          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">📊</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--primary);">
              ${isTh ? '1. วัดคุณค่าที่มากกว่าตัวเงิน' : '1. Measures Beyond Money'}
            </h3>
            <p style="font-size: 0.8125rem; line-height: 1.5; color: var(--muted); margin: 0;">
              ${
                isTh
                  ? 'โครงการบริการวิชาการหรือวิจัยของมหาวิทยาลัยไม่ได้แสวงหากำไรเป็นเงินสด แต่สร้างคุณค่าต่อสุขภาวะ ทักษะชีวิต และสิ่งแวดล้อม SROI ช่วยแปลงคุณค่าเหล่านั้นให้อยู่ในรูปตัวเลขที่สื่อสารได้เข้าใจง่าย'
                  : 'University projects do not seek financial profits. SROI translates social gains (improved health, new skills, cleaner environment) into an understandable common metric.'
              }
            </p>
          </div>

          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">⚖️</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--primary);">
              ${isTh ? '2. เปรียบเทียบกับเงินลงทุน' : '2. Compares Value to Investment'}
            </h3>
            <p style="font-size: 0.8125rem; line-height: 1.5; color: var(--muted); margin: 0;">
              ${
                isTh
                  ? 'ผลลัพธ์จะแสดงในรูปอัตราส่วน เช่น 2.50 : 1 หมายความว่า เงินลงทุนทุกๆ 1 บาท สร้างผลประโยชน์ตอบแทนคืนสู่สังคมเทียบเท่ากับ 2.50 บาท'
                  : 'Results are expressed as a ratio (e.g. 2.50 : 1), meaning that for every ฿1 invested, approximately ฿2.50 in social value is generated.'
              }
            </p>
          </div>

          <div style="background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md); border: 1px solid var(--outline);">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">🛡️</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--primary);">
              ${isTh ? '3. ไม่กล่าวอ้างเกินจริง' : '3. Honest & Defensible Impact'}
            </h3>
            <p style="font-size: 0.8125rem; line-height: 1.5; color: var(--muted); margin: 0;">
              ${
                isTh
                  ? 'ระบบจะช่วยหักผลลัพธ์ส่วนที่น่าจะเกิดขึ้นอยู่แล้ว (Deadweight) หรือผลที่เกิดจากหน่วยงานอื่น (Attribution) เพื่อให้รายงานของคุณน่าเชื่อถือและตรวจสอบได้ทางวิชาการ'
                  : 'SROI deducts what would have happened anyway (Deadweight) and contributions by other partners (Attribution) so your report is credible and rigorous.'
              }
            </p>
          </div>
        </div>
      </div>

      <!-- Preparation Checklist Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${isTh ? '📋 สิ่งที่ควรเตรียมไว้ก่อนเริ่มกรอกข้อมูล' : '📋 What to Prepare Before Starting'}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'มีเพียง 3 สิ่งสำคัญที่คุณสามารถเตรียมไว้ล่วงหน้าได้:' : '3 key pieces of information to have on hand:'}
            </p>
          </div>
        </div>

        <div class="stack" style="gap: var(--sp-md); margin-top: var(--sp-xs);">
          <div style="display: flex; gap: var(--sp-md); align-items: flex-start; padding: 12px; background: var(--surface-soft); border-radius: var(--radius-md);">
            <span style="font-size: 1.25rem; line-height: 1;">1️⃣</span>
            <div>
              <strong style="font-size: 0.875rem; color: var(--on-background); display: block; margin-bottom: 2px;">
                ${isTh ? 'ขอบเขตโครงการและงบประมาณ (Project Scope & Costs)' : 'Project Scope & Budget'}
              </strong>
              <p style="font-size: 0.8125rem; color: var(--muted); margin: 0;">
                ${
                  isTh
                    ? 'ชื่อโครงการ, วัตถุประสงค์, ระยะเวลาดำเนินงาน, และงบประมาณค่าใช้จ่าย (เช่น ค่าจัดกิจกรรม, ค่าวัสดุอุปกรณ์, หรือเวลาอาสาสมัคร)'
                    : 'Project name, objectives, duration, and budget expenses (activity costs, equipment, staff time, or in-kind volunteer hours).'
                }
              </p>
            </div>
          </div>

          <div style="display: flex; gap: var(--sp-md); align-items: flex-start; padding: 12px; background: var(--surface-soft); border-radius: var(--radius-md);">
            <span style="font-size: 1.25rem; line-height: 1;">2️⃣</span>
            <div>
              <strong style="font-size: 0.875rem; color: var(--on-background); display: block; margin-bottom: 2px;">
                ${isTh ? 'กลุ่มคนที่ได้รับผลกระทบ (Stakeholders)' : 'People & Groups Affected (Stakeholders)'}
              </strong>
              <p style="font-size: 0.8125rem; color: var(--muted); margin: 0;">
                ${
                  isTh
                    ? 'ใครบ้างที่เข้าร่วมหรือได้รับผลกระทบจากโครงการ เช่น นิสิต 120 คน, ผู้ป่วย 50 ราย, หรือชุมชน 1 แห่ง'
                    : 'Who participated or was affected by the project (e.g. 120 students, 50 patients, or 1 community).'
                }
              </p>
            </div>
          </div>

          <div style="display: flex; gap: var(--sp-md); align-items: flex-start; padding: 12px; background: var(--surface-soft); border-radius: var(--radius-md);">
            <span style="font-size: 1.25rem; line-height: 1;">3️⃣</span>
            <div>
              <strong style="font-size: 0.875rem; color: var(--on-background); display: block; margin-bottom: 2px;">
                ${isTh ? 'การเปลี่ยนแปลงที่เกิดขึ้นจริง (Outcomes)' : 'Actual Changes Created (Outcomes)'}
              </strong>
              <p style="font-size: 0.8125rem; color: var(--muted); margin: 0;">
                ${
                  isTh
                    ? 'ผลลัพธ์เชิงบวกที่เกิดขึ้นกับพวกเขา เช่น รายได้เฉลี่ยเพิ่มขึ้น, สุขภาพดีขึ้น, ประหยัดค่ารักษาพยาบาล, หรือลดความเสี่ยงอุบัติเหตุ'
                    : 'The positive changes they experienced (e.g. increased income, restored health, healthcare costs avoided, or risk reduced).'
                }
              </p>
            </div>
          </div>
        </div>

        <div style="margin-top: var(--sp-lg); text-align: center;">
          <a href="#/wizard/step-1" class="btn btn-primary" style="padding: 10px 32px; font-size: 0.9375rem;">
            ${isTh ? 'พร้อมแล้ว เริ่มต้นขั้นตอนที่ 1 (Go to Step 1) →' : 'Ready? Proceed to Step 1 →'}
          </a>
        </div>
      </div>

      <!-- Sticky Wizard Footer -->
      ${wizardFooterHtml(0, {
        nextLabel: isTh
          ? 'เริ่มต้นขั้นตอนที่ 1: ข้อมูลโครงการและการลงทุน →'
          : 'Proceed to Step 1: Project & Costs →',
        canProceed: true,
      })}
    </div>
  `;

  document.getElementById('btnOpenWelcomeGlossary')?.addEventListener('click', () => {
    openGlossaryModal();
  });

  attachWizardFooterEvents(container);
}
