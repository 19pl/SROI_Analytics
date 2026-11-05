/**
 * Sign-in and account pages.
 *  - renderLogin  (#/login): stand-alone full-screen sign-in; the app shell (sidebar/header) is hidden by main.js.
 *  - renderAuth   (#/auth):  account page for signed-in users, inside the app. Guests are sent to the login page.
 */

import { api, setSession, getCurrentUser, consumeSessionExpired, userWithRole } from '../api.js';
import { escapeHtml } from '../utils/html.js';
import { getLanguage, setLanguage, t } from '../i18n.js';
import { icons } from '../components/icons.js';

/** Where to go after signing in: the page the guest came from (#/login?next=...), or the projects page. */
function nextHash() {
  const query = location.hash.split('?')[1] || '';
  const next = new URLSearchParams(query).get('next') || '';
  // only same-app hash routes; never bounce back to the login/account pages or to anything external
  const allowed =
    /^#\/[A-Za-z0-9\-_/?=&%.]*$/.test(next) &&
    !next.startsWith('#/login') &&
    !next.startsWith('#/auth');
  return allowed ? next : '#/projects';
}

const eyeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeOffIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 4.06-5.06M9.9 5.24A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M2 2l20 20"/></svg>`;

const brandHtml = () => `
  <div class="auth-brand">
    <div class="org-banner-icon">
      ${icons.institution || icons.folder}
    </div>
    <div>
      <div class="auth-brand-name">${t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)')}</div>
      <div class="muted-sm">NU SROI Analytics</div>
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
  const isTh = lang !== 'en';

  root.innerHTML = `
    <div class="login-screen">
      <button type="button" class="btn btn-secondary login-lang" id="loginLang">
        ${lang === 'th' ? 'English' : 'ไทย'}
      </button>
      <div class="card has-stripe login-card">
        ${brandHtml()}
        <h1 class="card-title">${t('tab_sign_in', 'Sign In')}</h1>
        <p class="muted-sm">
          ${t('auth_subtitle', 'Role-based access control and institutional workspace administration for Naresuan University')}
        </p>

        ${
          expired
            ? `<div class="status status--warn">${t('auth_session_expired', 'Your session has expired. Please sign in again.')}</div>`
            : ''
        }

        <form id="authLoginForm" class="form-stack" novalidate>
          <div class="field">
            <label class="field-label" for="authEmail">
              ${t('field_email', 'Institutional Email (@nu.ac.th)')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <input
              id="authEmail"
              type="email"
              name="email"
              class="input"
              required
              autocomplete="username"
              placeholder="e.g. colleague@nu.ac.th"
              autofocus
            />
          </div>

          <div class="field">
            <label class="field-label" for="authPassword">
              ${t('field_password', 'Password')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <div class="password-field">
              <input
                id="authPassword"
                type="password"
                name="password"
                class="input"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="password-toggle"
                id="btnTogglePassword"
                aria-label="${isTh ? 'แสดงรหัสผ่าน' : 'Show password'}"
                aria-pressed="false"
                title="${isTh ? 'แสดงรหัสผ่าน' : 'Show password'}"
              >${eyeIcon}</button>
            </div>
          </div>

          <div id="authErrorMsg" class="field-error" hidden></div>

          <button type="submit" id="btnSignIn" class="btn btn-primary btn-block">
            ${t('tab_sign_in', 'Sign In')}
          </button>
        </form>

        <p class="muted-sm stack-top-sm">
          ${t('auth_guest_help', 'Accounts are issued by the SROI administrator. If you do not have one, please contact them.')}
        </p>
      </div>
    </div>
  `;

  document
    .getElementById('loginLang')
    ?.addEventListener('click', () => setLanguage(lang === 'th' ? 'en' : 'th'));

  const loginForm = document.getElementById('authLoginForm');
  const errBox = document.getElementById('authErrorMsg');
  const btn = document.getElementById('btnSignIn');
  const pwdInput = document.getElementById('authPassword');
  const toggleBtn = document.getElementById('btnTogglePassword');

  toggleBtn?.addEventListener('click', () => {
    if (!pwdInput) return;
    const reveal = pwdInput.type === 'password';
    pwdInput.type = reveal ? 'text' : 'password';
    const label = reveal
      ? isTh
        ? 'ซ่อนรหัสผ่าน'
        : 'Hide password'
      : isTh
        ? 'แสดงรหัสผ่าน'
        : 'Show password';
    toggleBtn.innerHTML = reveal ? eyeOffIcon : eyeIcon;
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('aria-pressed', String(reveal));
    toggleBtn.title = label;
    pwdInput.focus();
  });

  const showError = (msg) => {
    if (errBox) {
      errBox.textContent = msg;
      errBox.hidden = false;
    }
  };

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errBox) errBox.hidden = true;

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

/** Initials for the avatar: first letter of the first two words (Latin) or first character (Thai). */
function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] || '?';
  const second = parts[1] && /[A-Za-z]/.test(first) ? [...parts[1]][0] : '';
  return (first + second).toUpperCase();
}

const accountRow = (label, valueHtml) => `
  <div class="account-row">
    <dt>${label}</dt>
    <dd>${valueHtml}</dd>
  </div>`;

export function renderAuth(root) {
  const user = getCurrentUser();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const roleLabel = escapeHtml(t('role_short_' + (user.role || 'editor'), user.role || 'Editor'));
  const orgName = escapeHtml(
    user.organization_name || t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)'),
  );

  root.innerHTML = `
    <div class="account-page">
      <header class="account-head">
        <h1 class="account-title">${t('auth_title', 'User Account & Organization')}</h1>
        <p class="account-sub">${t('auth_subtitle', 'Role-based access control and institutional workspace administration for Naresuan University')}</p>
      </header>

      <!-- Profile -->
      <section class="account-profile" aria-label="${escapeHtml(t('acct_profile', 'Profile'))}">
        <div class="account-avatar" aria-hidden="true">${escapeHtml(initialsOf(user.name))}</div>
        <div class="account-identity">
          <h2 class="account-name">${escapeHtml(user.name || '-')}</h2>
          <div class="account-email">${escapeHtml(user.email || '-')}</div>
          <div class="account-meta">
            <span class="account-role">${roleLabel}</span>
            <span class="account-org-inline">${orgName}</span>
          </div>
        </div>
        <div class="account-actions">
          <a class="btn btn-primary" href="#/projects">${t('btn_go_projects', 'Go to Projects Workspace')}</a>
          <button type="button" class="btn btn-secondary" id="btnLogout">${t('btn_sign_out', 'Sign Out')}</button>
        </div>
      </section>

      <div class="account-grid">
        <!-- Account information -->
        <section class="account-card">
          <h3 class="account-card-title">${t('acct_info', 'Account information')}</h3>
          <dl class="account-list">
            ${accountRow(t('col_member_name', 'Name'), escapeHtml(user.name || '-'))}
            ${accountRow(t('col_member_email', 'Email'), escapeHtml(user.email || '-'))}
            ${accountRow(t('col_member_role', 'Role'), `<span class="account-role">${roleLabel}</span>`)}
            ${accountRow(t('institution_label', 'Academic Institution'), `<span id="authOrgName">${orgName}</span>`)}
          </dl>
        </section>

        <!-- Organization membership -->
        <section class="account-card">
          <h3 class="account-card-title">${t('acct_memberships', 'Organization membership')}</h3>
          <div id="orgListContainer" class="account-orgs" aria-live="polite">
            <div class="account-orgs-empty">${t('loading', 'Loading organizations...')}</div>
          </div>
        </section>
      </div>

      <p class="account-foot">${t('auth_guest_help', 'Accounts are issued by the SROI administrator. If you do not have one, please contact them.')}</p>
    </div>
  `;

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    // api.logout() always ends signed-out; the auth listener in main.js clears the store and this page sends guests to #/login
    await api.logout();
  });

  const renderOrgs = (html) => {
    const box = document.getElementById('orgListContainer');
    if (box) box.innerHTML = html;
  };

  api
    .getOrganizations()
    .then((res) => {
      const orgs = res?.data || [];
      if (orgs.length === 0) {
        renderOrgs(
          `<div class="account-orgs-empty">${t('no_data', 'No organizations joined yet.')}</div>`,
        );
        return;
      }
      renderOrgs(
        orgs
          .map(
            (o) => `
        <div class="account-org">
          <span class="account-org-icon" aria-hidden="true">${icons.institution || icons.folder}</span>
          <span class="account-org-name">${escapeHtml(o.name)}</span>
          <span class="account-role account-role--quiet">${escapeHtml(t('role_short_' + o.role, o.role || 'Member'))}</span>
        </div>`,
          )
          .join(''),
      );
    })
    .catch(() => {
      renderOrgs(
        `<div class="account-orgs-empty">${t('acct_orgs_error', 'Could not load organizations.')}</div>`,
      );
    });
}