/**
 * Financial Proxy Library Search & Custom Proxy Modal
 * Fully bilingual (Thai & English)
 */

import { api } from '../api.js';
import { openModal, closeModal } from './modal.js';
import { formatBaht } from '../utils/format.js';
import { escapeHtml } from '../utils/html.js';
import { t } from '../i18n.js';

export function openProxyLibraryModal({ onSelectProxy, orgId = null }) {
  let categories = [
    'All Categories',
    'Education',
    'Employment and income',
    'Health and wellbeing',
    'Time savings',
    'Poverty reduction',
    'Environmental benefits',
    'Waste management',
    'Energy efficiency',
    'Community development',
  ];

  const modalHtml = `
    <div style="display: flex; gap: var(--sp-md); margin-bottom: var(--sp-md); flex-wrap: wrap;">
      <input type="text" class="input" id="proxySearchInput" placeholder="${t('proxy_search_ph', 'Search proxies (e.g. tutoring, health, waste, energy)...')}" style="flex: 1; min-width: min(220px, 100%);" />
      <select class="input" id="proxyCategorySelect" style="flex: 0 1 200px; min-width: 140px;">
        ${categories.map((c) => `<option value="${c === 'All Categories' ? '' : c}">${c === 'All Categories' ? t('proxy_all_cats', 'All Categories') : c}</option>`).join('')}
      </select>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-xs);">
      <span class="muted" style="font-size: 0.8125rem;" id="proxyCountLabel">${t('loading', 'Loading library...')}</span>
      <button class="btn btn-secondary" id="btnOpenCustomProxy" style="height: 32px; font-size: 0.75rem;">
        ${t('btn_create_custom_proxy', '+ Create Custom Proxy')}
      </button>
    </div>

    <div class="proxy-list" id="proxyListContainer">
      <div class="muted" style="padding: var(--sp-xl); text-align: center;">${t('loading', 'Loading proxies...')}</div>
    </div>
  `;

  openModal({
    title: t('proxy_lib_title', 'Financial Proxy Library'),
    body: modalHtml,
    size: 'lg',
  });

  const listContainer = document.getElementById('proxyListContainer');
  const countLabel = document.getElementById('proxyCountLabel');
  const searchInput = document.getElementById('proxySearchInput');
  const categorySelect = document.getElementById('proxyCategorySelect');
  const btnCustom = document.getElementById('btnOpenCustomProxy');

  let currentProxies = [];

  const loadProxies = async () => {
    try {
      const q = searchInput?.value.trim() || '';
      const cat = categorySelect?.value || '';
      const res = await api.getProxies(cat, q);
      currentProxies = res?.data || [];

      countLabel.textContent = `${currentProxies.length} ${t('proxies_count_avail', 'proxies available')}`;

      if (currentProxies.length === 0) {
        listContainer.innerHTML = `
          <div style="padding: var(--sp-xl); text-align: center; color: var(--muted);">
            ${t('no_data', 'No matching proxies found. You can create a custom proxy with your evidence.')}
          </div>
        `;
        return;
      }

      listContainer.innerHTML = currentProxies
        .map(
          (p) => `
        <div class="proxy-item" data-id="${p.id}">
          <div class="proxy-item-info">
            <span class="proxy-item-name">${escapeHtml(p.name)} <span class="badge badge-planned" style="font-size: 0.6875rem;">${escapeHtml(p.category)}</span></span>
            <span class="proxy-item-source">${t('unit', 'Unit')}: ${escapeHtml(p.unit)} | Source: ${escapeHtml(p.source || 'Standard Reference')}</span>
            ${p.definition ? `<span class="muted" style="font-size: 0.75rem;">${escapeHtml(p.definition)}</span>` : ''}
          </div>
          <div style="text-align: right;">
            <div class="proxy-item-val">${p.currency} ${formatBaht(p.value)}</div>
            <button class="btn btn-primary" style="height: 28px; font-size: 0.75rem; margin-top: 4px;">${t('btn_select_proxy', 'Select')}</button>
          </div>
        </div>
      `,
        )
        .join('');
    } catch (err) {
      listContainer.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchInput._timer);
    searchInput._timer = setTimeout(loadProxies, 300);
  });

  categorySelect?.addEventListener('change', loadProxies);

  listContainer?.addEventListener('click', (e) => {
    const item = e.target.closest('.proxy-item');
    if (!item) return;
    const proxyId = Number(item.dataset.id);
    const selected = currentProxies.find((p) => p.id === proxyId);
    if (selected) {
      closeModal();
      onSelectProxy(selected);
    }
  });

  btnCustom?.addEventListener('click', () => {
    openCustomProxyModal({
      orgId,
      onCreated: (newProxy) => {
        closeModal();
        onSelectProxy(newProxy);
      },
    });
  });

  loadProxies();
}

