import { APP_TITLE } from './config/constants.js';
import { routes } from './routes.js';
import { api, getCurrentUser, subscribeAuth } from './api.js';
import { loadProject, getState, subscribe, resetStore } from './store.js';
import { signInHref } from './components/guestNotice.js';
import { escapeHtml } from './utils/html.js';
import { t, getLanguage, setLanguage, subscribeLanguage } from './i18n.js';
import { getTheme, setTheme, toggleTheme, subscribeTheme, initTheme } from './theme.js';

const $ = (id) => document.getElementById(id);

const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const navItemHtml = ({ path, labelKey, label, icon }, index) => {
  const displayLabel = labelKey ? t(labelKey, label) : label;
  // --i ใช้หน่วงแอนิเมชันเข้าทีละรายการ, data-label ใช้เป็น tooltip ตอนเมนูถูกย่อ
  return `<a class="nav-item" href="${path}" data-label="${escapeHtml(displayLabel)}" style="--i:${index}">${icon}<span>${displayLabel}</span></a>`;
};

function findRoute(hash) {
  const basePath = hash.split('?')[0];
  if (basePath.startsWith('#/wizard/')) {
    return routes.find((r) => r.path === '#/wizard/step-1') || routes[0];
  }
  if (basePath === '#/calculator') {
    return routes.find((r) => r.path === '#/wizard/step-1') || routes[0];
  }
  if (basePath === '#/faculty-report') {
    return routes.find((r) => r.path === '#/faculty-report') || routes[0];
  }
  return routes.find((r) => r.path === basePath) || routes[0];
}

function renderNav() {
  const navEl = $('nav');
  if (navEl) {
    navEl.innerHTML =
      '<span class="nav-indicator" aria-hidden="true"></span>' +
      routes
        .filter((r) => !r.hidden && !(r.path === '#/auth' && !getCurrentUser())) // account page is for signed-in users
        .map(navItemHtml).join('');
    navEl.classList.add('has-indicator');
  }
}

// เลื่อนแถบไฮไลต์ไปที่เมนูที่ active
function moveNavIndicator() {
  const navEl = $('nav');
  const indicator = navEl?.querySelector('.nav-indicator');
  const active = navEl?.querySelector('.nav-item.is-active');
  if (!indicator) return;
  if (!active) {
    indicator.classList.remove('is-visible');
    return;
  }
  indicator.style.height = `${active.offsetHeight}px`;
  indicator.style.transform = `translateY(${active.offsetTop}px)`;
  indicator.classList.add('is-visible');
}

function highlightActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    const isWizard = location.hash.startsWith('#/wizard/') && href === '#/wizard/step-1';
    link.classList.toggle('is-active', href === route.path || isWizard);
  });
  moveNavIndicator();
}

function updateControls() {
  // Theme control UI
  const theme = getTheme();
  const themeIconEl = $('themeIcon');
  const themeLabelEl = $('themeLabel');
  const btnTheme = $('btnToggleTheme');

  if (themeIconEl && themeLabelEl) {
    if (theme === 'black') {
      themeIconEl.innerHTML = sunIcon;
      themeLabelEl.textContent = 'Light';
      if (btnTheme) btnTheme.title = t('theme_light', 'Switch to Light Theme');
    } else {
      themeIconEl.innerHTML = moonIcon;
      themeLabelEl.textContent = 'Black';
      if (btnTheme) btnTheme.title = t('theme_black', 'Switch to Black Theme');
    }
  }

  // Language control UI
  const currentLang = getLanguage();
  const langLabelEl = $('langLabel');
  const btnLang = $('btnToggleLang');

  if (langLabelEl) {
    langLabelEl.textContent = currentLang.toUpperCase();
    if (btnLang) {
      btnLang.title = currentLang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย';
    }
  }

  // Toggle sidebar tooltip
  const toggleSidebarBtn = $('toggleSidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.setAttribute('aria-label', t('toggle_sidebar', 'Toggle menu'));
  }
}

