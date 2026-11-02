/**
 * Step 3: Outcomes & Financial Proxies: What Changed & Its Value?
 * Guided, beginner-friendly experience for university employees.
 * Teaches the difference between Activity, Output, and Outcome.
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
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Guidance Header -->
      <div class="alert alert-info in-banner" style="background: rgba(25, 118, 210, 0.08); border-left: 4px solid var(--primary); padding: var(--sp-md);">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--primary); display: block; margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 3: ระบุการเปลี่ยนแปลงที่เกิดขึ้นและประเมินมูลค่า (Outcomes & Financial Proxies)' : 'Step 3: Identify What Changed & Value the Outcomes'}
          </strong>
          <span style="font-size: 0.8125rem; color: var(--on-background);">
            ${
              isTh
                ? 'ระบุการเปลี่ยนแปลงจริงที่มีความหมายต่อชีวิตของผู้คน (ผลลัพธ์) ไม่ใช่เพียงกิจกรรมที่จัดขึ้น แล้วประมาณการมูลค่าด้วยตัวแทนทางการเงิน'
                : 'Identify meaningful changes experienced by beneficiaries (outcomes) rather than just project activities, and value them using financial proxies.'
            }
          </span>
        </div>
      </div>

      <!-- Activity vs Output vs Outcome Educational Card -->
      <div class="card" style="border-left: 4px solid var(--positive);">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title" style="color: var(--positive); display: flex; align-items: center; gap: 6px;">
              💡 ${isTh ? 'ทำความเข้าใจ: "กิจกรรม" แตกต่างจาก "ผลลัพธ์" อย่างไร?' : 'Understanding: Activity vs Output vs Outcome'}
            </h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'หัวใจสำคัญของ SROI คือการวัด "การเปลี่ยนแปลงที่เกิดขึ้นจริง" ไม่ใช่วัดเพียงสิ่งที่โครงการทำ' : 'SROI measures actual change experienced by people, not just activities delivered.'}
            </p>
          </div>
        </div>

        <table class="edu-compare-table">
          <thead>
            <tr>
              <th style="width: 28%;">${isTh ? 'กิจกรรม (Activity)' : 'Activity (What you do)'}</th>
              <th style="width: 28%;">${isTh ? 'ผลผลิต (Output)' : 'Output (Immediate delivery)'}</th>
              <th style="width: 44%;">${isTh ? 'ผลลัพธ์ (Outcome) ★ สิ่งที่ SROI ต้องการ' : 'Outcome (Real change) ★ What SROI measures'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span class="badge-activity">${isTh ? 'สิ่งที่โครงการลงมือทำ' : 'Effort / action'}</span>
                <div style="margin-top: 4px; font-weight: 500;">${isTh ? 'จัดฝึกอบรมทักษะอาชีพ 3 วัน' : 'Deliver 3-day job skills workshop'}</div>
              </td>
              <td>
                <span class="muted">${isTh ? 'จำนวนสิ่งที่นับได้ทันที' : 'Immediate count'}</span>
                <div style="margin-top: 4px;">${isTh ? 'ผู้เข้าร่วมอบรม 120 คน' : '120 participants attended'}</div>
              </td>
              <td>
                <span class="badge-outcome">${isTh ? 'การเปลี่ยนแปลงที่มีความหมาย' : 'Meaningful change'}</span>
                <div style="margin-top: 4px; font-weight: 600; color: var(--positive);">
                  ${isTh ? 'ผู้เข้าอบรมนำทักษะไปประกอบอาชีพและมีรายได้เพิ่มขึ้นเฉลี่ย ฿3,500/เดือน' : 'Participants gain employment with average income increase of ฿3,500/month'}
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div style="font-weight: 500;">${isTh ? 'ตรวจคัดกรองสายตาและสุขภาพผู้สูงอายุ' : 'Free eye screening for community elderly'}</div>
              </td>
              <td>
                <div>${isTh ? 'ผู้สูงอายุได้รับการตรวจ 500 ราย' : '500 elderly screened'}</div>
              </td>
              <td>
                <div style="font-weight: 600; color: var(--positive);">
                  ${isTh ? 'ผู้สูงอายุกลับมามองเห็นชัดเจน ป้องกันภาวะสูญเสียการมองเห็น และลดความเสี่ยงการหกล้ม' : 'Restored vision, prevented blindness, and reduced risk of traumatic falls'}
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div style="font-weight: 500;">${isTh ? 'จัดกิจกรรมรณรงค์คัดแยกขยะในมหาวิทยาลัย' : 'Campus recycling & waste campaign'}</div>
              </td>
              <td>
                <div>${isTh ? 'จุดแยกขยะ 15 จุด และผู้เข้าร่วม 800 คน' : '15 bins placed, 800 participants'}</div>
              </td>
              <td>
                <div style="font-weight: 600; color: var(--positive);">
                  ${isTh ? 'ปริมาณขยะส่งกำจัดลดลง 20 ตัน/ปี และมหาวิทยาลัยประหยัดค่าธรรมเนียมจัดการขยะ' : 'Waste reduced by 20 tons/yr, saving university municipal disposal fees'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Outcomes & Financial Proxies Registry Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('outcome_registry_title', 'รายการผลลัพธ์และตัวแทนทางการเงิน (Outcome Registry)')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'บันทึกการเปลี่ยนแปลงและมูลค่าเทียบเคียงทางการเงินของแต่ละผลลัพธ์' : 'Translate measured changes into defensible monetary proxies'}
            </p>
          </div>
          <button class="btn btn-primary" id="btnAddOutcome">${icons.plus} ${isTh ? '+ เพิ่มผลลัพธ์ใหม่' : '+ Build Outcome'}</button>
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
                        ${isTh ? 'คลิกปุ่ม "+ เพิ่มผลลัพธ์ใหม่" เพื่อระบุการเปลี่ยนแปลงที่เกิดขึ้นจากโครงการของคุณ' : 'Click "+ Build Outcome" to map your first change'}
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
                      ${o.indicator ? `<span class="muted" style="font-size: 0.75rem;">${t('col_outcome_indicator', 'ตัวชี้วัด')}: ${escapeHtml(o.indicator)}</span>` : ''}
                    </td>
                    <td>
                      <span class="badge badge-planned">${escapeHtml(stkName)}</span>
                    </td>
                    <td>
                      <span class="polarity-badge ${o.polarity === 'negative' ? 'polarity-negative' : 'polarity-positive'}">
                        ${o.polarity === 'negative' ? t('polarity_negative', '- ผลเสีย / เชิงลบ') : t('polarity_positive', '+ ผลดี / เชิงบวก')}
                      </span>
                    </td>
                    <td class="num">${Number(o.quantity).toLocaleString()}</td>
                    <td class="num">
                      ${
                        o.proxy_value !== null
                          ? `${project.currency} ${formatBaht(o.proxy_value)} <small class="muted">/${escapeHtml(o.proxy_unit || t('unit', 'หน่วย'))}</small>`
                          : `<span class="muted">${t('unmonetized', 'ยังไม่ประเมินมูลค่า')}</span>`
                      }
                    </td>
                    <td class="num strong" style="color: ${o.polarity === 'negative' ? 'var(--negative)' : 'var(--positive)'}; font-size: 0.9375rem;">
                      ${gross !== null ? `${project.currency} ${formatBaht(gross)}` : '-'}
                    </td>
                    <td>
                      <span class="badge badge-${o.evidence_quality === 'measured' ? 'production' : o.evidence_quality === 'external' ? 'integrated' : 'planned'}">
                        ${escapeHtml(o.evidence_quality)}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn-icon" data-edit-outcome="${o.id}" title="${t('edit', 'Edit Outcome')}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="btn-icon" data-dup-outcome="${o.id}" title="${t('in_dup', 'Duplicate')}">⧉</button>
                        <button class="btn-icon" data-evidence-outcome="${o.id}" title="${t('field_rationale', 'Evidence')}">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <button class="btn-icon" data-remove-outcome="${o.id}" title="${t('delete', 'Delete Outcome')}">
                          ${icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
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
    </div>
  `;

  document.getElementById('btnAddOutcome')?.addEventListener('click', () => {
    if (stakeholders.length === 0) {
      alert(
        isTh
          ? 'กรุณาเพิ่มผู้มีส่วนได้ส่วนเสียในขั้นตอนที่ 2 อย่างน้อย 1 กลุ่มก่อนเพิ่มผลลัพธ์'
          : 'Please add at least one stakeholder in Step 2 before mapping outcomes.',
      );
      return;
    }
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
      if (target) {
        openOutcomeModal({
          project,
          stakeholders,
          initialData: target,
          onSaved: () => renderStep3(container),
        });
      }
    });
  });

  container.querySelectorAll('[data-dup-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = outcomes.find((o) => o.id === Number(btn.dataset.dupOutcome));
      if (target)
        openOutcomeModal({
          project,
          stakeholders,
          prefill: target,
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

  const formHtml = `
    <form id="outcomeBuilderForm" class="stack" style="gap: var(--sp-lg);" autocomplete="off">
      <!-- Section 1: Describe the Change -->
      <div class="card" style="padding: var(--sp-md); background: var(--surface-soft); border: 1px solid var(--outline);">
        <h3 style="font-size: 0.9375rem; font-weight: 700; color: var(--primary); margin-bottom: 4px;">
          1️⃣ ${isTh ? 'ระบุการเปลี่ยนแปลงที่เกิดขึ้น (Describe the Change)' : 'Step 1: Describe the Change'}
        </h3>
        <p class="muted" style="font-size: 0.75rem; margin-bottom: var(--sp-md);">
          ${isTh ? 'ใครเป็นผู้ได้รับผลประโยชน์ และเกิดอะไรที่ดีขึ้นหรือแย่ลงเพราะโครงการของคุณ?' : 'Who experienced the change and what happened as a direct result?'}
        </p>

        <div class="form-grid">
          <div class="field">
            <label class="field-label">${isTh ? 'ผู้มีส่วนได้ส่วนเสียที่เกิดการเปลี่ยนแปลง *' : 'Stakeholder Affected *'}</label>
            <select name="stakeholder_id" class="input" required>
              ${stakeholderOptionsHtml(stakeholders, startStk, escapeHtml)}
            </select>
          </div>

          <div class="field">
            <label class="field-label">${isTh ? 'ลักษณะผลลัพธ์ *' : 'Polarity *'}</label>
            <select name="polarity" class="input">
              <option value="positive" ${src?.polarity !== 'negative' ? 'selected' : ''}>${isTh ? '＋ ผลประโยชน์เชิงบวก (Positive Benefit)' : '+ Positive Benefit'}</option>
              <option value="negative" ${src?.polarity === 'negative' ? 'selected' : ''}>${isTh ? '－ ผลกระทบทางลบ / ความเสียหาย (Negative Harm)' : '- Negative Harm / Cost'}</option>
            </select>
          </div>
        </div>

        <div class="field" style="margin-top: var(--sp-sm);">
          <label class="field-label">${isTh ? 'การเปลี่ยนแปลงที่เกิดขึ้นคืออะไร? (ชื่อผลลัพธ์) *' : 'What changed? (Outcome Name) *'}</label>
          <input type="text" name="name" class="input" value="${escapeHtml(src?.name || '')}" required placeholder="${isTh ? 'เช่น ผู้สูงอายุป้องกันภาวะสูญเสียการมองเห็นและลดความเสี่ยงหกล้ม' : 'e.g. Prevented vision loss and restored independence'}" />
          <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
            ${isTh ? '💡 ระบุการเปลี่ยนแปลงที่เกิดขึ้นจริงกับผู้คน ไม่ใช่ระบุเพียงกิจกรรมที่จัดขึ้น' : 'Describe the actual meaningful change, not just what activity was conducted.'}
          </span>
        </div>

        <div class="form-grid" style="margin-top: var(--sp-sm);">
          <div class="field">
            <label class="field-label">${isTh ? 'จำนวนคนที่เกิดการเปลี่ยนแปลง (คน/หน่วย) *' : 'Quantity Experiencing Change *'}</label>
            <input type="number" name="quantity" min="0" step="1" class="input" value="${src?.quantity ?? startCount ?? ''}" required />
          </div>
          <div class="field">
            <label class="field-label">${isTh ? 'ตัวชี้วัดการเปลี่ยนแปลง (Indicator)' : 'Indicator of Change'}</label>
            <input type="text" name="indicator" class="input" value="${escapeHtml(src?.indicator || '')}" placeholder="${isTh ? 'เช่น ผลตรวจการมองเห็นหลังได้รับแว่นตา' : 'e.g. Visual acuity score post-intervention'}" />
          </div>
        </div>
      </div>

      <!-- Section 2: Financial Proxy & Valuation -->
      <div class="card" style="padding: var(--sp-md); background: var(--surface-card); border: 1px solid var(--outline);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-sm); margin-bottom: var(--sp-sm);">
          <div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; color: var(--primary); margin-bottom: 2px;">
              2️⃣ ${isTh ? 'ประเมินมูลค่าผลลัพธ์ (Financial Proxy Valuation)' : 'Step 2: Value the Change (Financial Proxy)'}
            </h3>
            <p class="muted" style="font-size: 0.75rem; margin: 0;">
              ${isTh ? 'ประมาณมูลค่าทางการเงินของคุณค่าทางสังคมนี้ เพื่อให้สามารถเปรียบเทียบกับเงินลงทุนได้' : 'Approximate the monetary value of this social benefit to compare against investment.'}
            </p>
          </div>
          <button type="button" class="btn btn-secondary" id="btnPickProxyFromLib" style="font-size: 0.8125rem;">
            📚 ${isTh ? 'เลือกจากคลังตัวแทนทางการเงิน' : 'Pick from Proxy Library'}
          </button>
        </div>

        <div style="background: var(--surface-soft); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.75rem; margin-bottom: var(--sp-md); border-left: 3px solid var(--accent);">
          💡 <strong>${isTh ? 'ตัวแทนทางการเงินคืออะไร?' : 'What is a Financial Proxy?'}</strong> ${isTh ? 'ประโยชน์ทางสังคมส่วนใหญ่ไม่มีราคาตลาดตรงๆ เช่น สุขภาพหรือทักษะ เราจึงใช้มูลค่าเทียบเคียง เช่น ค่าคอร์สอบรมในตลาด หรือค่ารักษาพยาบาลที่ประหยัดได้' : 'Most social changes lack market prices. Proxies estimate value using market equivalents, such as training fees or medical costs avoided.'}
        </div>

        <div class="form-grid">
          <div class="field">
            <label class="field-label">${isTh ? 'มูลค่าตัวแทนต่อหน่วย (บาท) *' : 'Proxy Value per Unit *'} (${project.currency})</label>
            <input type="number" name="proxy_value" min="0" step="0.01" class="input" value="${src?.proxy_value ?? ''}" placeholder="${isTh ? 'เช่น 2500' : 'e.g. 2500'}" />
          </div>
          <div class="field">
            <label class="field-label">${isTh ? 'หน่วยนับของตัวแทน' : 'Proxy Unit of Measure'}</label>
            <input type="text" name="proxy_unit" class="input" value="${escapeHtml(src?.proxy_unit || (isTh ? 'คน / ปี' : 'person / year'))}" placeholder="${isTh ? 'เช่น คน / ปี, โครงการ / ปี' : 'e.g. person / year'}" />
          </div>
        </div>

        <div class="field" style="margin-top: var(--sp-sm);">
          <label class="field-label">${isTh ? 'แหล่งที่มาของมูลค่าอ้างอิง *' : 'Evidence / Benchmark Source *'}</label>
          <input type="text" name="proxy_source" class="input" value="${escapeHtml(src?.proxy_source || '')}" required placeholder="${isTh ? 'เช่น อัตราค่าบริการรักษาพยาบาล รพ.มหาวิทยาลัยนเรศวร, รายงาน SROI' : 'e.g. University hospital fee schedule, published SROI benchmark'}" />
        </div>

        <!-- Collapsible Advanced Settings -->
        <details class="in-more" style="margin-top: var(--sp-md);">
          <summary style="font-size: 0.8125rem; font-weight: 600; cursor: pointer; color: var(--muted);">
            ⚙️ ${isTh ? 'การตั้งค่าขั้นสูง (ระยะเวลา, ความคงอยู่, คุณภาพหลักฐาน)' : 'Advanced Details (Duration, Persistence, Evidence)'}
          </summary>
          <div class="form-grid" style="margin-top: var(--sp-sm);">
            <div class="field">
              <label class="field-label">${isTh ? 'ผลลัพธ์นี้คงอยู่กี่ปี? (Duration)' : 'Outcome Duration (Years)'}</label>
              <input type="number" name="duration_years" min="1" max="${period}" class="input" value="${src?.duration_years || 1}" />
            </div>
            <div class="field">
              <label class="field-label">${isTh ? 'รูปแบบความคงอยู่ของผลลัพธ์' : 'Outcome Persistence Model'}</label>
              <select name="projection_model" class="input">
                <option value="cohort" ${src?.projection_model === 'cohort' ? 'selected' : ''}>${isTh ? 'Single Cohort (กลุ่มเดียว ค่อยๆ ลดลงตามปี)' : 'Single Cohort (persists over time)'}</option>
                <option value="recurring_cohorts" ${src?.projection_model === 'recurring_cohorts' ? 'selected' : ''}>${isTh ? 'Recurring Cohorts (มีกลุ่มใหม่เข้ารับบริการทุกปี)' : 'Recurring Cohorts (new entrants yearly)'}</option>
                <option value="independent" ${src?.projection_model === 'independent' ? 'selected' : ''}>${isTh ? 'Independent (วัดผลแยกรายปีอิสระ)' : 'Independent (annual measured quantities)'}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">${isTh ? 'ระดับความน่าเชื่อถือของหลักฐาน' : 'Evidence Rigor Level'}</label>
              <select name="evidence_quality" class="input">
                <option value="measured" ${src?.evidence_quality === 'measured' ? 'selected' : ''}>${isTh ? 'Measured (เก็บข้อมูลวัดผลเชิงประจักษ์จริง)' : 'Measured (Empirical data collected)'}</option>
                <option value="external" ${src?.evidence_quality === 'external' ? 'selected' : ''}>${isTh ? 'External (อ้างอิงจากงานวิจัย / สถิติภายนอก)' : 'External (Research citations)'}</option>
                <option value="estimated" ${src?.evidence_quality === 'estimated' ? 'selected' : ''}>${isTh ? 'Estimated (ประมาณการตามเหตุผล)' : 'Estimated (Extrapolated)'}</option>
                <option value="assumed" ${src?.evidence_quality === 'assumed' ? 'selected' : ''}>${isTh ? 'Assumed (สมมติฐานเบื้องต้น)' : 'Assumed (Hypothetical judgment)'}</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <div id="outcomeModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
    ${isEdit ? '' : `<button class="btn btn-secondary" id="btnSaveOutcomeNext">${isTh ? 'บันทึกและเพิ่มผลลัพธ์ต่อไป' : 'Save & add next'}</button>`}
    <button class="btn btn-primary" id="btnSaveOutcome">${isEdit ? (isTh ? 'อัปเดตผลลัพธ์' : 'Update Outcome') : isTh ? 'บันทึกผลลัพธ์' : 'Save Outcome'}</button>
  `;

  openModal({
    title: isEdit
      ? isTh
        ? 'แก้ไขผลลัพธ์และตัวแทนทางการเงิน'
        : 'Edit Outcome'
      : isTh
        ? 'เพิ่มผลลัพธ์และตัวแทนทางการเงิน (Build Outcome)'
        : 'Add New Outcome',
    body: formHtml,
    size: 'lg',
    footer,
  });

  document.getElementById('btnPickProxyFromLib')?.addEventListener('click', () => {
    openProxyLibraryModal({
      onSelectProxy: (selectedProxy) => {
        const form = document.getElementById('outcomeBuilderForm');
        if (form) {
          form.proxy_value.value = selectedProxy.value;
          form.proxy_unit.value = selectedProxy.unit;
          form.proxy_source.value = selectedProxy.source;
        }
      },
    });
  });

  const save = async (andNext) => {
    const form = document.getElementById('outcomeBuilderForm');
    const errBox = document.getElementById('outcomeModalError');
    if (!form) return;
    if (errBox) errBox.style.display = 'none';

    const proxyVal = form.proxy_value.value ? parseFloat(form.proxy_value.value) : null;

    const data = {
      name: form.name.value.trim(),
      stakeholder_id: parseInt(form.stakeholder_id.value, 10),
      polarity: form.polarity.value,
      indicator: form.indicator.value.trim(),
      quantity: parseFloat(form.quantity.value) || 0,
      proxy_value: proxyVal,
      proxy_unit: form.proxy_unit.value.trim(),
      proxy_source: form.proxy_source.value.trim(),
      duration_years: parseInt(form.duration_years.value, 10) || 1,
      projection_model: form.projection_model.value,
      evidence_quality: form.evidence_quality.value,
    };

    if (!data.name || !data.stakeholder_id || form.quantity.value === '' || isNaN(data.quantity)) {
      if (errBox) {
        errBox.textContent = isTh
          ? 'กรุณาระบุชื่อผลลัพธ์และจำนวนคนที่เกิดการเปลี่ยนแปลง'
          : 'Please enter an outcome name and valid quantity.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      if (isEdit) {
        await updateOutcome(initialData.id, data);
      } else {
        await addOutcome(data);
      }
      lastStakeholderId = data.stakeholder_id;
      if (andNext) {
        ['name', 'indicator', 'proxy_value', 'proxy_unit', 'proxy_source'].forEach(
          (n) => (form[n].value = ''),
        );
        form.quantity.value =
          stakeholders.find((s) => s.id === data.stakeholder_id)?.estimated_count ?? '';
        onSaved();
        form.name.focus();
        return;
      }
      closeModal();
      onSaved();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  };

  document.getElementById('btnSaveOutcome')?.addEventListener('click', () => save(false));
  document.getElementById('btnSaveOutcomeNext')?.addEventListener('click', () => save(true));

  const f = document.getElementById('outcomeBuilderForm');
  if (f) {
    let qtyTouched = !!src || f.quantity.value !== '';
    f.quantity.addEventListener('input', () => (qtyTouched = true));
    f.stakeholder_id.addEventListener('change', () => {
      const c = stakeholders.find((s) => s.id === Number(f.stakeholder_id.value))?.estimated_count;
      if (!qtyTouched && c !== null && c !== undefined) f.quantity.value = c;
    });
    f.addEventListener('submit', (e) => e.preventDefault());
    f.name.focus();
  }
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
        <div style="display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-primary" id="btnSubmitEvidence" style="height: 32px; font-size: 0.75rem;">
            + ${isTh ? 'แนบหลักฐาน' : 'Attach Evidence'}
          </button>
        </div>
      </form>

      <div style="margin-top: var(--sp-md);">
        <h4 style="font-size: 0.875rem; margin-bottom: var(--sp-sm);">${isTh ? 'เอกสารหลักฐานที่แนบไว้' : 'Attached Evidence'}</h4>
        <div id="evidenceListContainer" class="stack" style="gap: var(--sp-xs);">
          <div class="muted">${t('loading', 'กำลังโหลดข้อมูลหลักฐาน...')}</div>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: `${isTh ? 'แหล่งหลักฐานอ้างอิง — ' : 'Evidence Sources — '}${outcome.name}`,
    body: modalHtml,
    size: 'lg',
    footer: `<button class="btn btn-secondary" data-modal-close>${t('close', 'ปิด')}</button>`,
  });

  const loadEvidence = async () => {
    const list = document.getElementById('evidenceListContainer');
    if (!list) return;
    try {
      const res = await api.getEvidence(project.id);
      const matched = (res.data || []).filter((e) => e.outcome_id === outcome.id);
      if (matched.length === 0) {
        list.innerHTML = `<div class="empty muted">${isTh ? 'ยังไม่มีหลักฐานแนบสำหรับผลลัพธ์นี้' : 'No evidence attached yet.'}</div>`;
        return;
      }
      list.innerHTML = matched
        .map(
          (e) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--surface); border: 1px solid var(--outline); border-radius: var(--radius-sm);">
          <div>
            <strong style="font-size: 0.8125rem;">${escapeHtml(e.title)}</strong>
            <span class="badge badge-planned" style="font-size: 0.6875rem; margin-left: 6px;">${escapeHtml(e.kind)}</span>
            ${e.reference ? `<div class="muted" style="font-size: 0.75rem;"><a href="${escapeHtml(e.reference)}" target="_blank" rel="noopener">${escapeHtml(e.reference)}</a></div>` : ''}
          </div>
          <button class="btn-icon" data-del-evidence="${e.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
        </div>
      `,
        )
        .join('');

      list.querySelectorAll('[data-del-evidence]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api.deleteEvidence(project.id, Number(btn.dataset.delEvidence));
          loadEvidence();
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  loadEvidence();

  document.getElementById('btnSubmitEvidence')?.addEventListener('click', async () => {
    const f = document.getElementById('addEvidenceForm');
    if (!f || !f.title.value.trim()) return;
    try {
      await api.addEvidence(project.id, {
        outcome_id: outcome.id,
        title: f.title.value.trim(),
        kind: f.kind.value,
        reference: f.reference.value.trim() || null,
      });
      f.title.value = '';
      f.reference.value = '';
      loadEvidence();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}
