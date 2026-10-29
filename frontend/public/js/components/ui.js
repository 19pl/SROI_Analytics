// ส่วนประกอบ UI ขนาดเล็กที่ใช้ซ้ำ (คืนค่าเป็นสตริง HTML)
// หมายเหตุ: title / description / body / label เป็น HTML ที่นักพัฒนาเขียนเอง (เชื่อถือได้)
// ส่วนข้อความที่มาจากผู้ใช้ต้องผ่าน escapeHtml ก่อนเสมอ
import { STATUS_LABEL } from '../data/mockProjects.js';
import { escapeHtml } from '../utils/html.js';

/** ป้ายสถานะ — `status` ต้องตรงกับคลาส .badge-<status> ใน components.css */
export const badge = (status, label) =>
  `<span class="badge badge-${status}">${label ?? STATUS_LABEL[status]}</span>`;

/** การ์ดพร้อมหัวข้อ (ไม่ใส่ title/action ก็จะไม่มีส่วนหัว) */
export function card({ title = '', description = '', action = '', body = '', cls = '' }) {
  const heading = title ? `<h2 class="card-title">${title}</h2>` : '';
  const subtitle = description ? `<p class="muted">${description}</p>` : '';
  const head =
    title || action ? `<div class="card-head"><div>${heading}${subtitle}</div>${action}</div>` : '';
  const className = ['card', cls].filter(Boolean).join(' ');

  return `<section class="${className}">${head}${body}</section>`;
}

/** ช่องกรอกตัวเลข — `key` ผูกกับ data-field เพื่อให้ตัวจัดการ input หา state ได้ */
export function numberField({ key, label, value, suffix = '', min = 0, max = 1e12, step = 1 }) {
  return `<label class="field">
    <span class="field-label">${label}</span>
    <span class="field-control">
      <input class="input" type="number" inputmode="decimal" data-field="${key}"
        value="${value}" min="${min}" max="${max}" step="${step}" />
      <span class="field-suffix">${suffix}</span>
    </span>
  </label>`;
}

export const textField = ({ key, label, value }) =>
  `<label class="field">
    <span class="field-label">${label}</span>
    <input class="input" data-field="${key}" value="${escapeHtml(value)}" />
  </label>`;
