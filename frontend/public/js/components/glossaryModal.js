/**
 * SROI Glossary Modal Component
 * Explains technical SROI terminology in plain, ordinary language for university staff.
 */

import { openModal, closeModal } from './modal.js';
import { t, getLanguage } from '../i18n.js';
import { escapeHtml } from '../utils/html.js';

export const GLOSSARY_TERMS = [
  {
    term: 'Stakeholder',
    th_title: 'ผู้มีส่วนได้ส่วนเสีย (Stakeholder)',
    en_title: 'Stakeholder',
    th_desc:
      'บุคคล กลุ่มคน ชุมชน หรือองค์กรที่ได้รับผลกระทบ มีส่วนร่วม หรือเกิดการเปลี่ยนแปลงขึ้นเพราะโครงการของคุณ เช่น นิสิต, อาจารย์, ชุมชนรอบมหาวิทยาลัย, หรือหน่วยงานภาครัฐ',
    en_desc:
      'People, groups, or organizations that experience change or affect the initiative (e.g. students, community members, staff, government agencies).',
    example_th: 'นิสิตที่เข้าอบรม, ผู้สูงอายุที่มารับบริการตรวจสายตา, ภาควิชาที่จัดโครงการ',
    example_en:
      'Students attending training, patients receiving therapy, department organizing the program.',
  },
  {
    term: 'Outcome',
    th_title: 'ผลลัพธ์ (Outcome) vs กิจกรรม (Activity)',
    en_title: 'Outcome vs Activity',
    th_desc:
      'กิจกรรม คือสิ่งที่โครงการลงมือทำ (เช่น จัดอบรม 3 วัน) ส่วนผลลัพธ์ คือการเปลี่ยนแปลงที่มีความหมายที่เกิดขึ้นกับผู้คนหลังเสร็จสิ้นกิจกรรม (เช่น ผู้เข้าอบรมมีรายได้เพิ่มขึ้น หรือสุขภาพดีขึ้น)',
    en_desc:
      'Activities are what you do (deliver tutoring); outcomes are the real changes experienced by beneficiaries (grades improve, stress decreases).',
    example_th: 'กิจกรรม: แจกแว่นตา 100 อัน → ผลลัพธ์: ผู้สูงอายุมองเห็นชัดเจนและลดการพลัดตกหกล้ม',
    example_en: 'Activity: Free eye exams → Outcome: Restored vision and reduced risk of falling.',
  },
  {
    term: 'Financial Proxy',
    th_title: 'ตัวแทนทางการเงิน (Financial Proxy)',
    en_title: 'Financial Proxy',
    th_desc:
      'การประมาณมูลค่าเป็นตัวเงินของคุณค่าทางสังคมที่ไม่ได้มีการซื้อขายในตลาดทั่วไป เพื่อให้สามารถเปรียบเทียบกับเงินลงทุนได้ ไม่ใช่เงินสดที่ได้รับจริง',
    en_desc:
      'An approximation of monetary value for social changes that do not have a direct market price.',
    example_th:
      'ทักษะที่เพิ่มขึ้นเทียบเท่ากับค่าคอร์สอบรมในตลาด (เช่น ฿3,000/คน) หรือสุขภาพดีขึ้นเทียบเท่าค่ารักษาพยาบาลที่ประหยัดได้',
    example_en:
      'Value of gained skills proxied by market tuition costs (e.g. ฿3,000/person) or avoided medical bills.',
  },
  {
    term: 'Deadweight',
    th_title: 'ผลที่น่าจะเกิดขึ้นอยู่แล้ว (Deadweight)',
    en_title: 'Deadweight',
    th_desc:
      'สัดส่วนของการเปลี่ยนแปลงที่น่าจะเกิดขึ้นอยู่แล้วตามธรรมชาติ แม้ว่าจะไม่มีโครงการของคุณก็ตาม เพื่อไม่ให้โครงการอ้างผลงานเกินจริง',
    en_desc:
      'The proportion of total outcome change that would have happened anyway without the project.',
    example_th:
      'แม้ไม่มีโครงการอบรม ปกติผู้เข้าร่วมประมาณ 10% ก็สามารถหางานทำได้เองอยู่แล้ว → Deadweight = 10%',
    example_en:
      'If 10% of participants would have found jobs on their own anyway, Deadweight is 10%.',
  },
  {
    term: 'Attribution',
    th_title: 'ผลจากผู้อื่นหรือปัจจัยร่วม (Attribution)',
    en_title: 'Attribution',
    th_desc:
      'สัดส่วนของผลลัพธ์ที่เกิดจากการช่วยเหลือหรือการดำเนินงานของหน่วยงานอื่น ไม่ได้เกิดจากโครงการของคุณเพียงลำพัง',
    en_desc:
      'The proportion of the outcome that was created through the contribution of other people or partner agencies.',
    example_th:
      'โครงการจัดร่วมกับ รพ.สต. และ อปท. ซึ่งสนับสนุนงบประมาณและวิทยากร 30% → Attribution = 30%',
    example_en:
      'If a local clinic contributed staff and budget covering 30% of the effort, Attribution is 30%.',
  },
  {
    term: 'Displacement',
    th_title: 'การย้ายปัญหา / ผลกระทบภายนอก (Displacement)',
    en_title: 'Displacement',
    th_desc:
      'สัดส่วนที่ผลประโยชน์ของโครงการกลับไปแย่งชิงหรือสร้างผลเสียให้แก่กลุ่มอื่นภายนอกโครงการโดยไม่ได้ตั้งใจ',
    en_desc:
      'Whether the project outcome simply displaced problems or harmed outcomes for another group elsewhere.',
    example_th:
      'เปิดตลาดนัดวิชาการในมหาวิทยาลัย ทำให้ยอดขายของร้านค้ารอบรั้วมหาวิทยาลัยลดลงชั่วคราว',
    example_en:
      'Setting up a campus market reduced sales for shops located right outside the university gates.',
  },
  {
    term: 'Drop-off',
    th_title: 'การลดทอนของผลลัพธ์ในแต่ละปี (Drop-off)',
    en_title: 'Drop-off',
    th_desc: 'อัตราที่ผลกระทบของโครงการค่อยๆ เลือนหายไปหรือลดลงตามกาลเวลาในแต่ละปีที่ผ่านไป',
    en_desc:
      'The rate at which an outcome effect naturally deteriorates or fades in subsequent years.',
    example_th:
      'ความรู้จากการอบรมอาจเลือนหายไปปีละ 20% หากผู้เข้าอบรมไม่ได้นำไปปฏิบัติซ้ำอย่างสม่ำเสมอ',
    example_en:
      'Knowledge from a single training session may fade by 20% per year without refresher exercises.',
  },
  {
    term: 'Discount Rate',
    th_title: 'อัตราคิดลด (Discount Rate)',
    en_title: 'Discount Rate',
    th_desc:
      'อัตราที่ใช้ปรับมูลค่าของผลประโยชน์ที่จะเกิดขึ้นในอนาคตให้กลับมาเป็นมูลค่าปัจจุบัน (ตามหลักการที่ว่า เงิน 100 บาทในวันนี้ มีมูลค่ามากกว่าเงิน 100 บาทในอีก 5 ปีข้างหน้า)',
    en_desc: "The rate used to convert future social benefits into today's present value terms.",
    example_th:
      'มหาวิทยาลัยและหน่วยงานรัฐในไทยนิยมใช้อัตรา 0% หรือ 3.0% (ตามอัตราคิดลดทางเศรษฐศาสตร์ของหน่วยงานภาครัฐ)',
    example_en: 'Commonly 0% or 3.0% benchmarked against national fiscal or central bank guidance.',
  },
  {
    term: 'SROI Ratio',
    th_title: 'อัตราส่วนผลตอบแทนทางสังคม (SROI Ratio)',
    en_title: 'SROI Ratio',
    th_desc:
      'ตัวเลขอัตราส่วนที่แสดงว่าเงินลงทุนทุกๆ 1 บาทในโครงการนี้ ก่อให้เกิดมูลค่าทางสังคมเทียบเท่ากี่บาท (สูตร: มูลค่าปัจจุบันสุทธิของผลประโยชน์รวม ÷ เงินลงทุนรวม)',
    en_desc:
      'The ratio comparing total present value of social impact against total investment inputs.',
    example_th:
      'SROI = 2.45 : 1 หมายความว่า เงินลงทุน 1 บาท สร้างมูลค่าผลประโยชน์คืนสู่สังคมประมาณ 2.45 บาท',
    example_en:
      'SROI 2.45 : 1 means every ฿1 invested creates approximately ฿2.45 of societal value.',
  },
];

