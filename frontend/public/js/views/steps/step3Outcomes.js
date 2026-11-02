/**
 * Step 3: Outcomes & Financial Proxies: What Changed & Its Value?
 * Guided, beginner-friendly experience with progressive micro-steps.
 * Features a primary Dropdown for "การเปลี่ยนแปลงที่เกิดขึ้น" with an "อื่นๆ" button/text reveal.
 * Fully bilingual (Thai & English).
 */

import { getState, addOutcome, updateOutcome, removeOutcome } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { openProxyLibraryModal } from '../../components/proxyModal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { api } from '../../api.js';
import {
  groupByKey,
  stakeholderLabel,
  stakeholderOptionsHtml,
} from '../../utils/stakeholderGroups.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

let lastStakeholderId = null;

export const OUTCOME_PRESETS = [
  { id: 'income', th: 'มีรายได้เพิ่มขึ้น / ลดรายจ่ายในครัวเรือน', en: 'Increased Income / Cost Savings', polarity: 'positive', defaultProxy: 3500, unit: 'คน / เดือน' },
  { id: 'health', th: 'สุขภาพดีขึ้น / ป้องกันภาวะเจ็บป่วยและลดความเสี่ยงหกล้ม', en: 'Improved Health & Prevented Illness', polarity: 'positive', defaultProxy: 2500, unit: 'คน / ปี' },
  { id: 'skills', th: 'ได้รับความรู้และทักษะใหม่ นำไปประกอบอาชีพได้', en: 'New Professional Skills & Career Growth', polarity: 'positive', defaultProxy: 4000, unit: 'คน' },
  { id: 'time', th: 'ประหยัดเวลา / เพิ่มความสะดวกในการทำงาน', en: 'Time Saved & Daily Efficiency', polarity: 'positive', defaultProxy: 1500, unit: 'คน / ปี' },
  { id: 'env', th: 'สิ่งแวดล้อมดีขึ้น / ลดปริมาณขยะและมลพิษ', en: 'Environmental Quality & Waste Reduction', polarity: 'positive', defaultProxy: 1200, unit: 'ตัน / ปี' },
  { id: 'harm', th: 'มีภาระค่าใช้จ่ายหรือเวลาสูญเสียเพิ่มขึ้น (ผลกระทบทางลบ)', en: 'Increased Burden / Time Loss (Negative Impact)', polarity: 'negative', defaultProxy: 1000, unit: 'คน / ปี' },
  { id: '__other__', th: '✏️ อื่นๆ (ระบุเอง...)', en: '✏️ Other (Specify...)', polarity: 'positive', defaultProxy: null, unit: 'คน / ปี' },
];