export function openCustomProxyModal({ orgId, onCreated }) {
  const formHtml = `
    <form id="customProxyForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">${t('field_proxy_name', 'Proxy Name')} *</label>
        <input type="text" name="name" class="input" required placeholder="e.g. Reduction in supplementary tutoring fees" />
      </div>
      <div class="field">
        <label class="field-label">${t('field_proxy_category', 'Category')} *</label>
        <select name="category" class="input" required>
          <option value="Education">Education</option>
          <option value="Employment and income">Employment and income</option>
          <option value="Health and wellbeing">Health and wellbeing</option>
          <option value="Time savings">Time savings</option>
          <option value="Poverty reduction">Poverty reduction</option>
          <option value="Environmental benefits">Environmental benefits</option>
          <option value="Waste management">Waste management</option>
          <option value="Community development">Community development</option>
        </select>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${t('field_proxy_value', 'Monetary Value')} *</label>
          <input type="number" name="value" step="0.01" min="0" class="input" required placeholder="2000" />
        </div>
        <div class="field">
          <label class="field-label">${t('field_proxy_unit', 'Unit of Measure')} *</label>
          <input type="text" name="unit" class="input" required placeholder="${t('field_proxy_unit_ph', 'e.g. THB/person/year')}" />
        </div>
        <div class="field">
          <label class="field-label">${t('field_currency', 'Currency')}</label>
          <input type="text" name="currency" class="input" value="THB" maxlength="3" required />
        </div>
      </div>
      <div class="field">
        <label class="field-label">${t('field_proxy_source', 'Evidence Source / Citation')} *</label>
        <input type="text" name="source" class="input" required placeholder="e.g. National Educational Survey, 2026" />
      </div>
      <div class="field">
        <label class="field-label">${t('field_proxy_def', 'Definition / Limitations')}</label>
        <textarea name="definition" class="input" rows="2" placeholder="Explain what this monetary figure represents and its limits"></textarea>
      </div>
      <div id="customProxyError" style="display: none;" class="alert alert-danger"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    <button class="btn btn-primary" id="btnSaveCustomProxy">${t('save', 'Save & Select Proxy')}</button>
  `;

  openModal({
    title: t('modal_custom_proxy_title', 'Create Custom Financial Proxy'),
    body: formHtml,
    footer,
  });

  document.getElementById('btnSaveCustomProxy')?.addEventListener('click', async () => {
    const form = document.getElementById('customProxyForm');
    const errBox = document.getElementById('customProxyError');
    if (!form) return;

    const data = {
      name: form.name.value.trim(),
      category: form.category.value,
      value: Number(form.value.value),
      unit: form.unit.value.trim(),
      currency: form.currency.value.trim().toUpperCase(),
      source: form.source.value.trim(),
      definition: form.definition.value.trim(),
    };

    if (!data.name || isNaN(data.value) || !data.unit || !data.source) {
      if (errBox) {
        errBox.textContent = t('required', 'Please fill in all required fields.');
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      let created;
      if (orgId) {
        created = await api.createOrgProxy(orgId, data);
      } else {
        // Fallback: proxy object directly usable in outcome
        created = { data: { ...data, id: Date.now() } };
      }
      closeModal();
      onCreated(created?.data || data);
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