/**
 * Opens the interactive glossary modal
 * @param {string} filterTerm - optional specific term to highlight/filter
 */
export function openGlossaryModal(filterTerm = null) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const bodyHtml = `
    <div class="form-stack stack-md">
      <div class="field">
        <input type="text" id="glossarySearchInput" class="input" placeholder="${isTh ? 'ค้นหาคำศัพท์ (เช่น Deadweight, ตัวแทนทางการเงิน)...' : 'Search term (e.g. Deadweight, Proxy)...'}" value="${filterTerm ? escapeHtml(filterTerm) : ''}"  />
      </div>

      <div id="glossaryListContainer" class="form-stack stack-sm glossary-scroll-list">
        ${renderGlossaryItems(filterTerm, isTh)}
      </div>
    </div>
  `;

  openModal({
    title: isTh ? 'พจนานุกรมคำศัพท์ SROI (SROI Glossary)' : 'SROI Terminology Glossary',
    body: bodyHtml,
    size: 'lg',
    footer: `<button class="btn btn-primary" data-modal-close>${t('close', 'ปิด')}</button>`,
  });

  const searchInput = document.getElementById('glossarySearchInput');
  const container = document.getElementById('glossaryListContainer');

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    container.innerHTML = renderGlossaryItems(q, isTh);
  });

  if (filterTerm && searchInput) {
    searchInput.focus();
  }
}

