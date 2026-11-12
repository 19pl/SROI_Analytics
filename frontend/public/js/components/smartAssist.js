/**
 * Smart Input Assistance — shared building blocks (markup builders + DOM behaviours).
 * Used by the S2 / S3 / S4 sections of the stakeholder modal; configuration lives in config/stakeholderAssist.js.
 *
 * Rules every helper follows:
 *  - nothing the user typed is overwritten silently (auto-fill only touches empty or still-auto-filled fields,
 *    chips that replace text offer an "undo");
 *  - nothing numeric is ever invented (counts and amounts are placeholders/examples only);
 *  - all user-visible text is escaped.
 */

import { escapeHtml as esc } from '../utils/html.js';
import { showToast } from './toast.js';

export const OTHER_ID = '__other__';

/** text for an item that is a plain string or { th, en } */
export const pickText = (item, isTh) => {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  return isTh ? item.th : item.en || item.th;
};

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase();

/* ───────────────────────────── markup builders ───────────────────────────── */

export function labelHtml({ forId, label, required, isTh }) {
  const mark = required
    ? ' <span class="field-hint field-hint--primary" title="' +
      (isTh ? 'จำเป็นต้องกรอก' : 'Required') +
      '">*</span>'
    : `<span class="smart-opt">${isTh ? '(ไม่บังคับ)' : '(optional)'}</span>`;
  return `<label class="field-label" for="${forId}">${esc(label)}${mark}</label>`;
}

export const hintHtml = (id, text) => `<div class="smart-hint" id="${id}">${esc(text)}</div>`;
export const tipHtml = (id) => `<div class="smart-tip" id="${id}" role="status" hidden></div>`;
export const chipsHtml = (id, label) =>
  `<div class="smart-chips" id="${id}" role="group" aria-label="${esc(label)}" hidden></div>`;

/** one labelled text input / textarea / money input with a short "what goes here" line and an optional chip row */
export function fieldHtml({
  id,
  name,
  label,
  required = false,
  hint = '',
  isTh,
  tag = 'input',
  type = 'text',
  value = '',
  placeholder = '',
  maxlength,
  rows = 2,
  inputmode,
  extraAttrs = '',
  chipsLabel = '',
  tip = false,
  after = '',
}) {
  const common = `id="${id}" name="${name}" class="input" aria-describedby="${id}Hint" ${maxlength ? `maxlength="${maxlength}"` : ''} ${
    placeholder ? `placeholder="${esc(placeholder)}"` : ''
  } ${inputmode ? `inputmode="${inputmode}"` : ''} ${extraAttrs}`;
  const control =
    tag === 'textarea'
      ? `<textarea ${common} rows="${rows}">${esc(value)}</textarea>`
      : `<input type="${type}" ${common} value="${esc(value)}" />`;
  return `
    <div class="field">
      ${labelHtml({ forId: id, label, required, isTh })}
      ${hintHtml(`${id}Hint`, hint)}
      ${control}
      ${chipsLabel ? chipsHtml(`${id}Chips`, chipsLabel) : ''}
      ${tip ? tipHtml(`${id}Tip`) : ''}
      ${after}
    </div>`;
}

/** <select> with a placeholder option, the configured options and "Other" (which reveals a text box) */
export function selectWithOtherHtml({
  id,
  name,
  label,
  required = false,
  hint = '',
  isTh,
  options,
  initialRaw,
  placeholder,
  otherPlaceholder,
  maxlength = 100,
}) {
  const init = resolveOption(options, initialRaw);
  const opts = options
    .map(
      (o) =>
        `<option value="${o.id}" ${init.id === o.id ? 'selected' : ''}>${esc(pickText(o, isTh))}</option>`,
    )
    .join('');
  return `
    <div class="field">
      ${labelHtml({ forId: id, label, required, isTh })}
      ${hintHtml(`${id}Hint`, hint)}
      <select id="${id}" name="${name}" class="input" aria-describedby="${id}Hint">
        <option value="">${esc(placeholder)}</option>
        ${opts}
        <option value="${OTHER_ID}" ${init.id === OTHER_ID ? 'selected' : ''}>${isTh ? 'อื่นๆ (ระบุเอง)' : 'Other (specify)'}</option>
      </select>
      <input type="text" id="${id}Other" class="input smart-other" maxlength="${maxlength}" placeholder="${esc(otherPlaceholder)}"
        value="${esc(init.other)}" aria-label="${esc(otherPlaceholder)}" ${init.id === OTHER_ID ? '' : 'hidden'} />
      ${tipHtml(`${id}Tip`)}
    </div>`;
}

