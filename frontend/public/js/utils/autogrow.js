/**
 * Auto-growing text boxes.
 *
 * Every <textarea class="input"> (and .s1-autogrow) grows and shrinks with its text, so nothing is
 * hidden behind a scrollbar and there is no resize handle to drag. It also re-fits when the box
 * changes width (phone rotation, window resize, a modal opening), because wrapping changes then.
 * Works for boxes rendered later (modals, step pages) via a MutationObserver. Spreadsheet cells
 * (.sc) are left alone.
 */

const SELECTOR = 'textarea.input, textarea.s1-autogrow';

function fit(el) {
  if (!el.isConnected || el.offsetParent === null) return; // hidden: fitted when it becomes visible
  const cs = getComputedStyle(el);
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = 'auto';
  const full = el.scrollHeight + border;
  const max = parseFloat(cs.maxHeight);
  const capped = Number.isFinite(max) && full > max;
  el.style.height = `${capped ? max : full}px`;
  el.style.overflowY = capped ? 'auto' : 'hidden';
}

const resizeObserver =
  typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver((entries) => {
        for (const entry of entries) {
          const el = entry.target;
          const w = Math.round(entry.contentRect.width);
          if (w > 0 && w !== el._autogrowW) {
            el._autogrowW = w;
            fit(el);
          }
        }
      });

function register(el) {
  if (el._autogrow) return;
  el._autogrow = true;
  resizeObserver?.observe(el);
  fit(el);
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.matches?.(SELECTOR)) register(root);
  root.querySelectorAll?.(SELECTOR).forEach(register);
}

export function initAutogrow() {
  if (window.__autogrowReady) return;
  window.__autogrowReady = true;
  document.addEventListener('input', (e) => {
    if (e.target.matches?.(SELECTOR)) fit(e.target);
  });
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach(scan);
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
  // Web fonts change line widths once loaded.
  document.fonts?.ready?.then(() => document.querySelectorAll(SELECTOR).forEach(fit));
}
