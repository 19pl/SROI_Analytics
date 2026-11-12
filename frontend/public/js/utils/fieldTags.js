/**
 * Field tags — one shared "Required / Optional / Done" tag for every form field.
 *
 *   Required  (amber)  this box must be filled in
 *   Optional  (grey)   this box may be left blank
 *   Done      (green)  the box has a value, so it is good to go (works for both kinds)
 *
 * Markup comes from reqTag() / optTag() and is placed inside the field's <label>. The tag finds its
 * own control (the label's `for`, or the first control in the same .field / <label>) and flips to
 * "Done" as the user types or picks, and flips back if the box is cleared. Boxes rendered later
 * (modals, step pages) are picked up by a MutationObserver, and values changed from code
 * (chips, auto-fill, presets) are caught by the attribute/child observers and a short re-check
 * after every click or key press.
 */

import { getLanguage } from '../i18n.js';

const CONTROL = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea';
const TAGS = '.ftag[data-ftag]';

const isThai = () => getLanguage() === 'th';

const LABELS = {
  req: { th: 'จำเป็น', en: 'Required' },
  opt: { th: 'ไม่บังคับ', en: 'Optional' },
  done: { th: 'กรอกแล้ว', en: 'Done' },
};

const CHECK =
  '<svg class="ftag__icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const DOT = '<span class="ftag__dot" aria-hidden="true"></span>';

function build(kind, isTh) {
  const lang = isTh ? 'th' : 'en';
  const text = LABELS[kind][lang];
  const done = LABELS.done[lang];
  return (
    `<span class="ftag ftag--${kind}" data-ftag="${kind}" data-state="todo" data-text="${text}" data-done="${done}">` +
    `${DOT}<span class="ftag__text">${text}</span></span>`
  );
}

/** "Required" tag — put it inside the field's <label> */
export const reqTag = (isTh = isThai()) => build('req', isTh);
/** "Optional" tag — the box can stay blank */
export const optTag = (isTh = isThai()) => build('opt', isTh);
/** reqTag or optTag from a boolean */
export const fieldTag = (required, isTh = isThai()) => (required ? reqTag(isTh) : optTag(isTh));

/* ───────────────────────────── behaviour ───────────────────────────── */

function controlsFor(tag) {
  const label = tag.closest('label');
  const forId = label?.getAttribute('for') || tag.dataset.ftagFor;
  if (forId) {
    const el = document.getElementById(forId);
    if (el) return [el];
  }
  // No `for`: walk up from the tag until an ancestor holds a control. Stop at the field boundary
  // so a tag never reaches into a neighbouring field.
  const STOP = '.field, fieldset, .form-group, form, th, td, tr, .form-row';
  for (let node = tag.parentElement; node && node !== document.body; node = node.parentElement) {
    const main = node.querySelector(CONTROL);
    if (main) return [main]; // the main control comes first; "Other…" boxes follow it
    // radio group (e.g. cash / in-kind): done when one is picked
    const radios = node.querySelectorAll('input[type=radio]');
    if (radios.length) return [...radios];
    if (node.matches(STOP)) break;
  }
  return [];
}

function hasValue(el) {
  if (el.type === 'radio') {
    const group = el.name
      ? el.form?.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`) || [el]
      : [el];
    return [...group].some((r) => r.checked);
  }
  if (el.type === 'checkbox') return el.checked;
  if (el.tagName === 'SELECT') {
    if (el.value === '') return false;
    // "Other (specify)" with nothing typed is not done yet
    if (el.value === '__other__') {
      const other = document.getElementById(`${el.id}Other`);
      return !!other && other.value.trim() !== '';
    }
    return true;
  }
  return String(el.value ?? '').trim() !== '';
}

function paint(tag) {
  const controls = controlsFor(tag);
  const done = controls.length > 0 && controls.some(hasValue);
  const state = done ? 'done' : 'todo';
  if (tag.dataset.state === state) return;
  tag.dataset.state = state;
  const text = tag.querySelector('.ftag__text');
  if (done) {
    tag.firstElementChild?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: CHECK }).firstElementChild);
    if (text) text.textContent = tag.dataset.done;
  } else {
    tag.firstElementChild?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: DOT }).firstElementChild);
    if (text) text.textContent = tag.dataset.text;
  }
}

const paintAll = (root = document) => {
  if (root.nodeType !== 1 && root !== document) return;
  if (root.matches?.(TAGS)) paint(root);
  root.querySelectorAll?.(TAGS).forEach(paint);
};

let queued = false;
const schedulePaint = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    paintAll();
  });
};

export function initFieldTags() {
  if (window.__fieldTagsReady) return;
  window.__fieldTagsReady = true;

  for (const type of ['input', 'change']) {
    document.addEventListener(type, schedulePaint, true);
  }
  // chips / presets fill boxes from code after a click or key press
  for (const type of ['click', 'keyup']) {
    document.addEventListener(type, () => setTimeout(schedulePaint, 60), true);
  }
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach((n) => paintAll(n));
    }
    schedulePaint();
  }).observe(document.body, { childList: true, subtree: true });
  paintAll();
}
