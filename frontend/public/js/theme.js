/**
 * SROI Analytics — Theme Manager
 * Supports 'light' and 'black' themes
 * Persists selection to localStorage ('sroi_theme')
 */

const STORAGE_KEY = 'sroi_theme';
const DEFAULT_THEME = 'light';

const listeners = new Set();

/**
 * Get current active theme ('light' | 'black')
 */
export function getTheme() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'black' || saved === 'light') return saved;
  }
  return DEFAULT_THEME;
}

/**
 * Set active theme and apply to document root
 */
export function setTheme(theme) {
  const target = theme === 'black' ? 'black' : 'light';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, target);
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', target);
  }
  listeners.forEach((fn) => {
    try {
      fn(target);
    } catch (e) {
      console.error('Theme listener error:', e);
    }
  });
}

/**
 * Toggle between 'light' and 'black' theme
 */
export function toggleTheme() {
  const current = getTheme();
  const next = current === 'black' ? 'light' : 'black';
  setTheme(next);
  return next;
}

/**
 * Subscribe to theme changes
 */
export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Initialize theme from localStorage on module load
 */
export function initTheme() {
  const theme = getTheme();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