function renderGlossaryItems(query, isTh) {
  const q = (query || '').toLowerCase();
  const matched = GLOSSARY_TERMS.filter((item) => {
    if (!q) return true;
    return (
      item.term.toLowerCase().includes(q) ||
      item.th_title.toLowerCase().includes(q) ||
      item.en_title.toLowerCase().includes(q) ||
      item.th_desc.toLowerCase().includes(q) ||
      item.en_desc.toLowerCase().includes(q)
    );
  });

  if (matched.length === 0) {
    return `<div class="empty-state"><p class="empty-state__text">${isTh ? 'ไม่พบคำศัพท์ที่ตรงกับการค้นหา' : 'No matching terms found.'}</div>`;
  }

  return matched
    .map(
      (item) => `
      <div class="card glossary-card">
        <div class="toolbar">
          <h4 class="panel__title primary-text">
            ${isTh ? escapeHtml(item.th_title) : escapeHtml(item.en_title)}
          </h4>
          <span class="status status--neutral">${escapeHtml(item.term)}</span>
        </div>
        <p class="muted-sm">
          ${isTh ? escapeHtml(item.th_desc) : escapeHtml(item.en_desc)}
        </p>
        <div class="glossary-example-box">
          <strong>${isTh ? 'ตัวอย่างจริง:' : 'Example:'}</strong> ${isTh ? escapeHtml(item.example_th) : escapeHtml(item.example_en)}
        </div>
      </div>
    `,
    )
    .join('');
}