export function renderStep3(container) {
  const { project, stakeholders, outcomes } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const stakeById = {};
  stakeholders.forEach((s) => (stakeById[s.id] = stakeholderLabel(s)));

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-lg);">
      <!-- Clean, Short Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-md);">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 3: ระบุผลลัพธ์และมูลค่าทางสังคม (Outcomes)' : 'Step 3: Outcomes & Valuation'}
          </h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            ${isTh ? 'ระบุการเปลี่ยนแปลงที่เกิดขึ้นจริงกับผู้คน และประเมินมูลค่าด้วยตัวแทนทางการเงิน' : 'Identify meaningful changes and assign monetary proxies.'}
          </p>
        </div>
        <button class="btn btn-primary" id="btnAddOutcome" style="font-weight: 600;">
          ${icons.plus} ${isTh ? '+ เพิ่มผลลัพธ์ใหม่' : '+ Build Outcome'}
        </button>
      </div>

      <!-- Collapsed Educational Guide -->
      <details class="card" style="padding: 0; border-left: 4px solid var(--positive);">
        <summary style="padding: var(--sp-md); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.125rem;">💡</span>
            <div>
              <strong style="color: var(--positive); font-size: 0.875rem;">
                ${isTh ? 'ทำความเข้าใจ: "กิจกรรม" แตกต่างจาก "ผลลัพธ์" อย่างไร? (คลิกเพื่อดูตัวอย่าง)' : 'Guide: Activity vs Output vs Outcome (Click to view)'}
              </strong>
            </div>
          </div>
          <span class="badge badge-planned" style="font-size: 0.6875rem;">${isTh ? 'ตัวอย่าง' : 'Examples'} ▼</span>
        </summary>
        <div style="padding: 0 var(--sp-md) var(--sp-md) var(--sp-md);">
          <table class="edu-compare-table" style="font-size: 0.8125rem;">
            <thead>
              <tr>
                <th>${isTh ? 'กิจกรรม (Activity)' : 'Activity'}</th>
                <th>${isTh ? 'ผลผลิต (Output)' : 'Output'}</th>
                <th>${isTh ? 'ผลลัพธ์ (Outcome) ★ วัด SROI' : 'Outcome ★ SROI Focus'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${isTh ? 'จัดฝึกอบรมทักษะอาชีพ 3 วัน' : '3-day workshop'}</td>
                <td>${isTh ? 'ผู้เข้าอบรม 120 คน' : '120 participants'}</td>
                <td style="color: var(--positive); font-weight: 600;">${isTh ? 'ผู้เข้าอบรมมีรายได้เพิ่มขึ้นเฉลี่ย ฿3,500/เดือน' : 'Participants earn ฿3,500/mo extra'}</td>
              </tr>
              <tr>
                <td>${isTh ? 'ตรวจคัดกรองสายตาผู้สูงอายุ' : 'Eye screening'}</td>
                <td>${isTh ? 'ตรวจผู้สูงอายุ 500 ราย' : '500 screened'}</td>
                <td style="color: var(--positive); font-weight: 600;">${isTh ? 'ป้องกันภาวะสูญเสียการมองเห็น และลดความเสี่ยงหกล้ม' : 'Prevented blindness & falls'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- Outcomes & Financial Proxies Registry Card -->
      <div class="card">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title" style="font-size: 1rem;">${t('outcome_registry_title', 'รายการผลลัพธ์และตัวแทนทางการเงิน (Outcome Registry)')}</h2>
            <p class="muted" style="font-size: 0.75rem; margin-bottom: 0;">
              ${isTh ? 'บันทึกการเปลี่ยนแปลงและมูลค่าเทียบเคียงทางการเงินของแต่ละผลลัพธ์' : 'Translate measured changes into defensible monetary proxies'}
            </p>
          </div>
          <span class="badge badge-planned">${outcomes.length} ${isTh ? 'ผลลัพธ์' : 'outcomes'}</span>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_outcome_name', 'ผลลัพธ์ / การเปลี่ยนแปลง')}</th>
                <th>${t('col_stakeholder_name', 'ผู้มีส่วนได้ส่วนเสีย')}</th>
                <th>${t('col_polarity', 'ลักษณะผล')}</th>
                <th class="num">${t('col_quantity', 'จำนวน')}</th>
                <th class="num">${t('col_outcome_proxy', 'ตัวแทนทางการเงิน (Proxy)')}</th>
                <th class="num">${t('col_gross_annual', 'มูลค่ารวมขั้นต้นต่อปี')}</th>
                <th>${t('col_evidence_quality', 'ความน่าเชื่อถือ')}</th>
                <th>${t('col_actions', 'จัดการ')}</th>
              </tr>
            </thead>
            <tbody>
              ${
                outcomes.length === 0
                  ? `<tr><td colspan="8" class="empty" style="padding: var(--sp-2xl); text-align: center;">
                      <div style="font-size: 1.5rem; margin-bottom: 6px;">✨</div>
                      <div class="strong" style="margin-bottom: 4px;">${isTh ? 'ยังไม่มีผลลัพธ์ที่บันทึกไว้' : 'No outcomes created yet'}</div>
                      <div class="muted" style="font-size: 0.8125rem; margin-bottom: 12px;">
                        ${isTh ? 'คลิกปุ่ม "+ เพิ่มผลลัพธ์ใหม่" เพื่อระบุการเปลี่ยนแปลงที่เกิดขึ้น' : 'Click "+ Build Outcome" to map your first change'}
                      </div>
                    </td></tr>`
                  : outcomes
                      .map((o) => {
                        const sign = o.polarity === 'negative' ? -1 : 1;
                        const gross =
                          o.proxy_value !== null ? o.quantity * o.proxy_value * sign : null;
                        const stkName =
                          stakeById[o.stakeholder_id] || `Stakeholder #${o.stakeholder_id}`;

                        return `
                  <tr data-id="${o.id}">
                    <td>
                      <div class="strong" style="font-size: 0.9375rem; color: var(--on-background);">${escapeHtml(o.name)}</div>
                      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                        ${o.activity ? `<span class="badge badge-integrated" style="font-size: 0.6875rem;">📁 ${escapeHtml(o.activity)}</span>` : ''}
                        ${o.indicator ? `<span class="muted" style="font-size: 0.75rem;">${t('col_outcome_indicator', 'ตัวชี้วัด')}: ${escapeHtml(o.indicator)}</span>` : ''}
                      </div>
                    </td>
                    <td>${escapeHtml(stkName)}</td>
                    <td>
                      <span class="polarity-badge ${o.polarity === 'negative' ? 'polarity-negative' : 'polarity-positive'}">
                        ${o.polarity === 'negative' ? t('polarity_negative', '- ผลเสีย') : t('polarity_positive', '+ ผลดี')}
                      </span>
                    </td>
                    <td class="num strong">${Number(o.quantity).toLocaleString()}</td>
                    <td class="num">
                      ${
                        o.proxy_value !== null
                          ? `${project.currency} ${formatBaht(o.proxy_value)} <span class="muted" style="font-size: 0.75rem;">/${escapeHtml(o.proxy_unit || '')}</span>`
                          : '<span class="muted">–</span>'
                      }
                    </td>
                    <td class="num strong" style="color: ${gross !== null && gross < 0 ? 'var(--negative)' : 'var(--positive)'}; font-size: 0.9375rem;">
                      ${gross !== null ? `${project.currency} ${formatBaht(gross)}` : '<span class="muted">–</span>'}
                    </td>
                    <td>
                      <span class="badge badge-planned" style="font-size: 0.6875rem;">${escapeHtml(o.evidence_quality || 'assumed')}</span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn-icon" data-edit-outcome="${o.id}" title="${t('edit', 'Edit')}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="btn-icon" data-evidence-outcome="${o.id}" title="${isTh ? 'แนบหลักฐาน (Evidence)' : 'Attach Evidence'}">
                          📎
                        </button>
                        <button class="btn-icon" data-remove-outcome="${o.id}" title="${t('delete', 'Delete')}">
                          ${icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(3, {
        canProceed: outcomes.length > 0,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ปรับปรุงผลกระทบส่วนเกิน (Step 4) →'
          : 'Continue: Impact Adjustments (Step 4) →',
      })}
    </div>`;

  document.getElementById('btnAddOutcome')?.addEventListener('click', () => {
    openOutcomeModal({
      project,
      stakeholders,
      onSaved: () => renderStep3(container),
    });
  });

  container.querySelectorAll('[data-edit-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.editOutcome);
      const target = outcomes.find((o) => o.id === oId);
      if (target)
        openOutcomeModal({
          project,
          stakeholders,
          initialData: target,
          onSaved: () => renderStep3(container),
        });
    });
  });

  container.querySelectorAll('[data-evidence-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.evidenceOutcome);
      const target = outcomes.find((o) => o.id === oId);
      if (target) {
        openEvidenceModal({
          project,
          outcome: target,
        });
      }
    });
  });

  container.querySelectorAll('[data-remove-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.removeOutcome);
      confirmModal({
        title: t('delete', 'Delete Outcome'),
        message: isTh
          ? 'คุณแน่ใจหรือไม่ว่าต้องการลบผลลัพธ์นี้? ข้อมูลการปรับปรุงผลกระทบที่เชื่อมโยงจะถูกลบไปด้วย'
          : 'Are you sure you want to delete this outcome and its adjustments?',
        onConfirm: async () => {
          await removeOutcome(oId);
          renderStep3(container);
        },
      });
    });
  });

  attachWizardFooterEvents(container);
}

