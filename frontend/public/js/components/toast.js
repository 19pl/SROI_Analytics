/**
 * Small toast messages. Styles are in css/ui-kit.css (.toast-region, .toast).
 * Usage: showToast(t('saved', 'Saved'), 'success');
 * `message` is inserted as plain text, never HTML, so user input is safe to pass.
 */

const HIDE_AFTER_MS = 4000;
const FADE_MS = 200;
const TYPES = ['info', 'success', 'error'];

// One persistent live region, created up front so screen readers are already watching it
function getRegion() {
  let region = document.getElementById('toastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

export function showToast(message, type = 'info') {
  if (!message) return null;

  const toast = document.createElement('div');
  toast.className = `toast toast--${TYPES.includes(type) ? type : 'info'}`;
  toast.textContent = message;
  getRegion().appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), FADE_MS);
  }, HIDE_AFTER_MS);

  return toast;
}

if (typeof document !== 'undefined' && document.body) getRegion();