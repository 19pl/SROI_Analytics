/**
 * The four fixed stakeholder groups of the Excel workbooks (S1–S4) and small helpers shared by Steps 1–4,
 * so a stakeholder is described once and picked (not retyped) everywhere else.
 */

import { t } from '../i18n.js';

export const GROUPS = [
  { key: 'primary_beneficiary', code: 'S1', unit: 'คน', fundsByDefault: false },
  { key: 'project_operator', code: 'S2', unit: 'คน', fundsByDefault: true },
  { key: 'project_supporter', code: 'S3', unit: 'คณะ', fundsByDefault: true },
  { key: 'other_agency', code: 'S4', unit: 'แห่ง', fundsByDefault: true },
];

export const UNIT_SUGGESTIONS = ['คน', 'ครัวเรือน', 'คณะ', 'ภาควิชา', 'แห่ง', 'หน่วยงาน', 'กลุ่ม'];

export const groupByKey = (key) => GROUPS.find((g) => g.key === key) || null;

export function groupLabel(g) {
  return t(`grp_${g.code.toLowerCase()}`, `${g.code} ${g.key}`);
}

/** next free sub-code in a group, e.g. S3 → "S3.1", then "S3.2" (mirrors the rows under "S3." in the Excel) */
export function nextGroupCode(stakeholders, group) {
  let max = 0;
  const re = new RegExp(`^${group.code}\\.(\\d+)$`);
  stakeholders.forEach((s) => {
    const m = re.exec(String(s.group_code || '').trim());
    if (m) max = Math.max(max, Number(m[1]));
  });
  const sameGroup = stakeholders.filter((s) => s.stakeholder_group === group.key).length;
  return `${group.code}.${Math.max(max, sameGroup) + 1}`;
}

/** "S3.1 คณะสหเวชศาสตร์" — how a stakeholder is named in every dropdown */
export function stakeholderLabel(s) {
  return `${s.group_code ? s.group_code + ' ' : ''}${s.name}`;
}

/** <option> list grouped by S1–S4 (<optgroup>), used by every stakeholder dropdown */
export function stakeholderOptionsHtml(stakeholders, selectedId, esc) {
  const parts = GROUPS.map((g) => {
    const list = stakeholders.filter((s) => s.stakeholder_group === g.key);
    if (!list.length) return '';
    return `<optgroup label="${esc(groupLabel(g))}">${list
      .map(
        (s) =>
          `<option value="${s.id}" ${Number(selectedId) === s.id ? 'selected' : ''}>${esc(stakeholderLabel(s))}</option>`,
      )
      .join('')}</optgroup>`;
  });
  const rest = stakeholders.filter((s) => !groupByKey(s.stakeholder_group));
  if (rest.length) {
    parts.push(
      `<optgroup label="${esc(t('grp_none', 'Unclassified'))}">${rest
        .map(
          (s) =>
            `<option value="${s.id}" ${Number(selectedId) === s.id ? 'selected' : ''}>${esc(stakeholderLabel(s))}</option>`,
        )
        .join('')}</optgroup>`,
    );
  }
  return parts.join('');
}

/** parse a typed amount: accepts "1,300,000" and "1 300 000"; returns null for blank, NaN for garbage */
export function parseAmount(raw) {
  const s = String(raw ?? '').replace(/[,\s฿]/g, '');
  if (s === '') return null;
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}
