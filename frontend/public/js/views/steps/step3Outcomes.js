/**
 * Step 3: Outcomes & Financial Proxies: What Changed & Its Value?
 * Clean university standard, calm and uncluttered UI.
 * Progressive disclosure in modal:
 *  1) Who changes? (stakeholder dropdown)
 *  2) What changes? (outcome name + Positive/Negative toggle + quantity)
 *  3) How do we measure it? (indicator)
 *  4) Value per unit (plain proxy explanation, value, unit dropdown + Other, source)
 *  5) Collapsed Advanced: duration, model, reliability.
 * List shows 5 columns: Outcome, Stakeholder, Type (+/- pill), Annual value, Actions.
 * Details expand in an accordion row.
 */

import { getState, addOutcome, updateOutcome, removeOutcome } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { openProxyLibraryModal } from '../../components/proxyModal.js';
import { formatBaht, displayUnit } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
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
  { id: '__other__', th: 'อื่น ๆ (ระบุเอง...)', en: 'Other (specify...)', polarity: 'positive', defaultProxy: null, unit: 'คน / ปี' },
];

export const PROXY_UNIT_SUGGESTIONS = [
  'คน / ปี',
  'คน / เดือน',
  'คน',
  'ครัวเรือน / ปี',
  'แห่ง / ปี',
  'ตัน / ปี',
];