/* ───────────────────────────── option resolving ───────────────────────────── */

/**
 * Map a stored string back to an option. Matches id, Thai/English label and legacy values.
 * Unknown non-empty text → { id: OTHER_ID, other: <text> } so nothing the user saved is lost.
 */
export function resolveOption(options, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { id: '', other: '' };
  const hit = options.find((o) =>
    [o.id, o.th, o.en, ...(o.legacy || [])].some((a) => norm(a) === norm(v)),
  );
  if (hit) return { id: hit.id, other: '' };
  if (['other', 'อื่นๆ', 'อื่น ๆ'].includes(norm(v))) return { id: OTHER_ID, other: '' };
  return { id: OTHER_ID, other: v };
}

/* ───────────────────────────── auto-fill tracking ───────────────────────────── */

const autoVals = new WeakMap();

/** call once per input: when the user types, the value stops being "auto" and is never replaced again */
export function trackAuto(input) {
  if (!input) return;
  input.addEventListener('input', () => autoVals.delete(input));
}

/** fill only if the field is empty or still holds the previous suggestion; returns true if it changed the value */
export function setAuto(input, value) {
  if (!input) return false;
  const cur = input.value;
  if (cur.trim() === '' || cur === autoVals.get(input)) {
    input.value = value || '';
    if (value) autoVals.set(input, value);
    else autoVals.delete(input);
    return true;
  }
  return false;
}

const isAuto = (input) => autoVals.has(input) && autoVals.get(input) === input.value;

export function setPlaceholder(input, text) {
  if (input && text) input.placeholder = text;
}

/** swap the one-line helper text under a label (type-specific text, or the default) */
export function setHint(el, base, specific) {
  if (el) el.textContent = specific || base || '';
}

/* ───────────────────────────── select + "Other" ───────────────────────────── */

export function bindSelectWithOther({ select, other, tip, options, isTh, initialRaw, onChange }) {
  const init = resolveOption(options, initialRaw);
  let touched = false;
  const optOf = (id) => options.find((o) => o.id === id) || null;

  const apply = (initial) => {
    const id = select.value;
    other.hidden = id !== OTHER_ID;
    const opt = optOf(id);
    const text = opt?.tip ? pickText(opt.tip, isTh) : '';
    if (tip) {
      tip.hidden = !text;
      tip.innerHTML = text ? `<b>${isTh ? 'คำแนะนำ' : 'Tip'}</b>${esc(text)}` : '';
    }
    onChange?.(opt, { initial, id });
  };

  select.addEventListener('change', () => {
    touched = true;
    apply(false);
    if (select.value === OTHER_ID) other.focus();
  });

  return {
    apply,
    option: () => optOf(select.value),
    /** required-field check: an option, or "Other" with some text */
    isEmpty: () => !select.value || (select.value === OTHER_ID && !other.value.trim()),
    /** value to store, or null. A legacy value that the user did not touch is returned exactly as saved. */
    value() {
      const id = select.value;
      if (!id) return null;
      if (id === OTHER_ID) return other.value.trim() || (isTh ? 'อื่น ๆ' : 'Other');
      if (!touched && init.id === id && String(initialRaw ?? '').trim())
        return String(initialRaw).trim();
      return pickText(optOf(id), isTh);
    },
  };
}

/* ───────────────────────────── quick-select chips ───────────────────────────── */

/**
 * Chip row that writes into `input`.
 *  mode 'append'  : toggles a phrase in a comma/semicolon separated list (used phrases are highlighted; tap again to remove)
 *  mode 'replace' : sets the whole value; if that would replace text the user wrote, an inline "undo" is offered
 * Returns { setItems(items) }.
 */
