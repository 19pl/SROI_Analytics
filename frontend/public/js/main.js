import { routes } from './routes.js';

const $ = (id) => document.getElementById(id);

$('nav').innerHTML = routes
  .map((r) => `<a class="nav-item" href="${r.path}" title="${r.label}">${r.icon}<span>${r.label}</span></a>`)
  .join('');

function navigate() {
  const currentHash = location.hash || '#/';
  const route = routes.find((r) => r.path === currentHash) ?? routes[0];
  route.render($('view'));
  $('headerTitle').textContent = `NU SROI / ${route.label}`;
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === route.path));
}

$('toggleSidebar').addEventListener('click', () => $('app').classList.toggle('is-collapsed'));
window.addEventListener('hashchange', navigate);
navigate();
