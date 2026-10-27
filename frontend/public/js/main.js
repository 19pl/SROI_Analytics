import { APP_TITLE } from './config/constants.js';
import { routes } from './routes.js';
import { api, getCurrentUser } from './api.js';
import { loadProject, getState, subscribe } from './store.js';
import { escapeHtml } from './utils/html.js';

const $ = (id) => document.getElementById(id);

const navItemHtml = ({ path, label, icon }) =>
  `<a class="nav-item" href="${path}" title="${label}">${icon}<span>${label}</span></a>`;

function findRoute(hash) {
  if (hash.startsWith('#/wizard/')) {
    return routes.find((r) => r.path === '#/wizard/step-1') || routes[0];
  }
  if (hash === '#/calculator') {
    return routes.find((r) => r.path === '#/wizard/step-1') || routes[0];
  }
  return routes.find((r) => r.path === hash) || routes[0];
}

function renderNav() {
  $('nav').innerHTML = routes.map(navItemHtml).join('');
}

function highlightActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    const isWizard = location.hash.startsWith('#/wizard/') && href === '#/wizard/step-1';
    link.classList.toggle('is-active', href === route.path || isWizard);
  });
}

function updateHeader() {
  const { project } = getState();
  const user = getCurrentUser();

  const titleEl = $('headerTitle');
  if (titleEl) {
    if (project) {
      titleEl.innerHTML = `<strong>${escapeHtml(project.name)}</strong> <span class="muted" style="font-size: 0.8125rem;">(${project.currency})</span>`;
    } else {
      titleEl.textContent = 'ImpactValue SROI Calculator';
    }
  }

  const badgeEl = document.querySelector('.shell-header .badge');
  if (badgeEl && user) {
    badgeEl.textContent = user.name || 'Analyst';
    badgeEl.className = 'badge badge-integrated';
    badgeEl.style.cursor = 'pointer';
    badgeEl.title = 'View Account';
    badgeEl.onclick = () => (window.location.hash = '#/auth');
  }
}

async function navigate() {
  const currentHash = location.hash || '#/projects';
  const route = findRoute(currentHash);

  await route.render($('view'));
  highlightActiveNav(route);
  updateHeader();
}

async function init() {
  renderNav();
  $('toggleSidebar').addEventListener('click', () => $('app').classList.toggle('is-collapsed'));
  window.addEventListener('hashchange', navigate);

  // Subscribe header updates to store changes
  subscribe(updateHeader);

  // Ensure active session & default project
  try {
    await api.ensureDemoSession();
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
  } catch (err) {
    console.warn('Backend connection note:', err.message);
  }

  navigate();
}

init();
