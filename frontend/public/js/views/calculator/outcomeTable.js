import { card } from '../../components/ui.js';
import { icons } from '../../components/icons.js';
import { MAX_AMOUNT, MAX_PERCENT } from '../../config/constants.js';
import { escapeHtml } from '../../utils/html.js';

/** คอลัมน์ตัวเลขของตาราง — `key` ตรงกับชื่อ property ของผลลัพธ์ใน store */
const NUMBER_COLUMNS = [
  { key: 'quantity', label: 'จำนวน (คน)', max: MAX_AMOUNT },
  { key: 'proxyValue', label: 'มูลค่า/คน/ปี (บาท)', max: MAX_AMOUNT },
  { key: 'deadweight', label: 'Deadweight %', max: MAX_PERCENT },
  { key: 'attribution', label: 'Attribution %', max: MAX_PERCENT },
  { key: 'dropOff', label: 'Drop-off %', max: MAX_PERCENT },
];

/** ชื่อ + กลุ่มผู้ได้รับผลกระทบ + คอลัมน์ตัวเลข + มูลค่าปัจจุบัน + ปุ่มลบ */
const COLUMN_COUNT = NUMBER_COLUMNS.length + 4;

/** แถวของผลลัพธ์ 1 รายการ (ช่องมูลค่าปัจจุบัน [data-pv] จะถูกเติมโดย updateResults) */
function outcomeRow(outcome) {
  const numberCells = NUMBER_COLUMNS.map(
    ({ key, label, max }) => `<td>
      <input class="input input-cell" type="number" min="0" max="${max}"
        data-outcome="${key}" value="${outcome[key]}" aria-label="${label}" />
    </td>`,
  ).join('');

  return `<tr data-id="${escapeHtml(outcome.id)}">
    <td>
      <input class="input input-cell input-wide" data-outcome="name"
        value="${escapeHtml(outcome.name)}" aria-label="ผลลัพธ์" />
    </td>
    <td>
      <input class="input input-cell input-wide" data-outcome="stakeholder"
        value="${escapeHtml(outcome.stakeholder)}" aria-label="กลุ่มผู้ได้รับผลกระทบ" />
    </td>
    ${numberCells}
    <td class="num strong" data-pv></td>
    <td>
      <button class="btn-icon" data-remove title="ลบผลลัพธ์" aria-label="ลบผลลัพธ์">
        ${icons.trash}
      </button>
    </td>
  </tr>`;
}

const EMPTY_ROW = `<tr>
  <td colspan="${COLUMN_COUNT}" class="empty">
    ยังไม่มีผลลัพธ์ กด “เพิ่มผลลัพธ์” เพื่อเริ่มคำนวณ
  </td>
</tr>`;

/** การ์ด "ผลลัพธ์ทางสังคม" (ตัวตารางว่าง — เติมแถวด้วย renderOutcomeRows) */
export function outcomeTableCard() {
  const headers = NUMBER_COLUMNS.map(({ label }) => `<th>${label}</th>`).join('');

  return card({
    title: 'ผลลัพธ์ทางสังคม',
    description: 'แต่ละแถวคือการเปลี่ยนแปลงที่เกิดกับกลุ่มผู้ได้รับผลกระทบ',
    action: `<button class="btn btn-primary" data-add>${icons.plus}เพิ่มผลลัพธ์</button>`,
    body: `<div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ผลลัพธ์</th>
            <th>กลุ่มผู้ได้รับผลกระทบ</th>
            ${headers}
            <th class="num">มูลค่าปัจจุบัน</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="outcomeBody"></tbody>
      </table>
    </div>`,
  });
}

/** วาดแถวทั้งหมดใหม่ (ใช้ตอนเพิ่ม/ลบแถวเท่านั้น — ไม่เรียกตอนพิมพ์ เพื่อไม่ให้เสียโฟกัส) */
export function renderOutcomeRows(tbody, outcomes) {
  tbody.innerHTML = outcomes.length ? outcomes.map(outcomeRow).join('') : EMPTY_ROW;
}
