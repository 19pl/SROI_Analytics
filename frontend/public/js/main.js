import { APP_TITLE } from './config/constants.js';
import { routes } from './routes.js';
import { api, getCurrentUser } from './api.js';
import { loadProject, getState, subscribe } from './store.js';
import { escapeHtml } from './utils/html.js';
import { t, getLanguage, setLanguage, subscribeLanguage } from './i18n.js';
import { getTheme, setTheme, toggleTheme, subscribeTheme, initTheme } from './theme.js';

const $ = (id) => document.getElementById(id);

const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const navItemHtml = ({ path, labelKey, label, icon }) => {
  const displayLabel = labelKey ? t(labelKey, label) : label;
  return `<a class="nav-item" href="${path}" title="${displayLabel}">${icon}<span>${displayLabel}</span></a>`;
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
    navEl.innerHTML = routes.filter((r) => !r.hidden).map(navItemHtml).join('');
  }
}

function highlightActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    const isWizard = location.hash.startsWith('#/wizard/') && href === '#/wizard/step-1';
    link.classList.toggle('is-active', href === route.path || isWizard);
  });
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

  const badgeEl = $('headerBadge');
  if (badgeEl && user) {
    badgeEl.textContent = user.name || 'Analyst';
    badgeEl.className = 'badge badge-integrated';
    badgeEl.style.cursor = 'pointer';
    badgeEl.title = t('view_account', 'View Account');
    badgeEl.onclick = () => (window.location.hash = '#/auth');
  }

  updateControls();
}

async function navigate() {
  const currentHash = location.hash || '#/projects';
  const route = findRoute(currentHash);

  await route.render($('view'));
  highlightActiveNav(route);
  updateHeader();
}

async function init() {
  initTheme();
  renderNav();
  updateControls();

  $('toggleSidebar')?.addEventListener('click', () => $('app').classList.toggle('is-collapsed'));

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

  // Restore existing session; redirect to login if none found
  try {
    const user = await api.ensureDemoSession();
    if (!user) {
      // No valid session — go to login page unless already there
      if (location.hash !== '#/auth') {
        window.location.hash = '#/auth';
      }
    } else {
      const savedProjectId = localStorage.getItem('sroi_active_project_id');
      if (savedProjectId) {
        await loadProject(Number(savedProjectId));
      } else {
        const projRes = await api.getProjects();
        const list = projRes?.data || [];
        if (list.length > 0) {
          await loadProject(list[0].id);
        }
      }
    }
  } catch (err) {
    console.warn('Backend connection note:', err.message);
  }

  navigate();
}

init();