/**
 * Progressive Micro-Step Outcome Builder Modal
 * Step 1: Who & What Changed? (Stakeholder + Outcome Dropdown with "อื่นๆ" reveal)
 * Step 2: Quantity & Financial Proxy Valuation
 */
function openOutcomeModal({ project, stakeholders, initialData = null, prefill = null, onSaved }) {
  const isEdit = !!initialData;
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const src = initialData || prefill;
  const period = project.analysis_period_years || 5;
  const startStk =
    src?.stakeholder_id ??
    (stakeholders.some((s) => s.id === lastStakeholderId)
      ? lastStakeholderId
      : stakeholders[0]?.id || null);
  const startCount = stakeholders.find((s) => s.id === startStk)?.estimated_count;

  // Determine if initial name matches any preset
  const matchedPreset = initialData
    ? OUTCOME_PRESETS.find((p) => p.th === initialData.name || p.en === initialData.name)
    : OUTCOME_PRESETS[0];
  const initialPresetVal = matchedPreset ? matchedPreset.id : (initialData ? '__other__' : OUTCOME_PRESETS[0].id);

  const formHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <!-- Step Indicator Bar -->
      <div style="display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--outline); padding-bottom: 12px; margin-bottom: 4px;">
        <span id="ocStepBadge1" class="badge badge-production" style="font-weight: 700; font-size: 0.8125rem; padding: 4px 10px;">
          1. ${isTh ? 'ใครและเกิดผลอะไร' : '1. Who & What Changed'}
        </span>
        <span class="muted" style="font-size: 0.75rem;">➔</span>
        <span id="ocStepBadge2" class="badge" style="background: var(--surface-soft); color: var(--muted); font-size: 0.8125rem; padding: 4px 10px;">
          2. ${isTh ? 'จำนวนและมูลค่าตัวแทน' : '2. Quantity & Value'}
        </span>
      </div>

      <form id="outcomeBuilderForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
        <!-- ==================== PANE 1: WHO & WHAT ==================== -->
        <div id="ocPane1" class="stack" style="gap: var(--sp-md);">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" style="font-weight: 700;">
                ${isTh ? 'ผู้มีส่วนได้ส่วนเสียที่เกิดการเปลี่ยนแปลง *' : 'Stakeholder Affected *'}
              </label>
              <select name="stakeholder_id" id="ocStakeholderSelect" class="input" required>
                ${stakeholderOptionsHtml(stakeholders, startStk, escapeHtml)}
              </select>
            </div>

            <div class="field">
              <label class="field-label" style="font-weight: 700;">
                ${isTh ? 'ลักษณะผลลัพธ์ *' : 'Polarity *'}
              </label>
              <select name="polarity" id="ocPolaritySelect" class="input">
                <option value="positive" ${src?.polarity !== 'negative' ? 'selected' : ''}>${isTh ? '＋ ผลประโยชน์เชิงบวก (Positive)' : '+ Positive Benefit'}</option>
                <option value="negative" ${src?.polarity === 'negative' ? 'selected' : ''}>${isTh ? '－ ผลกระทบทางลบ (Negative)' : '- Negative Harm / Cost'}</option>
              </select>
            </div>
          </div>

          <!-- Outcome Preset Dropdown with "อื่นๆ" button -->
          <div class="field">
            <label class="field-label" style="font-size: 0.9375rem; font-weight: 700; color: var(--on-background);">
              ${isTh ? 'การเปลี่ยนแปลงที่เกิดขึ้นคืออะไร? (ผลลัพธ์ที่ได้รับจริง) *' : 'What changed? (Meaningful Outcome) *'}
            </label>
            <div style="display: flex; gap: var(--sp-sm); align-items: center;">
              <select id="ocPresetSelect" class="input" style="flex: 1; font-size: 0.9375rem;">
                ${OUTCOME_PRESETS.map((p) => `
                  <option value="${p.id}" ${initialPresetVal === p.id ? 'selected' : ''}>
                    ${escapeHtml(isTh ? p.th : p.en)}
                  </option>
                `).join('')}
              </select>
              <button type="button" class="btn btn-secondary" id="btnPickOtherOutcome" style="font-size: 0.8125rem;">
                ✏️ ${isTh ? 'อื่นๆ' : 'Other'}
              </button>
            </div>
          </div>

          <!-- Custom Outcome Name (Reveals when "อื่นๆ" is active) -->
          <div id="customOutcomeRow" class="field" style="display: ${initialPresetVal === '__other__' ? 'grid' : 'none'};">
            <label class="field-label" style="color: var(--primary); font-weight: 600;">
              ${isTh ? 'ระบุการเปลี่ยนแปลงจริงที่เกิดขึ้น *' : 'Specify Outcome Name *'}
            </label>
            <input type="text" id="customOutcomeInput" name="name" class="input" value="${escapeHtml(src?.name || '')}" placeholder="${isTh ? 'เช่น ผู้สูงอายุเดินได้คล่องตัวขึ้น ลดการพึ่งพาผู้อื่น...' : 'e.g. Prevented vision loss...'}" />
          </div>

          <!-- Service / Activity Line (Optional) -->
          <div class="field">
            <label class="field-label" style="font-size: 0.8125rem;">${isTh ? 'กลุ่มบริการหรือกิจกรรม (Service / Activity Group)' : 'Service Line'}</label>
            <input type="text" name="activity" class="input" list="serviceGroupSuggestions" value="${escapeHtml(src?.activity || '')}" placeholder="${isTh ? 'เช่น ตรวจคัดกรองสุขภาพ, ธาราบำบัด, อบรมอาชีพ...' : 'e.g. Health screening, training...'}" />
            <datalist id="serviceGroupSuggestions">
              <option value="${isTh ? 'บริการตรวจคัดกรองสุขภาพฟรี' : 'Free health screening services'}"></option>
              <option value="${isTh ? 'บริการอาคารธาราบำบัด' : 'Hydrotherapy clinic services'}"></option>
              <option value="${isTh ? 'กิจกรรม Open House และประชาสัมพันธ์มหาวิทยาลัย' : 'Open House'}"></option>
              <option value="${isTh ? 'กิจกรรมบริการวิชาการและพัฒนาชุมชน' : 'Community engagement'}"></option>
              <option value="${isTh ? 'การฝึกทักษะและเสริมสร้างสมรรถนะนิสิต' : 'Student training'}"></option>
            </datalist>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: var(--sp-sm);">
            <button type="button" class="btn btn-primary" id="btnOcGotoPane2" style="padding: 10px 22px;">
              ${isTh ? 'ต่อไป (ระบุจำนวนและมูลค่า) ➔' : 'Next (Quantity & Valuation) ➔'}
            </button>
          </div>
        </div>

        <!-- ==================== PANE 2: QUANTITY & FINANCIAL PROXY ==================== -->
        <div id="ocPane2" class="stack" style="display: none; gap: var(--sp-md);">
          <div style="background: var(--surface-soft); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary); font-size: 0.875rem;">
            ${isTh ? 'ผลลัพธ์:' : 'Outcome:'} <strong id="pane2OutcomeLabel" style="color: var(--primary);"></strong>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label" style="font-weight: 700;">
                ${isTh ? 'จำนวนคนที่เกิดการเปลี่ยนแปลง (คน/หน่วย) *' : 'Quantity Experiencing Change *'}
              </label>
              <input type="number" name="quantity" min="0" step="1" class="input" value="${src?.quantity ?? startCount ?? ''}" required placeholder="เช่น 120" />
            </div>
            <div class="field">
              <label class="field-label">${isTh ? 'ตัวชี้วัด (Indicator)' : 'Indicator'}</label>
              <input type="text" name="indicator" class="input" value="${escapeHtml(src?.indicator || '')}" placeholder="${isTh ? 'เช่น แบบประเมินทักษะ, ผลตรวจ' : 'e.g. Assessment score'}" />
            </div>
          </div>

          <!-- Proxy Valuation -->
          <div class="card" style="padding: var(--sp-md); background: var(--surface-card); border: 1px solid var(--outline);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-sm);">
              <div>
                <strong style="font-size: 0.875rem; color: var(--primary);">
                  ${isTh ? 'มูลค่าตัวแทนทางการเงิน (Financial Proxy)' : 'Financial Proxy'}
                </strong>
                <p class="muted" style="font-size: 0.75rem; margin: 0;">${isTh ? 'มูลค่าเทียบเคียงในตลาดสำหรับประโยชน์นี้' : 'Market equivalent value'}</p>
              </div>
              <button type="button" class="btn btn-secondary" id="btnPickProxyFromLib" style="font-size: 0.75rem; height: 30px; padding: 0 10px;">
                📚 ${isTh ? 'เลือกจากคลังตัวแทน' : 'Proxy Library'}
              </button>
            </div>

            <div class="form-grid">
              <div class="field">
                <label class="field-label">${isTh ? 'มูลค่าต่อหน่วย (บาท) *' : 'Proxy Value *'} (${project.currency})</label>
                <input type="number" name="proxy_value" min="0" step="0.01" class="input" value="${src?.proxy_value ?? ''}" placeholder="2500" />
              </div>
              <div class="field">
                <label class="field-label">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
                <input type="text" name="proxy_unit" class="input" value="${escapeHtml(src?.proxy_unit || (isTh ? 'คน / ปี' : 'person / year'))}" placeholder="คน / ปี" />
              </div>
            </div>

            <div class="field" style="margin-top: var(--sp-sm);">
              <label class="field-label">${isTh ? 'แหล่งที่มาของมูลค่าอ้างอิง *' : 'Source / Citation *'}</label>
              <input type="text" name="proxy_source" class="input" value="${escapeHtml(src?.proxy_source || '')}" placeholder="${isTh ? 'เช่น อัตราค่าบริการ รพ.มหาวิทยาลัยนเรศวร, รายงาน SROI' : 'e.g. University hospital fee schedule'}" />
            </div>
          </div>

          <!-- Collapsible Advanced Settings -->
          <details class="in-more">
            <summary style="font-size: 0.8125rem; font-weight: 600; cursor: pointer; color: var(--muted);">
              ⚙️ ${isTh ? 'การตั้งค่าขั้นสูง (ระยะเวลา, รูปแบบความคงอยู่)' : 'Advanced (Duration, Persistence)'}
            </summary>
            <div class="form-grid" style="margin-top: var(--sp-sm);">
              <div class="field">
                <label class="field-label">${isTh ? 'คงอยู่กี่ปี? (Duration)' : 'Duration (Years)'}</label>
                <input type="number" name="duration_years" min="1" max="${period}" class="input" value="${src?.duration_years || 1}" />
              </div>
              <div class="field">
                <label class="field-label">${isTh ? 'รูปแบบความคงอยู่' : 'Model'}</label>
                <select name="projection_model" class="input">
                  <option value="cohort" ${src?.projection_model === 'cohort' ? 'selected' : ''}>Single Cohort</option>
                  <option value="recurring_cohorts" ${src?.projection_model === 'recurring_cohorts' ? 'selected' : ''}>Recurring Cohorts</option>
                  <option value="independent" ${src?.projection_model === 'independent' ? 'selected' : ''}>Independent</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">${isTh ? 'ความน่าเชื่อถือ' : 'Rigor'}</label>
                <select name="evidence_quality" class="input">
                  <option value="measured" ${src?.evidence_quality === 'measured' ? 'selected' : ''}>Measured</option>
                  <option value="external" ${src?.evidence_quality === 'external' ? 'selected' : ''}>External</option>
                  <option value="estimated" ${src?.evidence_quality === 'estimated' ? 'selected' : ''}>Estimated</option>
                  <option value="assumed" ${src?.evidence_quality === 'assumed' ? 'selected' : ''}>Assumed</option>
                </select>
              </div>
            </div>
          </details>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-sm);">
            <button type="button" class="btn btn-secondary" id="btnOcBackToPane1">
              ← ${isTh ? 'ย้อนกลับ' : 'Back'}
            </button>
            <button type="button" class="btn btn-primary" id="btnSaveOutcomeDirect">
              ✓ ${isEdit ? (isTh ? 'อัปเดตผลลัพธ์' : 'Update Outcome') : (isTh ? 'บันทึกผลลัพธ์' : 'Save Outcome')}
            </button>
          </div>
        </div>

        <div id="outcomeModalError" class="alert alert-danger" style="display: none;"></div>
      </form>
    </div>`;

  openModal({
    title: isEdit
      ? (isTh ? 'แก้ไขผลลัพธ์และตัวแทนทางการเงิน' : 'Edit Outcome')
      : (isTh ? 'เพิ่มผลลัพธ์และตัวแทนทางการเงิน (Build Outcome)' : 'Add New Outcome'),
    body: formHtml,
    size: 'lg',
  });

  const form = document.getElementById('outcomeBuilderForm');
  const errBox = document.getElementById('outcomeModalError');
  const pane1 = document.getElementById('ocPane1');
  const pane2 = document.getElementById('ocPane2');
  const badge1 = document.getElementById('ocStepBadge1');
  const badge2 = document.getElementById('ocStepBadge2');
  const ocPresetSelect = document.getElementById('ocPresetSelect');
  const btnPickOtherOutcome = document.getElementById('btnPickOtherOutcome');
  const customOutcomeRow = document.getElementById('customOutcomeRow');
  const customOutcomeInput = document.getElementById('customOutcomeInput');
  const pane2OutcomeLabel = document.getElementById('pane2OutcomeLabel');
  const ocPolaritySelect = document.getElementById('ocPolaritySelect');

  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ block: 'nearest' });
  };

  const getEffectiveOutcomeName = () => {
    if (ocPresetSelect.value === '__other__') {
      return customOutcomeInput.value.trim();
    }
    const found = OUTCOME_PRESETS.find(p => p.id === ocPresetSelect.value);
    return found ? (isTh ? found.th : found.en) : customOutcomeInput.value.trim();
  };

  const syncOutcomePresetUI = () => {
    const isOther = ocPresetSelect.value === '__other__';
    customOutcomeRow.style.display = isOther ? 'grid' : 'none';
    if (isOther) {
      customOutcomeInput.focus();
    } else {
      const found = OUTCOME_PRESETS.find(p => p.id === ocPresetSelect.value);
      if (found) {
        if (found.polarity) ocPolaritySelect.value = found.polarity;
        if (found.defaultProxy && !form.proxy_value.value) form.proxy_value.value = found.defaultProxy;
        if (found.unit) form.proxy_unit.value = found.unit;
      }
    }
  };

  ocPresetSelect.addEventListener('change', syncOutcomePresetUI);
  btnPickOtherOutcome.addEventListener('click', () => {
    ocPresetSelect.value = '__other__';
    syncOutcomePresetUI();
  });

  const goToPane = (paneNum) => {
    errBox.style.display = 'none';
    pane1.style.display = paneNum === 1 ? 'flex' : 'none';
    pane2.style.display = paneNum === 2 ? 'grid' : 'none';

    badge1.className = paneNum === 1 ? 'badge badge-production' : 'badge';
    badge1.style.background = paneNum === 1 ? '' : 'var(--surface-soft)';
    badge1.style.color = paneNum === 1 ? '' : 'var(--muted)';

    badge2.className = paneNum === 2 ? 'badge badge-production' : 'badge';
    badge2.style.background = paneNum === 2 ? '' : 'var(--surface-soft)';
    badge2.style.color = paneNum === 2 ? '' : 'var(--muted)';
  };

  document.getElementById('btnOcGotoPane2')?.addEventListener('click', () => {
    const name = getEffectiveOutcomeName();
    if (!name) {
      showErr(isTh ? 'กรุณาระบุชื่อผลลัพธ์' : 'Please specify an outcome name.');
      if (ocPresetSelect.value === '__other__') customOutcomeInput.focus();
      return;
    }
    pane2OutcomeLabel.textContent = name;
    goToPane(2);
  });

  document.getElementById('btnOcBackToPane1')?.addEventListener('click', () => goToPane(1));

  document.getElementById('btnPickProxyFromLib')?.addEventListener('click', () => {
    openProxyLibraryModal({
      onSelectProxy: (selectedProxy) => {
        if (form) {
          form.proxy_value.value = selectedProxy.value;
          form.proxy_unit.value = selectedProxy.unit;
          form.proxy_source.value = selectedProxy.source;
        }
      },
    });
  });

  const save = async () => {
    errBox.style.display = 'none';
    const name = getEffectiveOutcomeName();
    if (!name) {
      goToPane(1);
      showErr(isTh ? 'กรุณาระบุชื่อผลลัพธ์' : 'Please enter an outcome name.');
      return;
    }

    const proxyVal = form.proxy_value.value ? parseFloat(form.proxy_value.value) : null;
    const qty = parseFloat(form.quantity.value) || 0;

    const data = {
      name,
      activity: form.activity?.value.trim() || null,
      stakeholder_id: parseInt(form.stakeholder_id.value, 10),
      polarity: form.polarity.value,
      indicator: form.indicator.value.trim(),
      quantity: qty,
      proxy_value: proxyVal,
      proxy_unit: form.proxy_unit.value.trim(),
      proxy_source: form.proxy_source.value.trim(),
      duration_years: parseInt(form.duration_years.value, 10) || 1,
      projection_model: form.projection_model.value,
      evidence_quality: form.evidence_quality.value,
    };

    if (!data.stakeholder_id || form.quantity.value === '' || isNaN(qty)) {
      goToPane(2);
      showErr(isTh ? 'กรุณาระบุจำนวนคนที่เกิดการเปลี่ยนแปลง' : 'Please enter a valid quantity.');
      return;
    }

    try {
      if (isEdit) {
        await updateOutcome(initialData.id, data);
      } else {
        await addOutcome(data);
      }
      lastStakeholderId = data.stakeholder_id;
      closeModal();
      onSaved();
    } catch (err) {
      showErr(err.message);
    }
  };

  document.getElementById('btnSaveOutcomeDirect')?.addEventListener('click', save);
  form.addEventListener('submit', (e) => e.preventDefault());
}

function openEvidenceModal({ project, outcome }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const modalHtml = `
    <div class="stack" style="gap: var(--sp-md);">
      <p class="muted" style="font-size: 0.8125rem;">
        ${isTh ? `แนบเอกสาร หลักฐานการสำรวจ URL หรือรายงานวิจัยเพื่อยืนยันผลลัพธ์ "${escapeHtml(outcome.name)}"` : `Attach evidence sources, survey files, or URLs for "${escapeHtml(outcome.name)}"`}
      </p>

      <form id="addEvidenceForm" class="stack" style="gap: var(--sp-sm); background: var(--surface-soft); padding: var(--sp-md); border-radius: var(--radius-md);">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">${t('name', 'ชื่อเอกสาร / หลักฐาน')} *</label>
            <input type="text" name="title" class="input" required placeholder="${isTh ? 'เช่น แบบประเมินความพึงพอใจและทักษะ 2568' : 'e.g. Survey Results 2026'}" />
          </div>
          <div class="field">
            <label class="field-label">${isTh ? 'ประเภทหลักฐาน' : 'Kind'} *</label>
            <select name="kind" class="input">
              <option value="survey">${isTh ? 'ผลสำรวจ / แบบสอบถาม (Survey)' : 'Survey Findings'}</option>
              <option value="citation">${isTh ? 'รายงานวิจัย / วารสารวิชาการ (Citation)' : 'Academic / Research Citation'}</option>
              <option value="url">${isTh ? 'ลิงก์เว็บไซต์ / แหล่งข้อมูลออนไลน์ (URL)' : 'Web URL'}</option>
              <option value="internal">${isTh ? 'รายงานประเมินภายในหน่วยงาน (Internal Report)' : 'Internal Evaluation Report'}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'ลิงก์ / การอ้างอิงเอกสาร' : 'Reference / URL'}</label>
          <input type="text" name="reference" class="input" placeholder="e.g. https://journal.org/paper-123 or DOI" />
        </div>
        <div class="field">
          <label class="field-label">${t('description', 'คำอธิบายเพิ่มเติม')}</label>
          <textarea name="description" class="input" rows="2" placeholder="${isTh ? 'ระบุข้อค้นพบที่สำคัญ' : 'Key findings'}"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="btnSaveEvidence">${isTh ? 'บันทึกหลักฐาน' : 'Add Evidence'}</button>
        </div>
        <div id="evidenceError" class="alert alert-danger" style="display: none;"></div>
      </form>

      <div id="evidenceListContainer" style="margin-top: var(--sp-sm);">
        <div class="muted">${t('loading', 'Loading evidence...')}</div>
      </div>
    </div>
  `;

  openModal({
    title: isTh ? 'หลักฐานยืนยันผลลัพธ์ (Evidence)' : 'Outcome Evidence',
    body: modalHtml,
    size: 'lg',
  });

  const loadList = async () => {
    const box = document.getElementById('evidenceListContainer');
    if (!box) return;
    try {
      const res = await api.listEvidence(project.id, outcome.id);
      const list = res?.data || [];
      if (list.length === 0) {
        box.innerHTML = `<div class="muted" style="padding: 12px; background: var(--surface-soft); border-radius: var(--radius-sm);">${isTh ? 'ยังไม่มีหลักฐานแนบสำหรับผลลัพธ์นี้' : 'No evidence attached yet.'}</div>`;
        return;
      }
      box.innerHTML = `
        <div class="table-wrap">
          <table class="table" style="font-size: 0.8125rem;">
            <thead>
              <tr>
                <th>${t('name', 'ชื่อหลักฐาน')}</th>
                <th>${isTh ? 'ประเภท' : 'Type'}</th>
                <th>${isTh ? 'การอ้างอิง' : 'Ref'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map((ev) => `
                <tr>
                  <td class="strong">${escapeHtml(ev.title)}</td>
                  <td><span class="badge badge-planned">${escapeHtml(ev.kind)}</span></td>
                  <td>${ev.reference ? `<a href="${escapeHtml(ev.reference)}" target="_blank">${escapeHtml(ev.reference)}</a>` : '-'}</td>
                  <td>
                    <button class="btn-icon" data-del-evidence="${ev.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      box.querySelectorAll('[data-del-evidence]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api.deleteEvidence(project.id, outcome.id, Number(btn.dataset.delEvidence));
          loadList();
        });
      });
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  };

  loadList();

  document.getElementById('btnSaveEvidence')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const form = document.getElementById('addEvidenceForm');
    const errBox = document.getElementById('evidenceError');
    if (!form) return;
    if (errBox) errBox.style.display = 'none';

    const payload = {
      title: form.title.value.trim(),
      kind: form.kind.value,
      reference: form.reference.value.trim() || null,
      description: form.description.value.trim() || null,
    };
    if (!payload.title) {
      if (errBox) {
        errBox.textContent = isTh ? 'กรุณาระบุชื่อหลักฐาน' : 'Please enter title.';
        errBox.style.display = 'block';
      }
      return;
    }
    try {
      await api.createEvidence(project.id, outcome.id, payload);
      form.reset();
      loadList();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
