import { APP_TITLE, HOME_HASH } from './config/constants.js';
import { routes } from './routes.js';

const $ = (id) => document.getElementById(id);

const navItemHtml = ({ path, label, icon }) =>
  `<a class="nav-item" href="${path}" title="${label}">${icon}<span>${label}</span></a>`;

const findRoute = (hash) => routes.find((route) => route.path === hash) ?? routes[0];

function renderNav() {
  $('nav').innerHTML = routes.map(navItemHtml).join('');
}

function highlightActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === route.path);
  });
}

function navigate() {
  const route = findRoute(location.hash || HOME_HASH);

  route.render($('view'));
  $('headerTitle').textContent = `${APP_TITLE} / ${route.label}`;
  highlightActiveNav(route);
}

renderNav();
$('toggleSidebar').addEventListener('click', () => $('app').classList.toggle('is-collapsed'));
window.addEventListener('hashchange', navigate);
navigate();
