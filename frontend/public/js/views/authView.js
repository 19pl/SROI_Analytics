import { api, setSession, getCurrentUser, clearSession } from '../api.js';
import { openModal, closeModal } from '../components/modal.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

export function renderAuth(root) {
  const user = getCurrentUser();

  root.innerHTML = `
    <div style="max-width: 500px; margin: 40px auto;">
      <div class="card">
        <div class="card-head">
          <div>
            <h1 class="card-title">${t('auth_title', 'User Account & Organization')}</h1>
            <p class="muted" style="font-size: 0.8125rem;">
              ${t('auth_subtitle', 'Role-based access control and organizational workspace administration.')}
            </p>
          </div>
        </div>

        ${
          user
            ? `
          <div class="stack" style="gap: var(--sp-md);">
            <div class="alert alert-success">
              <div>
                <strong>${t('auth_signed_in_as', 'Signed in as:')}</strong> ${escapeHtml(user.name)} (${escapeHtml(user.email)})
              </div>
            </div>

            <div style="display: flex; gap: var(--sp-sm);">
              <button class="btn btn-secondary" id="btnLogout">${t('btn_sign_out', 'Sign Out')}</button>
              <a class="btn btn-primary" href="#/projects">${t('btn_go_projects', 'Go to Projects Workspace →')}</a>
            </div>

            <div style="border-top: 1px solid var(--outline); padding-top: var(--sp-md); margin-top: var(--sp-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
                <h3 style="font-size: 0.9375rem;">${t('filter_org', 'Organizations')}</h3>
                <button class="btn btn-secondary" id="btnCreateOrg" style="height: 28px; font-size: 0.75rem;">+ New Org</button>
              </div>
              <div id="orgListContainer" class="stack" style="gap: var(--sp-xs);">
                <div class="muted">${t('loading', 'Loading organizations...')}</div>
              </div>
            </div>
          </div>
        `
            : `
          <div class="stack" style="gap: var(--sp-md);">
            <div style="display: flex; gap: var(--sp-sm); border-bottom: 1px solid var(--outline); padding-bottom: var(--sp-sm);">
              <button class="btn btn-secondary is-active" id="tabLogin">${t('tab_sign_in', 'Sign In')}</button>
              <button class="btn btn-secondary" id="tabRegister">${t('tab_register', 'Create Account')}</button>
              <button class="btn btn-primary" id="btnQuickDemo" style="margin-left: auto;">${t('btn_quick_demo', '⚡ Quick Demo Login')}</button>
            </div>

            <form id="authLoginForm" class="stack" style="gap: var(--sp-md);">
              <div class="field">
                <label class="field-label">${t('field_email', 'Email Address')} *</label>
                <input type="email" name="email" class="input" required value="demo@impactvalue.local" />
              </div>
              <div class="field">
                <label class="field-label">${t('field_password', 'Password')} *</label>
                <input type="password" name="password" class="input" required value="DemoPassword123!" />
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">${t('tab_sign_in', 'Sign In')}</button>
            </form>

            <form id="authRegisterForm" class="stack" style="gap: var(--sp-md); display: none;">
              <div class="field">
                <label class="field-label">${t('field_full_name', 'Full Name')} *</label>
                <input type="text" name="name" class="input" required placeholder="Impact Analyst" />
              </div>
              <div class="field">
                <label class="field-label">${t('field_email', 'Email Address')} *</label>
                <input type="email" name="email" class="input" required placeholder="analyst@institution.org" />
              </div>
              <div class="field">
                <label class="field-label">${t('field_password', 'Password')} (min 8 chars) *</label>
                <input type="password" name="password" class="input" required minlength="8" />
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">${t('tab_register', 'Create Account')}</button>
            </form>

            <div id="authErrorMsg" class="alert alert-danger" style="display: none;"></div>
          </div>
        `
        }
      </div>
    </div>
  `;

  if (user) {
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
      try {
        await api.logout();
      } catch (e) {}
      clearSession();
      renderAuth(root);
    });

    // Load orgs
    api.getOrganizations().then((res) => {
      const orgs = res?.data || [];
      const box = document.getElementById('orgListContainer');
      if (!box) return;

      if (orgs.length === 0) {
        box.innerHTML = `<div class="muted" style="font-size: 0.8125rem;">No organizations joined yet.</div>`;
        return;
      }

      box.innerHTML = orgs
        .map(
          (o) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface-soft); border-radius: var(--radius-sm);">
          <strong>${escapeHtml(o.name)}</strong>
          <span class="badge badge-planned">${escapeHtml(o.role || 'Member')}</span>
        </div>
      `,
        )
        .join('');
    });

    document.getElementById('btnCreateOrg')?.addEventListener('click', () => {
      openCreateOrgModal({
        onCreated: () => renderAuth(root),
      });
    });
  } else {
    const loginForm = document.getElementById('authLoginForm');
    const regForm = document.getElementById('authRegisterForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabRegister');
    const errBox = document.getElementById('authErrorMsg');

    tabLogin?.addEventListener('click', () => {
      loginForm.style.display = 'grid';
      regForm.style.display = 'none';
      tabLogin.classList.add('is-active');
      tabReg.classList.remove('is-active');
    });

    tabReg?.addEventListener('click', () => {
      loginForm.style.display = 'none';
      regForm.style.display = 'grid';
      tabReg.classList.add('is-active');
      tabLogin.classList.remove('is-active');
    });

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api.login(loginForm.email.value.trim(), loginForm.password.value);
        setSession(res.token, res.user);
        window.location.hash = '#/projects';
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      }
    });

    regForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api.register(
          regForm.email.value.trim(),
          regForm.name.value.trim(),
          regForm.password.value,
        );
        setSession(res.token, res.user);
        window.location.hash = '#/projects';
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      }
    });

    document.getElementById('btnQuickDemo')?.addEventListener('click', async () => {
      try {
        await api.ensureDemoSession();
        window.location.hash = '#/projects';
      } catch (err) {
        alert(`Demo login error: ${err.message}`);
      }
    });
  }
}

function openCreateOrgModal({ onCreated }) {
  const formHtml = `
    <form id="orgCreateForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">Organization Name *</label>
        <input type="text" name="name" class="input" required placeholder="e.g. Social Value Research Institute" />
      </div>
      <div id="orgModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: 'Create Organization',
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="btnSubmitOrg">Create Org</button>
    `,
  });

  document.getElementById('btnSubmitOrg')?.addEventListener('click', async () => {
    const form = document.getElementById('orgCreateForm');
    const errBox = document.getElementById('orgModalError');
    if (!form || !form.name.value.trim()) return;

    try {
      await api.createOrganization(form.name.value.trim());
      closeModal();
      onCreated();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