function updateHeader() {
  const { project } = getState();
  const user = getCurrentUser();

  const titleEl = $('headerTitle');
  if (titleEl) {
    if (project) {
      titleEl.innerHTML = `<strong>${escapeHtml(project.name)}</strong> <span class="muted" style="font-size: 0.8125rem;">(${project.currency})</span>`;
    } else {
      titleEl.textContent = t('app_title', 'ImpactValue SROI Calculator');
    }
  }

  // Header account button: "Sign in" for guests, name + role for signed-in users
  const accountBtn = $('headerBadge');
  if (accountBtn) {
    const userIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    if (user) {
      const role = user.role ? ` · ${escapeHtml(t('role_short_' + user.role, user.role))}` : '';
      accountBtn.innerHTML = `${userIcon}<span>${escapeHtml(user.name || 'Analyst')}${role}</span>`;
      accountBtn.title = t('view_account', 'View Account');
      accountBtn.onclick = () => (window.location.hash = '#/auth');
    } else {
      accountBtn.innerHTML = `${userIcon}<span>${t('nav_sign_in', 'Sign In')}</span>`;
      accountBtn.title = t('nav_sign_in', 'Sign In');
      accountBtn.onclick = () => (window.location.hash = signInHref());
    }
  }

  updateControls();
}

// false until the stored session has been checked, so we never flash a guest page at someone who is signed in
let ready = false;

async function navigate() {
  if (!ready) return;
  const currentHash = location.hash || '#/projects';
  const route = findRoute(currentHash);

  // the sign-in page is stand-alone: no sidebar or header around it
  $('app')?.classList.toggle('is-login', route.path === '#/login');
  await route.render($('view'));
  highlightActiveNav(route);
  updateHeader();
}

/** Open the project the person last used (or their first one) so the calculator pages have data. */
async function loadInitialProject() {
  const savedProjectId = localStorage.getItem('sroi_active_project_id');
  if (savedProjectId) {
    await loadProject(Number(savedProjectId));
    if (getState().project) return;
    localStorage.removeItem('sroi_active_project_id'); // deleted or no longer accessible
  }
  const projRes = await api.getProjects();
  const list = projRes?.data || [];
  if (list.length > 0) {
    await loadProject(list[0].id);
  }
}

// Signing in loads that person's data; signing out (or an expired token) wipes it. Either way the page is redrawn.
async function onAuthChange(user) {
  if (!ready) return;
  if (user) {
    try {
      await loadInitialProject();
    } catch (err) {
      console.warn('Could not load projects after sign-in:', err.message);
    }
  } else {
    resetStore();
  }
  renderNav();
  updateHeader();
  navigate();
}

async function init() {
  initTheme();
  renderNav();
  updateControls();

  $('toggleSidebar')?.addEventListener('click', () => {
    $('app').classList.toggle('is-collapsed');
    // รีคำนวณตำแหน่งแถบไฮไลต์หลังแอนิเมชันย่อ/ขยายจบ
    setTimeout(moveNavIndicator, 320);
  });
  window.addEventListener('resize', moveNavIndicator);

  // Theme switcher button
  $('btnToggleTheme')?.addEventListener('click', () => {
    toggleTheme();
    updateControls();
  });

  // Language switcher button
  $('btnToggleLang')?.addEventListener('click', () => {
    const nextLang = getLanguage() === 'th' ? 'en' : 'th';
    setLanguage(nextLang);
  });

  // Listen to language changes: re-render nav, header, and current page
  subscribeLanguage(() => {
    renderNav();
    updateHeader();
    navigate();
  });

  // Listen to theme changes: update controls
  subscribeTheme(() => {
    updateControls();
  });

  window.addEventListener('hashchange', navigate);

  // Subscribe header updates to store changes
  subscribe(updateHeader);
  subscribeAuth(onAuthChange);

  // Restore an existing session. No token / expired token = guest: the app still opens normally and
  // every page is viewable; pages that need data show a "sign in to see data" notice.
  try {
    const user = await api.restoreSession();
    if (user) {
      await loadInitialProject();
    }
  } catch (err) {
    // backend unreachable: stay in guest mode (the stored token is kept for the next reload)
    console.warn('Backend connection note:', err.message);
  }

  ready = true;
  renderNav(); // the account entry only appears once someone is signed in
  navigate();
}

init();