export function renderStep3(container) {
  const { project, stakeholders, outcomes } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__text">${t('alert_select_project_first', 'Please select or create a project first.')}</p></div>`;
    return;
  }

  const stakeById = {};
  stakeholders.forEach((s) => (stakeById[s.id] = stakeholderLabel(s)));

  container.innerHTML = `
    <div class="stack-md">
      <header class="page-head">
        <div>
          <h1 class="page-head__title">
            ${isTh ? 'ขั้นตอนที่ 3: ระบุผลลัพธ์และมูลค่าทางสังคม (Outcomes)' : 'Step 3: Outcomes & Valuation'}
          </h1>
          <p class="page-head__sub">
            ${isTh ? 'ระบุการเปลี่ยนแปลงที่เกิดขึ้นจริงกับผู้คน และประเมินมูลค่าด้วยตัวแทนทางการเงิน' : 'Identify meaningful changes and assign monetary proxies.'}
          </p>
        </div>
        <div class="page-head__actions">
          <button type="button" class="btn btn-primary" id="btnAddOutcome">
            ${icons.plus} ${isTh ? 'เพิ่มผลลัพธ์ใหม่' : 'Build Outcome'}
          </button>
        </div>
      </header>

      <!-- Collapsed Educational Guide -->
      <details class="disclosure">
        <summary class="disclosure__summary">
          ${isTh ? 'ทำความเข้าใจ: "กิจกรรม" แตกต่างจาก "ผลลัพธ์" อย่างไร? (คลิกเพื่อดูตัวอย่าง)' : 'Guide: Activity vs Output vs Outcome (Click to view)'}
        </summary>
        <div class="stack-sm muted-sm">
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>${isTh ? 'กิจกรรม (Activity)' : 'Activity'}</th>
                  <th>${isTh ? 'ผลผลิต (Output)' : 'Output'}</th>
                  <th>${isTh ? 'ผลลัพธ์ (Outcome) วัด SROI' : 'Outcome (SROI Focus)'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${isTh ? 'จัดฝึกอบรมทักษะอาชีพ 3 วัน' : '3-day workshop'}</td>
                  <td>${isTh ? 'ผู้เข้าอบรม 120 คน' : '120 participants'}</td>
                  <td class="strong" class="val--positive">${isTh ? 'ผู้เข้าอบรมมีรายได้เพิ่มขึ้นเฉลี่ย ฿3,500/เดือน' : 'Participants earn ฿3,500/mo extra'}</td>
                </tr>
                <tr>
                  <td>${isTh ? 'ตรวจคัดกรองสายตาผู้สูงอายุ' : 'Eye screening'}</td>
                  <td>${isTh ? 'ตรวจผู้สูงอายุ 500 ราย' : '500 screened'}</td>
                  <td class="strong" class="val--positive">${isTh ? 'ป้องกันภาวะสูญเสียการมองเห็น และลดความเสี่ยงหกล้ม' : 'Prevented blindness & falls'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <!-- Outcomes & Financial Proxies List -->
      <section class="panel">
        <div class="page-head">
          <div>
            <h2 class="panel__title">${isTh ? 'ผลลัพธ์และมูลค่าทางสังคม' : 'Outcomes and their value'}</h2>
            <p class="muted-sm">
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
                <th class="num">${t('col_gross_annual', 'มูลค่ารวมขั้นต้นต่อปี')}</th>
                <th><span class="sr-only">${t('col_actions', 'จัดการ')}</span></th>
              </tr>
            </thead>
            <tbody>
              ${
                outcomes.length === 0
                  ? `<tr><td colspan="5" class="empty">
                      <div class="empty-state">
                        <h3 class="empty-state__title">${isTh ? 'ยังไม่มีผลลัพธ์ที่บันทึกไว้' : 'No outcomes created yet'}</h3>
                        <p class="empty-state__text">${isTh ? 'คลิกปุ่ม "+ เพิ่มผลลัพธ์ใหม่" เพื่อระบุการเปลี่ยนแปลงที่เกิดขึ้น' : 'Click "+ Build Outcome" to map your first change.'}</p>
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
                      <div class="strong">${escapeHtml(o.name)}</div>
                      ${o.activity ? `<span class="badge badge-integrated" class="badge--xs">${escapeHtml(o.activity)}</span>` : ''}
                    </td>
                    <td>${escapeHtml(stkName)}</td>
                    <td>
                      <span class="status ${o.polarity === 'negative' ? 'status--warn' : 'status--ok'}">
                        ${o.polarity === 'negative' ? t('polarity_negative', '- ผลกระทบทางลบ') : t('polarity_positive', '+ ผลเชิงบวก')}
                      </span>
                    </td>
                    <td class="num strong ${gross !== null && gross < 0 ? 'val--negative' : 'val--positive'}">
                      ${gross !== null ? `${project.currency} ${formatBaht(gross)}` : '<span class="muted-sm">–</span>'}
                    </td>
                    <td>
                      <div class="row-actions">
                        <button type="button" class="btn-icon" data-toggle-oc="${o.id}" title="${t('view_details', 'Details')}" aria-expanded="false">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <button type="button" class="btn-icon" data-edit-outcome="${o.id}" title="${t('edit', 'Edit')}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button type="button" class="btn-icon" data-evidence-outcome="${o.id}" title="${isTh ? 'แนบหลักฐาน' : 'Attach Evidence'}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <button type="button" class="btn-icon" data-remove-outcome="${o.id}" title="${t('delete', 'Delete')}">
                          ${icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr class="oc-detail-row" id="ocDetail-${o.id}" hidden>
                    <td colspan="5">
                      <div class="panel panel--soft stack-sm">
                        <div class="form-row">
                          <div>
                            <span class="muted-sm">${t('col_outcome_indicator', 'ตัวชี้วัด')}:</span>
                            <strong>${escapeHtml(o.indicator || '-')}</strong>
                          </div>
                          <div>
                            <span class="muted-sm">${t('col_quantity', 'จำนวนประชากร')}:</span>
                            <strong>${Number(o.quantity).toLocaleString()}</strong>
                          </div>
                        </div>
                        <div class="form-row">
                          <div>
                            <span class="muted-sm">${t('col_outcome_proxy', 'ตัวแทนทางการเงิน (Proxy)')}:</span>
                            <strong>${o.proxy_value !== null ? `${project.currency} ${formatBaht(o.proxy_value)} / ${escapeHtml(displayUnit(o.proxy_unit))}` : '-'}</strong>
                            ${o.proxy_rationale ? `<div class="muted-sm">${isTh ? 'แนวทางการคำนวณ' : 'Calculation'}: ${escapeHtml(o.proxy_rationale)}</div>` : ''}
                            ${o.proxy_source ? `<div class="muted-sm">${escapeHtml(o.proxy_source)}</div>` : ''}
                          </div>
                          <div>
                            <span class="muted-sm">${t('col_evidence_quality', 'ความน่าเชื่อถือ')}:</span>
                            <span class="badge badge-planned">${escapeHtml(o.evidence_quality || 'assumed')}</span>
                            <div class="muted-sm">${o.duration_years || 1} ${isTh ? 'ปี' : 'years'} (${escapeHtml(o.projection_model || 'cohort')})</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>

      ${wizardFooterHtml(3, {
        canProceed: outcomes.length > 0,
        nextLabel: isTh
          ? 'บันทึกและดำเนินการต่อ: การปรับปรุงผลกระทบ (Step 4) →'
          : 'Continue: Impact Adjustments (Step 4) →',
      })}
    </div>`;

  const refresh = () => renderStep3(container);

  // Toggle details accordion row
  container.querySelectorAll('[data-toggle-oc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleOc;
      const detailRow = document.getElementById(`ocDetail-${id}`);
      if (!detailRow) return;
      const isOpen = !detailRow.hidden;
      detailRow.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.style.transform = isOpen ? 'none' : 'rotate(180deg)';
    });
  });

  document.getElementById('btnAddOutcome')?.addEventListener('click', () => {
    openOutcomeModal({ onSaved: refresh });
  });

  container.querySelectorAll('[data-edit-outcome]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const target = outcomes.find((o) => o.id === Number(btn.dataset.editOutcome));
      if (target) openOutcomeModal({ initialData: target, onSaved: refresh });
    }),
  );

  container.querySelectorAll('[data-evidence-outcome]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const target = outcomes.find((o) => o.id === Number(btn.dataset.evidenceOutcome));
      if (target) openEvidenceModal({ project, outcome: target });
    }),
  );

  container.querySelectorAll('[data-remove-outcome]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const oId = Number(btn.dataset.removeOutcome);
      confirmModal({
        title: t('delete', 'Delete'),
        message: t(
          'confirm_delete_outcome',
          'Are you sure you want to delete this outcome? Associated adjustments will be removed.',
        ),
        onConfirm: async () => {
          try {
            await removeOutcome(oId);
            refresh();
          } catch (err) {
            showToast(`${t('cannot_delete', 'Cannot delete')}: ${err.message}`, 'error');
          }
        },
      });
    }),
  );

  attachWizardFooterEvents(container);
}

/**
 * Step 3 Outcome Form Modal:
 * Guided flow in same modal, revealing each part only after previous required field is filled:
 * 1) Who changes? (stakeholder dropdown)
 * 2) What changes? (outcome name + Positive/Negative toggle + quantity)
 * 3) How do we measure it? (indicator)
 * 4) Value per unit: one-line plain explanation of "proxy", then proxy value, unit dropdown (+Other), source
 * 5) Collapsed "Advanced": duration, model, reliability.
 */
function openOutcomeModal({ initialData = null, onSaved }) {
  const { project, stakeholders } = getState();
  const isEdit = !!initialData;
  const src = initialData;
  const period = project.analysis_period_years || 5;
  const lang = getLanguage();
  const isTh = lang !== 'en';

  let startStk = src?.stakeholder_id || lastStakeholderId || (stakeholders.length ? stakeholders[0].id : '');
  let startCount = null;
  if (startStk) {
    const stkObj = stakeholders.find((s) => s.id === Number(startStk));
    if (stkObj && stkObj.estimated_count) startCount = stkObj.estimated_count;
  }

  const matchedPreset = src
    ? OUTCOME_PRESETS.find((p) => p.th === src.name || p.en === src.name)
    : null;
  const initialPresetVal = matchedPreset ? matchedPreset.id : (src ? '__other__' : '');

  const formHtml = `
    <form id="outcomeBuilderForm" class="form-stack" autocomplete="off" novalidate>
      <!-- Part 1: Who changes? -->
      <div class="field" id="ocPart1">
        <label class="field-label" for="ocStakeholderSelect">
          1. ${isTh ? 'ผู้ใดเป็นผู้ที่เกิดการเปลี่ยนแปลง?' : 'Who experiences the change?'}
          <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
        </label>
        <select name="stakeholder_id" id="ocStakeholderSelect" class="input" required>
          <option value="">${isTh ? '— เลือกผู้มีส่วนได้ส่วนเสีย —' : '— Select a stakeholder —'}</option>
          ${stakeholderOptionsHtml(stakeholders, startStk, escapeHtml)}
        </select>
      </div>

      <!-- Part 2: What changes? (Revealed once stakeholder is chosen) -->
      <div id="ocPart2" class="form-stack" ${startStk ? '' : 'hidden'}>
        <div class="form-row">
          <div class="field">
            <label class="field-label" for="ocPresetSelect">
              2. ${isTh ? 'การเปลี่ยนแปลงที่เกิดขึ้นคืออะไร?' : 'What is the change / outcome?'}
              <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <select id="ocPresetSelect" class="input">
              <option value="">${isTh ? '— เลือกประเภทผลลัพธ์ —' : '— Select outcome preset —'}</option>
              ${OUTCOME_PRESETS.map((p) => `
                <option value="${p.id}" ${initialPresetVal === p.id ? 'selected' : ''}>
                  ${escapeHtml(isTh ? p.th : p.en)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="ocPolaritySelect">
              ${isTh ? 'ลักษณะผลลัพธ์' : 'Polarity'}
              <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <select name="polarity" id="ocPolaritySelect" class="input">
              <option value="positive" ${src?.polarity !== 'negative' ? 'selected' : ''}>${isTh ? '+ ผลเชิงบวก (Positive Benefit)' : '+ Positive Benefit'}</option>
              <option value="negative" ${src?.polarity === 'negative' ? 'selected' : ''}>${isTh ? '- ผลกระทบทางลบ (Negative Harm)' : '- Negative Harm / Cost'}</option>
            </select>
          </div>
        </div>

        <div id="customOutcomeRow" class="field" ${initialPresetVal === '__other__' ? '' : 'hidden'}>
          <label class="field-label" for="customOutcomeInput">
            ${isTh ? 'ระบุชื่อผลลัพธ์ที่เกิดขึ้น' : 'Specify Outcome Name'}
            <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
          </label>
          <input type="text" id="customOutcomeInput" name="name" class="input" value="${escapeHtml(src?.name || '')}" placeholder="${isTh ? 'เช่น ผู้สูงอายุเดินได้คล่องตัวขึ้น ลดการพึ่งพาผู้อื่น...' : 'e.g. Prevented vision loss...'}" />
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="ocQuantity">
              ${isTh ? 'จำนวนคนที่เกิดการเปลี่ยนแปลง' : 'Number of people affected'}
              <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <input type="number" id="ocQuantity" name="quantity" min="0" step="1" class="input" value="${src?.quantity ?? startCount ?? ''}" placeholder="${isTh ? 'เช่น 120' : 'e.g. 120'}" />
          </div>

          <div class="field">
            <label class="field-label" for="ocActivity">${isTh ? 'กลุ่มบริการหรือกิจกรรม (ไม่บังคับ)' : 'Service Line (Optional)'}</label>
            <input type="text" id="ocActivity" name="activity" class="input" value="${escapeHtml(src?.activity || '')}" placeholder="${isTh ? 'เช่น ตรวจคัดกรองสุขภาพ, อบรมอาชีพ' : 'e.g. Health screening'}" />
          </div>
        </div>
      </div>

      <!-- Part 3: How do we measure it? (Revealed once outcome name is given) -->
      <div id="ocPart3" class="form-stack" ${src?.name || initialPresetVal ? '' : 'hidden'}>
        <div class="field">
          <label class="field-label" for="ocIndicator">
            3. ${isTh ? 'วัดผลได้อย่างไร? (ตัวชี้วัด / Indicator)' : 'How do we measure it? (Indicator)'}
            <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
          </label>
          <input type="text" id="ocIndicator" name="indicator" class="input" value="${escapeHtml(src?.indicator || '')}" placeholder="${isTh ? 'เช่น แบบประเมินทักษะ, จำนวนผู้ที่ผ่านเกณฑ์, ผลตรวจสายตา' : 'e.g. Skill assessment score, screening test result'}" />
        </div>
      </div>

      <!-- Part 4: Value per unit (Proxy) (Revealed once indicator is given) -->
      <div id="ocPart4" class="form-stack" ${src?.indicator ? '' : 'hidden'}>
        <div class="panel panel--soft stack-sm">
          <div class="cluster cluster--space-between">
            <div>
              <strong class="field-hint--primary">
                4. ${isTh ? 'มูลค่าต่อหน่วย (ตัวแทนทางการเงิน / Financial Proxy)' : '4. Value per Unit (Financial Proxy)'}
              </strong>
              <p class="field-hint">
                ${isTh ? 'ตัวแทนทางการเงินคือมูลค่าเทียบเคียงในตลาดหรือต้นทุนที่ประหยัดได้ต่อ 1 หน่วยของผลลัพธ์' : 'A financial proxy is the market equivalent value or cost avoided per 1 unit of this outcome.'}
              </p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnPickProxyFromLib">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <span>${isTh ? 'เลือกจากคลังตัวแทน' : 'Proxy Library'}</span>
            </button>
          </div>

          <div class="form-row">
            <div class="field">
              <label class="field-label" for="ocProxyValue">
                ${isTh ? 'มูลค่าต่อหน่วย' : 'Value per unit'} (${escapeHtml(project.currency)})
                <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
              </label>
              <input type="number" id="ocProxyValue" name="proxy_value" min="0" step="0.01" class="input" value="${src?.proxy_value ?? ''}" placeholder="2500" />
            </div>

            <div class="field">
              <label class="field-label" for="ocProxyUnitSelect">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
              <select id="ocProxyUnitSelect" class="input">
                ${[...PROXY_UNIT_SUGGESTIONS, '__other__'].map((u) => `
                  <option value="${u}" ${(src?.proxy_unit === u || (!src?.proxy_unit && u === 'คน / ปี')) ? 'selected' : ''}>
                    ${u === '__other__' ? (isTh ? 'อื่น ๆ (ระบุ)' : 'Other (specify)') : displayUnit(u)}
                  </option>
                `).join('')}
              </select>
              <div id="customProxyUnitRow" class="stack-xs" ${src?.proxy_unit && !PROXY_UNIT_SUGGESTIONS.includes(src.proxy_unit) ? '' : 'hidden'}>
                <input class="input" name="proxy_unit" id="customProxyUnitInput" value="${escapeHtml(src?.proxy_unit || (isTh ? 'คน / ปี' : 'person / year'))}" placeholder="${isTh ? 'ระบุหน่วยนับ' : 'Specify unit'}" />
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="ocProxyRationale">
              ${isTh ? 'แนวทางการคำนวณมูลค่า' : 'How the value was calculated'}
            </label>
            <input type="text" id="ocProxyRationale" name="proxy_rationale" class="input" maxlength="2000" value="${escapeHtml(src?.proxy_rationale || '')}" placeholder="${isTh ? 'เช่น ค่ารักษาเฉลี่ยต่อครั้ง × จำนวนครั้งที่ลดลงต่อปี' : 'e.g. average cost per visit × visits avoided per year'}" />
          </div>

          <div class="field">
            <label class="field-label" for="ocProxySource">
              ${isTh ? 'แหล่งที่มาของมูลค่าอ้างอิง' : 'Source / Citation'}
              <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
            </label>
            <input type="text" id="ocProxySource" name="proxy_source" class="input" value="${escapeHtml(src?.proxy_source || '')}" placeholder="${isTh ? 'เช่น อัตราค่าบริการ รพ.มหาวิทยาลัยนเรศวร, รายงาน SROI' : 'e.g. University hospital fee schedule, research citation'}" />
          </div>
        </div>

        <!-- Part 5: Collapsed Advanced disclosure -->
        <details class="disclosure" id="ocAdvancedDetails">
          <summary class="disclosure__summary">
            ${isTh ? '5. การตั้งค่าขั้นสูง (ระยะเวลาและรูปแบบความคงอยู่)' : '5. Advanced (Duration, Persistence & Rigor)'}
          </summary>
          <div class="form-stack">
            <div class="form-row">
              <div class="field">
                <label class="field-label" for="ocDuration">${isTh ? 'คงอยู่กี่ปี? (Duration)' : 'Duration (Years)'}</label>
                <input type="number" id="ocDuration" name="duration_years" min="1" max="${period}" class="input" value="${src?.duration_years || 1}" />
              </div>
              <div class="field">
                <label class="field-label" for="ocModel">${isTh ? 'รูปแบบความคงอยู่' : 'Model'}</label>
                <select id="ocModel" name="projection_model" class="input">
                  <option value="cohort" ${src?.projection_model === 'cohort' ? 'selected' : ''}>Single Cohort</option>
                  <option value="recurring_cohorts" ${src?.projection_model === 'recurring_cohorts' ? 'selected' : ''}>Recurring Cohorts</option>
                  <option value="independent" ${src?.projection_model === 'independent' ? 'selected' : ''}>Independent</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="ocRigor">${isTh ? 'ระดับความน่าเชื่อถือ' : 'Evidence Rigor'}</label>
              <select id="ocRigor" name="evidence_quality" class="input">
                <option value="measured" ${src?.evidence_quality === 'measured' ? 'selected' : ''}>Measured</option>
                <option value="external" ${src?.evidence_quality === 'external' ? 'selected' : ''}>External</option>
                <option value="estimated" ${src?.evidence_quality === 'estimated' ? 'selected' : ''}>Estimated</option>
                <option value="assumed" ${src?.evidence_quality === 'assumed' ? 'selected' : ''}>Assumed</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <div id="outcomeModalError" class="field-error" hidden></div>
    </form>`;

  openModal({
    title: isEdit
      ? (isTh ? 'แก้ไขผลลัพธ์และตัวแทนทางการเงิน' : 'Edit Outcome')
      : (isTh ? 'เพิ่มผลลัพธ์และตัวแทนทางการเงิน' : 'Add New Outcome'),
    body: formHtml,
    size: 'lg',
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button type="button" class="btn btn-primary" id="btnSaveOutcomeDirect" disabled>
        ${isEdit ? (isTh ? 'อัปเดตผลลัพธ์' : 'Update Outcome') : (isTh ? 'บันทึกผลลัพธ์' : 'Save Outcome')}
      </button>
    `,
  });

  const form = document.getElementById('outcomeBuilderForm');
  const errBox = document.getElementById('outcomeModalError');
  const ocStakeholderSelect = document.getElementById('ocStakeholderSelect');
  const ocPart2 = document.getElementById('ocPart2');
  const ocPart3 = document.getElementById('ocPart3');
  const ocPart4 = document.getElementById('ocPart4');
  const ocPresetSelect = document.getElementById('ocPresetSelect');
  const customOutcomeRow = document.getElementById('customOutcomeRow');
  const customOutcomeInput = document.getElementById('customOutcomeInput');
  const ocPolaritySelect = document.getElementById('ocPolaritySelect');
  const ocQuantity = document.getElementById('ocQuantity');
  const ocIndicator = document.getElementById('ocIndicator');
  const ocProxyValue = document.getElementById('ocProxyValue');
  const ocProxyUnitSelect = document.getElementById('ocProxyUnitSelect');
  const customProxyUnitRow = document.getElementById('customProxyUnitRow');
  const customProxyUnitInput = document.getElementById('customProxyUnitInput');
  const ocProxySource = document.getElementById('ocProxySource');
  const btnSave = document.getElementById('btnSaveOutcomeDirect');

  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
  };

  const getEffectiveOutcomeName = () => {
    if (ocPresetSelect.value === '__other__') {
      return customOutcomeInput.value.trim();
    }
    const found = OUTCOME_PRESETS.find((p) => p.id === ocPresetSelect.value);
    return found ? (isTh ? found.th : found.en) : customOutcomeInput.value.trim();
  };

  const syncOutcomePresetUI = () => {
    const isOther = ocPresetSelect.value === '__other__';
    customOutcomeRow.hidden = !(isOther);
    if (isOther) {
      customOutcomeInput.focus();
    } else {
      const found = OUTCOME_PRESETS.find((p) => p.id === ocPresetSelect.value);
      if (found) {
        if (found.polarity) ocPolaritySelect.value = found.polarity;
        if (found.defaultProxy && !ocProxyValue.value) ocProxyValue.value = found.defaultProxy;
        if (found.unit) {
          if (PROXY_UNIT_SUGGESTIONS.includes(found.unit)) {
            ocProxyUnitSelect.value = found.unit;
            customProxyUnitRow.hidden = true;
          } else {
            ocProxyUnitSelect.value = '__other__';
            customProxyUnitRow.hidden = false;
            customProxyUnitInput.value = found.unit;
          }
        }
      }
    }
    checkVisibilityAndValidity();
  };

  const checkVisibilityAndValidity = () => {
    const hasStk = !!ocStakeholderSelect.value;
    ocPart2.hidden = !(hasStk);

    const outcomeName = getEffectiveOutcomeName();
    ocPart3.hidden = !((hasStk && outcomeName));

    const hasIndicator = !!ocIndicator.value.trim();
    ocPart4.hidden = !((hasStk && outcomeName && hasIndicator));

    const qty = parseFloat(ocQuantity.value);
    const proxyVal = parseFloat(ocProxyValue.value);
    const hasProxySource = !!ocProxySource.value.trim();

    const isComplete =
      hasStk &&
      outcomeName &&
      hasIndicator &&
      !isNaN(qty) && qty >= 0 &&
      !isNaN(proxyVal) && proxyVal >= 0 &&
      hasProxySource;

    if (btnSave) btnSave.disabled = !isComplete;
  };

  ocStakeholderSelect.addEventListener('change', () => {
    const sId = Number(ocStakeholderSelect.value);
    if (sId) {
      const s = stakeholders.find((x) => x.id === sId);
      if (s && s.estimated_count && !ocQuantity.value) {
        ocQuantity.value = s.estimated_count;
      }
    }
    checkVisibilityAndValidity();
  });

  ocPresetSelect.addEventListener('change', syncOutcomePresetUI);
  customOutcomeInput.addEventListener('input', checkVisibilityAndValidity);
  ocQuantity.addEventListener('input', checkVisibilityAndValidity);
  ocIndicator.addEventListener('input', checkVisibilityAndValidity);
  ocProxyValue.addEventListener('input', checkVisibilityAndValidity);
  ocProxySource.addEventListener('input', checkVisibilityAndValidity);

  ocProxyUnitSelect.addEventListener('change', () => {
    if (ocProxyUnitSelect.value === '__other__') {
      customProxyUnitRow.hidden = false;
      customProxyUnitInput.focus();
    } else {
      customProxyUnitRow.hidden = true;
      customProxyUnitInput.value = ocProxyUnitSelect.value;
    }
  });

  document.getElementById('btnPickProxyFromLib')?.addEventListener('click', () => {
    openProxyLibraryModal({
      onSelectProxy: (selectedProxy) => {
        if (ocProxyValue) ocProxyValue.value = selectedProxy.value;
        if (selectedProxy.unit) {
          if (PROXY_UNIT_SUGGESTIONS.includes(selectedProxy.unit)) {
            ocProxyUnitSelect.value = selectedProxy.unit;
            customProxyUnitRow.hidden = true;
          } else {
            ocProxyUnitSelect.value = '__other__';
            customProxyUnitRow.hidden = false;
            customProxyUnitInput.value = selectedProxy.unit;
          }
        }
        if (ocProxySource) {
          ocProxySource.value = selectedProxy.source + (selectedProxy.reference_year ? ` (${isTh ? 'ปี' : 'year'} ${selectedProxy.reference_year})` : '');
        }
        // Calculation-approach field: only pre-fill when empty, so anything the user typed is never overwritten.
        const ocProxyRationaleEl = document.getElementById('ocProxyRationale');
        if (ocProxyRationaleEl && !ocProxyRationaleEl.value.trim() && selectedProxy.definition) {
          ocProxyRationaleEl.value = selectedProxy.definition;
        }
        checkVisibilityAndValidity();
      },
    });
  });

  checkVisibilityAndValidity();

  // Save handler
  const save = async () => {
    errBox.hidden = true;
    const name = getEffectiveOutcomeName();
    if (!name) {
      showErr(isTh ? 'กรุณาระบุชื่อผลลัพธ์' : 'Please enter an outcome name.');
      return;
    }

    const proxyVal = ocProxyValue.value ? parseFloat(ocProxyValue.value) : null;
    const qty = parseFloat(ocQuantity.value) || 0;
    const proxyUnit = ocProxyUnitSelect.value === '__other__' ? customProxyUnitInput.value.trim() : ocProxyUnitSelect.value;

    const data = {
      name,
      activity: form.activity?.value.trim() || null,
      stakeholder_id: parseInt(ocStakeholderSelect.value, 10),
      polarity: ocPolaritySelect.value,
      indicator: ocIndicator.value.trim(),
      quantity: qty,
      proxy_value: proxyVal,
      proxy_unit: proxyUnit || 'คน / ปี',
      proxy_source: ocProxySource.value.trim(),
      proxy_rationale: document.getElementById('ocProxyRationale')?.value.trim() || null,
      duration_years: parseInt(form.duration_years.value, 10) || 1,
      projection_model: form.projection_model.value,
      evidence_quality: form.evidence_quality.value,
    };

    if (!data.stakeholder_id || isNaN(qty) || qty < 0) {
      showErr(isTh ? 'กรุณาระบุจำนวนคนที่เกิดการเปลี่ยนแปลง' : 'Please enter a valid quantity.');
      return;
    }

    if (btnSave) btnSave.disabled = true;
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
      if (btnSave) btnSave.disabled = false;
    }
  };

  btnSave?.addEventListener('click', save);
  form.addEventListener('submit', (e) => e.preventDefault());
}

function openEvidenceModal({ project, outcome }) {
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const modalHtml = `
    <div class="form-stack">
      <p class="muted-sm">
        ${isTh ? `แนบเอกสาร หลักฐานการสำรวจ URL หรือรายงานวิจัยเพื่อยืนยันผลลัพธ์ "${escapeHtml(outcome.name)}"` : `Attach evidence sources, survey files, or URLs for "${escapeHtml(outcome.name)}"`}
      </p>

      <form id="addEvidenceForm" class="panel panel--soft form-stack">
        <div class="form-row">
          <div class="field">
            <label class="field-label">${t('name', 'ชื่อเอกสาร / หลักฐาน')} <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span></label>
            <input type="text" name="title" class="input" required placeholder="${isTh ? 'เช่น แบบประเมินความพึงพอใจและทักษะ 2568' : 'e.g. Survey Results 2026'}" />
          </div>
          <div class="field">
            <label class="field-label">${isTh ? 'ประเภทหลักฐาน' : 'Kind'}</label>
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
        <div class="cluster cluster--end">
          <button type="submit" class="btn btn-primary" id="btnSaveEvidence">${isTh ? 'บันทึกหลักฐาน' : 'Add Evidence'}</button>
        </div>
        <div id="evidenceError" class="field-error" hidden></div>
      </form>

      <div id="evidenceListContainer" class="stack-sm">
        <div class="muted-sm">${t('loading', 'Loading evidence...')}</div>
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
        box.innerHTML = `<div class="empty-state"><p class="empty-state__text">${isTh ? 'ยังไม่มีหลักฐานแนบสำหรับผลลัพธ์นี้' : 'No evidence attached yet.'}</p></div>`;
        return;
      }
      box.innerHTML = `
        <div class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th>${t('name', 'ชื่อหลักฐาน')}</th>
                <th>${isTh ? 'ประเภท' : 'Type'}</th>
                <th>${isTh ? 'การอ้างอิง' : 'Ref'}</th>
                <th><span class="sr-only">${t('actions', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              ${list.map((ev) => `
                <tr>
                  <td class="strong">${escapeHtml(ev.title)}</td>
                  <td><span class="badge badge-planned">${escapeHtml(ev.kind)}</span></td>
                  <td>${ev.reference ? `<a href="${escapeHtml(ev.reference)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.reference)}</a>` : '-'}</td>
                  <td>
                    <button type="button" class="btn-icon" data-del-evidence="${ev.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
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
      box.innerHTML = `<div class="field-error">${err.message}</div>`;
    }
  };

  loadList();

  const addForm = document.getElementById('addEvidenceForm');
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('evidenceError');
    if (errBox) errBox.hidden = true;

    const payload = {
      title: addForm.title.value.trim(),
      kind: addForm.kind.value,
      reference: addForm.reference.value.trim() || null,
      description: addForm.description.value.trim() || null,
    };
    if (!payload.title) {
      if (errBox) {
        errBox.textContent = isTh ? 'กรุณาระบุชื่อหลักฐาน' : 'Please enter title.';
        errBox.hidden = false;
      }
      return;
    }
    try {
      await api.createEvidence(project.id, outcome.id, payload);
      addForm.reset();
      loadList();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    }
  });
}