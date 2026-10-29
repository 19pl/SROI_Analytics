/**
 * Sign-in and account pages.
 *  - renderLogin  (#/login): stand-alone full-screen sign-in; the app shell (sidebar/header) is hidden by main.js.
 *  - renderAuth   (#/auth):  account page for signed-in users, inside the app. Guests are sent to the login page.
 */

import { api, setSession, getCurrentUser, consumeSessionExpired, userWithRole } from '../api.js';
import { escapeHtml } from '../utils/html.js';
import { getLanguage, setLanguage, t } from '../i18n.js';

/** Where to go after signing in: the page the guest came from (#/login?next=...), or the projects page. */
function nextHash() {
  const query = location.hash.split('?')[1] || '';
  const next = new URLSearchParams(query).get('next') || '';
  // only same-app hash routes; never bounce back to the login/account pages or to anything external
  const allowed = /^#\/[A-Za-z0-9\-_/?=&%.]*$/.test(next) && !next.startsWith('#/login') && !next.startsWith('#/auth');
  return allowed ? next : '#/projects';
}

const brandHtml = () => `
  <div class="auth-brand">
    <img src="/images/logo.png" alt="" onerror="this.style.display='none'" />
    <div>
      <div class="auth-brand-name">${t('institution_nu', 'Naresuan University')}</div>
      <div class="muted" style="font-size: 0.75rem;">NU SROI Analytics</div>
    </div>
  </div>`;

export function renderLogin(root) {
  // already signed in: nothing to do here
  if (getCurrentUser()) {
    window.location.hash = nextHash();
    return;
  }
  const expired = consumeSessionExpired();
  const lang = getLanguage();

  root.innerHTML = `
    <div class="login-screen">
      <button type="button" class="btn btn-secondary login-lang" id="loginLang">${lang === 'th' ? 'English' : 'ไทย'}</button>
      <div class="card has-stripe login-card" style="box-shadow: var(--shadow-card); --stripe: var(--accent);">
        ${brandHtml()}
        <h1 class="card-title" style="margin-bottom: 4px;">${t('tab_sign_in', 'Sign In')}</h1>
        <p class="muted" style="font-size: 0.8125rem; margin-bottom: var(--sp-md);">
          ${t('auth_subtitle', 'Role-based access control and institutional workspace administration for Naresuan University')}
        </p>

        ${expired ? `<div class="alert alert-info">${t('auth_session_expired', 'Your session has expired. Please sign in again.')}</div>` : ''}

        <form id="authLoginForm" class="stack" style="gap: var(--sp-md);" novalidate>
          <div class="field">
            <label class="field-label" for="authEmail">${t('field_email', 'Institutional Email (@nu.ac.th)')} *</label>
            <input id="authEmail" type="email" name="email" class="input" required autocomplete="username" autofocus />
          </div>
          <div class="field">
            <label class="field-label" for="authPassword">${t('field_password', 'Password')} *</label>
            <input id="authPassword" type="password" name="password" class="input" required autocomplete="current-password" />
          </div>
          <div id="authErrorMsg" class="alert alert-danger" role="alert" style="display: none; margin-bottom: 0;"></div>
          <button type="submit" id="btnSignIn" class="btn btn-primary" style="width: 100%; justify-content: center;">
            ${t('tab_sign_in', 'Sign In')}
          </button>
        </form>

        <p class="muted" style="font-size: 0.8125rem; margin: var(--sp-md) 0 var(--sp-xs);">
          ${t('auth_guest_help', 'Accounts are issued by the SROI administrator. If you do not have one, please contact them.')}
        </p>
        <a href="#/projects" class="muted" style="font-size: 0.8125rem; text-decoration: underline;">
          ${t('btn_browse_as_guest', 'Browse without signing in')}
        </a>
      </div>
    </div>
  `;

  document.getElementById('loginLang')?.addEventListener('click', () => setLanguage(lang === 'th' ? 'en' : 'th'));

  const loginForm = document.getElementById('authLoginForm');
  const errBox = document.getElementById('authErrorMsg');
  const btn = document.getElementById('btnSignIn');
  const showError = (msg) => {
    errBox.textContent = msg;
    errBox.style.display = 'flex';
  };

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.style.display = 'none';
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    if (!email || !password) {
      showError(t('auth_enter_both', 'Please enter your email and password.'));
      return;
    }
    btn.disabled = true;
    btn.textContent = t('btn_signing_in', 'Signing in…');
    try {
      const res = await api.login(email, password);
      // main.js listens for the sign-in, loads the person's project data and re-renders the current page
      setSession(res.token, userWithRole(res.user, res.organizations));
      window.location.hash = nextHash();
    } catch (err) {
      loginForm.password.value = '';
      showError(err.message);
      btn.disabled = false;
      btn.textContent = t('tab_sign_in', 'Sign In');
    }
  });
}

export function renderAuth(root) {
  const user = getCurrentUser();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  root.innerHTML = `
    <div style="max-width: 520px; margin: 40px auto;">
      <div class="card has-stripe" style="box-shadow: var(--shadow-card); --stripe: var(--accent);">
        <div class="card-head">
          <div>
            ${brandHtml()}
            <h1 class="card-title" style="margin-bottom: 4px;">${t('auth_title', 'User Account & Organization')}</h1>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('auth_subtitle', 'Role-based access control and institutional workspace administration for Naresuan University')}
            </p>
          </div>
        </div>

        <div class="stack" style="gap: var(--sp-md);">
          <div class="alert alert-success has-stripe" style="background: rgba(34, 197, 94, 0.08); --stripe: var(--positive);">
            <div>
              <strong>${t('auth_signed_in_as', 'Signed in as:')}</strong>
              <div style="font-size: 0.9375rem; font-weight: 700; margin-top: 2px; color: var(--on-background);">
                ${escapeHtml(user.name)} <span class="muted" style="font-weight: 400; font-size: 0.8125rem;">(${escapeHtml(user.email)})</span>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: var(--sp-sm);">
            <button class="btn btn-secondary" id="btnLogout">${t('btn_sign_out', 'Sign Out')}</button>
            <a class="btn btn-primary" href="#/projects">${t('btn_go_projects', 'Go to Projects Workspace →')}</a>
          </div>

          <div style="border-top: 1px solid var(--outline); padding-top: var(--sp-md); margin-top: var(--sp-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
              <h3 style="font-size: 0.9375rem; font-weight: 700;">${t('institution_label', 'Academic Institution')}</h3>
              <span class="badge badge-integrated" style="font-size: 0.6875rem;">${t('institution_unit', 'Governed Institution Unit')}</span>
            </div>
            <div id="orgListContainer" class="stack" style="gap: var(--sp-xs);">
              <div class="muted">${t('loading', 'Loading organizations...')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    // api.logout() always ends signed-out; the auth listener in main.js clears the store and this page sends guests to #/login
    await api.logout();
  });

  api.getOrganizations().then((res) => {
    const orgs = res?.data || [];
    const box = document.getElementById('orgListContainer');
    if (!box) return;

    if (orgs.length === 0) {
      box.innerHTML = `<div class="muted" style="font-size: 0.8125rem;">${t('no_data', 'No organizations joined yet.')}</div>`;
      return;
    }

    box.innerHTML = orgs
      .map(
        (o) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-soft); border-radius: var(--radius-sm); border: 1px solid var(--outline);">
        <strong style="color: var(--on-background); font-size: 0.875rem;">${escapeHtml(o.name)}</strong>
        <span class="badge badge-production">${escapeHtml(t('role_short_' + o.role, o.role || 'Member'))}</span>
      </div>
    `,
      )
      .join('');
  });
}
