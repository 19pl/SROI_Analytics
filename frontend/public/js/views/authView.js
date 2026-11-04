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
            <div class="cluster cluster--space-between">
              <label class="field-label" for="authPassword">
                ${t('field_password', 'Password')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
              </label>
              <button type="button" class="btn btn-ghost btn-compact-subtle" id="btnTogglePassword">
                ${isTh ? 'แสดงรหัสผ่าน' : 'Show'}
              </button>
            </div>
            <input
              id="authPassword"
              type="password"
              name="password"
              class="input"
              required
              autocomplete="current-password"
            />
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
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword
      ? isTh
        ? 'ซ่อนรหัสผ่าน'
        : 'Hide'
      : isTh
        ? 'แสดงรหัสผ่าน'
        : 'Show';
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

export function renderAuth(root) {
  const user = getCurrentUser();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }
  const lang = getLanguage();
  const isTh = lang !== 'en';

  root.innerHTML = `
    <div class="account-container">
      <div class="card has-stripe">
        <div class="card-head">
          <div>
            ${brandHtml()}
            <h1 class="card-title">${t('auth_title', 'User Account & Organization')}</h1>
            <p class="muted-sm">
              ${t('auth_subtitle', 'Role-based access control and institutional workspace administration for Naresuan University')}
            </p>
          </div>
        </div>

        <div class="form-stack stack-lg">
          <!-- 2-Column User Details List -->
          <div class="auth-detail-grid">
            <div class="auth-detail-item">
              <span class="muted-sm uppercase strong">${t('col_member_name', 'Name')}</span>
              <div class="strong auth-detail-val">${escapeHtml(user.name || '-')}</div>
            </div>

            <div class="auth-detail-item">
              <span class="muted-sm uppercase strong">${t('col_member_email', 'Email')}</span>
              <div class="strong auth-detail-val">${escapeHtml(user.email || '-')}</div>
            </div>

            <div class="auth-detail-item">
              <span class="muted-sm uppercase strong">${t('col_member_role', 'Role')}</span>
              <div class="auth-detail-val">
                <span class="status status--ok">
                  ${escapeHtml(t('role_short_' + (user.role || 'editor'), user.role || 'Editor'))}
                </span>
              </div>
            </div>

            <div class="auth-detail-item">
              <span class="muted-sm uppercase strong">${t('institution_label', 'Academic Institution')}</span>
              <div class="strong auth-detail-val" id="authOrgName">
                ${escapeHtml(user.organization_name || t('institution_nu', 'มหาวิทยาลัยนเรศวร (Naresuan University)'))}
              </div>
            </div>
          </div>

          <!-- Actions: Sign out as secondary button -->
          <div class="toolbar">
            <button class="btn btn-secondary" id="btnLogout">
              ${t('btn_sign_out', 'Sign Out')}
            </button>
            <a class="btn btn-primary" href="#/projects">
              ${t('btn_go_projects', 'Go to Projects Workspace')}
            </a>
          </div>

          <!-- Organization Hierarchy / Membership -->
          <div class="panel panel--soft form-stack stack-sm">
            <div class="cluster cluster--space-between">
              <h3 class="panel__title">${t('institution_label', 'Academic Institution')}</h3>
              <span class="status status--neutral">${t('institution_unit', 'Governed Institution Unit')}</span>
            </div>
            <div id="orgListContainer" class="form-stack stack-xs">
              <div class="empty-state">
                <p class="empty-state__text">${t('loading', 'Loading organizations...')}</p>
              </div>
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
      box.innerHTML = `<div class="empty-state"><p class="empty-state__text">${t('no_data', 'No organizations joined yet.')}</p></div>`;
      return;
    }

    box.innerHTML = orgs
      .map(
        (o) => `
      <div class="cluster cluster--space-between panel panel--soft">
        <strong class="strong">${escapeHtml(o.name)}</strong>
        <span class="status status--neutral">${escapeHtml(t('role_short_' + o.role, o.role || 'Member'))}</span>
      </div>
    `,
      )
      .join('');
  });
}