export function bindChips({
  container,
  input,
  isTh,
  mode = 'append',
  sep = ', ',
  maxLen = 0,
  label = '',
}) {
  let items = [];
  const splitRe = /\s*(?:,|;|\n)\s*/;
  let undoEl = null;
  let undoTimer = null;

  const hideUndo = () => {
    clearTimeout(undoTimer);
    if (undoEl) undoEl.hidden = true;
  };

  const showUndo = (previous) => {
    if (!undoEl) {
      undoEl = document.createElement('div');
      undoEl.className = 'smart-undo';
      undoEl.setAttribute('role', 'status');
      container.insertAdjacentElement('afterend', undoEl);
    }
    undoEl.innerHTML = `<span>${isTh ? 'แทนที่ข้อความเดิมแล้ว' : 'Replaced your previous text.'}</span><button type="button">${isTh ? 'เลิกทำ' : 'Undo'}</button>`;
    undoEl.hidden = false;
    undoEl.querySelector('button').addEventListener('click', () => {
      input.value = previous;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      hideUndo();
    });
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 10000);
  };

  const tokens = () =>
    input.value
      .split(splitRe)
      .map((s) => s.trim())
      .filter(Boolean);
  const has = (text) => (mode === 'append' ? tokens().includes(text) : input.value.trim() === text);

  const refresh = () => {
    container.querySelectorAll('[data-chip]').forEach((b) => {
      const used = !b.hasAttribute('data-focus') && has(b.dataset.chip);
      b.classList.toggle('is-used', used);
      b.setAttribute('aria-pressed', String(used));
    });
  };

  const fire = () => input.dispatchEvent(new Event('input', { bubbles: true }));

  const onChip = (btn) => {
    if (btn.hasAttribute('data-focus')) {
      input.focus();
      input.select?.();
      return;
    }
    const text = btn.dataset.chip;
    if (mode === 'replace') {
      const prev = input.value;
      if (prev.trim() === text) return;
      const userText = prev.trim() !== '' && !isAuto(input);
      input.value = text;
      fire();
      if (userText) showUndo(prev);
      else hideUndo();
      return;
    }
    // append / toggle
    if (has(text)) {
      const re = new RegExp(`(^|[,;\\n]\\s*)${escRe(text)}(?=\\s*(?:[,;\\n]|$))`);
      input.value = input.value
        .replace(re, '')
        .replace(/^\s*[,;\n]\s*/, '')
        .trim();
    } else {
      const cur = input.value.replace(/\s+$/, '');
      const next = cur === '' ? text : /[,;]$/.test(cur) ? `${cur} ${text}` : `${cur}${sep}${text}`;
      if (maxLen && next.length > maxLen) {
        showToast(
          isTh ? `ข้อความยาวเกิน ${maxLen} ตัวอักษร` : `Text would exceed ${maxLen} characters.`,
          'error',
        );
        return;
      }
      input.value = next;
    }
    fire();
    input.focus();
  };

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (btn && container.contains(btn)) onChip(btn);
  });
  input.addEventListener('input', () => {
    refresh();
    if (mode === 'replace') hideUndo();
  });

  return {
    setItems(list) {
      items = list || [];
      container.hidden = items.length === 0;
      container.innerHTML =
        (label ? `<span class="smart-chips__label">${esc(label)}</span>` : '') +
        items
          .map((it) => {
            const text = pickText(it, isTh);
            return `<button type="button" class="smart-chip" data-chip="${esc(text)}" ${it.focus ? 'data-focus' : ''} aria-pressed="false">${esc(text)}</button>`;
          })
          .join('');
      refresh();
    },
  };
}

/* ───────────────────────────── numeric inputs ───────────────────────────── */

/** whole non-negative numbers only (type=number still lets "e", "+", "-" and "." through) */
export function bindIntegerOnly(input) {
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
  });
  input.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') ?? '';
    if (!/^\d+$/.test(text.trim())) e.preventDefault();
  });
}

export const formatMoney = (n) =>
  n === null || n === undefined || n === '' || Number.isNaN(Number(n))
    ? ''
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** digits and one decimal point only, thousands separators while typing, max 2 decimals; caret stays put */
export function bindMoney(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/[^\d.]/g, '').length;
    let clean = raw.replace(/[^\d.]/g, '');
    const dot = clean.indexOf('.');
    if (dot !== -1)
      clean =
        clean.slice(0, dot + 1) +
        clean
          .slice(dot + 1)
          .replace(/\./g, '')
          .slice(0, 2);
    let [ip, fp] = clean.split('.');
    ip = (ip || '').replace(/^0+(?=\d)/, '').slice(0, 13);
    const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const out = fp !== undefined ? `${grouped || '0'}.${fp}` : grouped;
    if (out === raw) return;
    input.value = out;
    let pos = 0;
    let seen = 0;
    while (pos < out.length && seen < digitsBefore) {
      if (/[\d.]/.test(out[pos])) seen += 1;
      pos += 1;
    }
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* not supported on this input type */
    }
  });
}
