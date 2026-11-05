/**
 * Step 1: Project Profile & Money Put In
 *
 * Written for staff who have never done an SROI before:
 *  - the page is two clearly numbered parts, with a live checklist at the top;
 *  - anything already chosen when the plan was created (owner, evaluation type, years, currency)
 *    is shown as read-only facts instead of blank inputs;
 *  - only the fields a person really has to think about are visible; the rest sit behind
 *    "settings" / "more details" with sensible defaults;
 *  - "Save & continue" really saves.
 * Fully bilingual (Thai & English).
 */

import {
  getState,
  updateProject,
  addCost,
  updateCost,
  addStakeholder,
  removeCost,
} from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatCurrency } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import {
  GROUPS,
  groupByKey,
  groupLabel,
  nextGroupCode,
  stakeholderOptionsHtml,
} from '../../utils/stakeholderGroups.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

// Shown once after a successful save, then cleared (the page re-renders after saving).
let justSaved = false;

export function renderStep1(container) {
  const { project, costs, stakeholders, investmentSummary } = getState();
  const isTh = getLanguage() !== 'en';

  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const stkById = {};
  stakeholders.forEach((x) => (stkById[x.id] = x));

  // Real shape of GET /projects/:id/summary (see CalculationService::investmentSummary)
  const sum = investmentSummary || {};
  const total = Number(sum.total_investment || 0);
  const inKind = Number(sum.in_kind_resources || 0);
  const cash = Math.max(0, total - inKind);
  const dupIds = new Set((sum.flags || []).filter((f) => f.cost_id).map((f) => f.cost_id));
  const cur = project.currency || 'THB';
  const money = (n) => {
    try {
      return formatCurrency(n, cur);
    } catch (e) {
      return `${cur} ${Math.round(Number(n) || 0).toLocaleString()}`;
    }
  };

  const hasName = !!(project.name || '').trim();
  const hasHorizon = Number(project.analysis_period_years) >= 1;
  const profileOk = hasName && hasHorizon;
  const costsOk = costs.length > 0;
  const unlinked = costs.filter((c) => !c.stakeholder_id).length;
  const horizon = Number(project.analysis_period_years) || 1;
  const showYear = horizon > 1 || costs.some((c) => Number(c.year) > 0);

  const L = (th, en) => (isTh ? th : en);
  const evalLabel =
    project.evaluation_type === 'forecast'
      ? L('ประเมินล่วงหน้า', 'Forecast (before the project)')
      : L('ประเมินย้อนหลัง', 'Evaluation (after the project)');
  const monthsLabel = project.assessment_months
    ? `${project.assessment_months} ${L('เดือน', 'months')}`
    : L('เต็มปี', 'Full year');

  // ── Owner (read-only: it is fixed when the plan is created) ──────────────────────────────
  const levelTh = { faculty: 'คณะ', department: 'ภาควิชา', organization: 'ทั้งมหาวิทยาลัย' };
  const levelEn = { faculty: 'Faculty', department: 'Department', organization: 'University-wide' };
  const level = project.owner_level || 'organization';
  const ownerName = project.owner_name || project.organization_name || '';
  // "คณะสหเวชศาสตร์" already says it is a faculty — don't print "คณะ คณะสหเวชศาสตร์"
  const nameHasLevel =
    /^(คณะ|ภาควิชา|สาขา|วิทยาลัย|มหาวิทยาลัย|faculty|department|school|college|university)/i.test(
      ownerName.trim(),
    );
  const ownerHtml = `
    <div class="s1-owner">
      <span class="s1-owner-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-3"></path></svg></span>
      <div class="s1-owner-main">
        <div class="s1-owner-label">${L('หน่วยงานเจ้าของโครงการ', 'Project owner')}</div>
        <div class="s1-owner-name">
          ${nameHasLevel ? '' : `<span class="badge badge-integrated">${(isTh ? levelTh : levelEn)[level] || ''}</span>`}
          ${ownerName ? escapeHtml(ownerName) : `<span class="muted">${L('ไม่ระบุ', 'Not specified')}</span>`}
        </div>
        ${
          level === 'department' && project.faculty_name
            ? `<div class="s1-owner-sub muted">${L('สังกัด', 'Under')} ${escapeHtml(project.faculty_name)}</div>`
            : ''
        }
      </div>
      <span class="s1-owner-lock muted" title="${L('เลือกไว้แล้วตอนสร้างโครงการ จึงไม่ต้องกรอกอีก', 'Chosen when the plan was created, so there is nothing to fill in')}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${L('เลือกไว้แล้วตอนสร้างโครงการ', 'Set when the plan was created')}</span>
    </div>`;

  const req = `<span class="s1-tag s1-tag-req">${L('จำเป็น', 'Required')}</span>`;
  const opt = `<span class="s1-tag">${L('ไม่บังคับ', 'Optional')}</span>`;

  container.innerHTML = `
    <div class="stack s1" style="gap: var(--sp-xl);">

      <!-- What to do on this page: a live checklist instead of a paragraph -->
      <div class="s1-todo" role="list">
        <a class="s1-todo-item ${profileOk ? 'is-done' : 'is-todo'}" href="#s1-profile" data-scroll="s1-profile" role="listitem">
          <span class="s1-todo-num">${profileOk ? '✓' : '1'}</span>
          <span class="s1-todo-text">
            <strong>${L('ตรวจข้อมูลโครงการ', 'Check your project info')}</strong>
            <small>${profileOk ? L('พร้อมแล้ว', 'Looks good') : L('ยังขาดชื่อโครงการ', 'Project name missing')}</small>
          </span>
        </a>
        <a class="s1-todo-item ${costsOk ? 'is-done' : 'is-todo'}" href="#s1-money" data-scroll="s1-money" role="listitem">
          <span class="s1-todo-num">${costsOk ? '✓' : '2'}</span>
          <span class="s1-todo-text">
            <strong>${L('ใส่เงินที่ใช้ทำโครงการ', 'Add the money put in')}</strong>
            <small>${
              costsOk
                ? `${costs.length} ${L('รายการ', 'items')} · ${money(total)}`
                : L('ยังไม่มีรายการ', 'Nothing added yet')
            }</small>
          </span>
        </a>
      </div>

      <!-- PART 1 · Project profile -->
      <section class="card" id="s1-profile">
        <div class="card-head">
          <div>
            <h2 class="card-title"><span class="s1-part">1</span> ${L('ข้อมูลโครงการ', 'About your project')}</h2>
            <p class="muted s1-sub">${L('ส่วนใหญ่กรอกไว้แล้วตอนสร้างโครงการ — ตรวจดูแล้วแก้เฉพาะที่ไม่ถูกต้อง', 'Most of this was filled in when you created the plan — just check it.')}</p>
          </div>
          <div class="s1-savebox">
            <span class="s1-dirty" id="s1Dirty" hidden>● ${L('มีการแก้ไขที่ยังไม่บันทึก', 'Unsaved changes')}</span>
            <span class="s1-saved" id="s1Saved" ${justSaved ? '' : 'hidden'}>✓ ${L('บันทึกแล้ว', 'Saved')}</span>
            <button class="btn btn-primary" id="btnSaveProjectDetails" type="button">${L('บันทึก', 'Save')}</button>
          </div>
        </div>

        ${ownerHtml}

        <form id="projectScopeForm" class="stack" style="gap: var(--sp-lg);" novalidate>
          <div class="field">
            <label class="field-label" for="s1Name">${L('ชื่อโครงการ', 'Project name')} ${req}</label>
            <input id="s1Name" type="text" name="name" class="input" value="${escapeHtml(project.name || '')}" placeholder="${L('เช่น โครงการตรวจคัดกรองสายตาผู้สูงอายุ 2568', 'e.g. Elderly Eye Screening Initiative 2026')}" />
            <span class="s1-err" id="s1NameErr" hidden>${L('กรุณากรอกชื่อโครงการ', 'Please enter the project name')}</span>
          </div>

          <div class="field">
            <label class="field-label" for="s1Desc">${L('โครงการนี้ทำเพื่ออะไร (โดยสังเขป)', 'What is the project for? (in brief)')} ${req}</label>
            <textarea id="s1Desc" name="description" class="input" rows="2" placeholder="${L('เช่น ตรวจสายตาผู้สูงอายุในตำบลเพื่อค้นหาและส่งต่อผู้ที่มีปัญหาการมองเห็น', 'e.g. Screen older adults for vision problems and refer those who need care')}">${escapeHtml(project.description || '')}</textarea>
            <span class="s1-err" id="s1DescErr" hidden>${L('กรุณากรอกวัตถุประสงค์ของโครงการ', 'Please describe what the project is for')}</span>
          </div>

          <div class="field s1-narrow">
            <label class="field-label" for="s1Cat">${L('ประเภทโครงการ', 'Type of project')} ${opt}</label>
            <input id="s1Cat" type="text" name="category" class="input" value="${escapeHtml(project.category || '')}" placeholder="${L('เช่น สาธารณสุข, การศึกษา, ชุมชน', 'e.g. Health, Education, Community')}" />
          </div>

          <!-- Facts that were already chosen: shown as chips, not blank boxes -->
          <div class="s1-facts" aria-label="${L('ค่าที่เลือกไว้แล้ว', 'Already chosen')}">
            <span class="s1-fact"><small>${L('รูปแบบ', 'Type')}</small><b>${evalLabel}</b></span>
            <span class="s1-fact"><small>${L('ติดตามผล', 'Impact tracked for')}</small><b>${horizon} ${L('ปี', horizon === 1 ? 'year' : 'years')}</b></span>
            <span class="s1-fact"><small>${L('ช่วงที่ประเมิน', 'Period')}</small><b>${monthsLabel}</b></span>
            <span class="s1-fact"><small>${L('สกุลเงิน', 'Currency')}</small><b>${escapeHtml(cur)}</b></span>
            <button type="button" class="btn-text s1-fact-edit" id="btnToggleAdvancedScope" aria-expanded="false" aria-controls="advancedScopeContent">${L('เปลี่ยนค่าเหล่านี้', 'Change these')}</button>
          </div>

          <div class="s1-settings" id="advancedScopeContent" hidden>
            <p class="muted s1-sub" style="margin-bottom: var(--sp-md);">
              ${L('ระบบตั้งค่ามาตรฐานไว้ให้แล้ว หากไม่แน่ใจ ไม่ต้องแก้ไขก็ได้', 'Standard values are already set. If you are unsure, leave them as they are.')}
            </p>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">${L('ติดตามผลกี่ปี', 'Years of impact to count')} ${req}</label>
                <select id="s1HorizonSelect" class="input">
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => `<option value="${y}" ${horizon === y ? 'selected' : ''}>${y} ${L('ปี', y === 1 ? 'year' : 'years')}</option>`).join('')}
                  <option value="Other" ${horizon > 10 ? 'selected' : ''}>${L('อื่นๆ (ระบุ)', 'Other (specify)')}</option>
                </select>
                <div id="s1HorizonCustomWrap" style="margin-top: var(--sp-xs); ${horizon > 10 ? '' : 'display: none;'}">
                  <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="${horizon}" placeholder="1–100" />
                </div>
                <span class="muted s1-hint">${L('โครงการทั่วไปนิยม 1–3 ปี', 'Most projects use 1–3 years')}</span>
              </div>
              <div class="field">
                <label class="field-label">${L('ประเมินเมื่อไหร่', 'When are you evaluating?')}</label>
                <select name="evaluation_type" class="input">
                  <option value="evaluative" ${project.evaluation_type === 'evaluative' ? 'selected' : ''}>${L('หลังโครงการเสร็จ (ใช้ผลจริง)', 'After the project (real results)')}</option>
                  <option value="forecast" ${project.evaluation_type === 'forecast' ? 'selected' : ''}>${L('ก่อนเริ่มโครงการ (คาดการณ์)', 'Before the project (forecast)')}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">${L('ช่วงเวลาที่ประเมิน', 'Period covered')}</label>
                <select name="assessment_months" class="input">
                  <option value="" ${!project.assessment_months ? 'selected' : ''}>${L('เต็มปี (12 เดือน)', 'Full year (12 months)')}</option>
                  <option value="6" ${project.assessment_months === 6 ? 'selected' : ''}>${L('6 เดือน', '6 months')}</option>
                  <option value="9" ${project.assessment_months === 9 ? 'selected' : ''}>${L('9 เดือน', '9 months')}</option>
                  <option value="12" ${project.assessment_months === 12 ? 'selected' : ''}>${L('12 เดือน (ปีงบประมาณ)', '12 months (fiscal year)')}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">${L('สกุลเงิน', 'Currency')}</label>
                <select id="s1CurrencySelect" class="input">
                  <option value="THB" ${cur === 'THB' ? 'selected' : ''}>THB</option>
                  <option value="USD" ${cur === 'USD' ? 'selected' : ''}>USD</option>
                  <option value="EUR" ${cur === 'EUR' ? 'selected' : ''}>EUR</option>
                  <option value="Other" ${!['THB', 'USD', 'EUR'].includes(cur) ? 'selected' : ''}>${L('อื่นๆ (ระบุ)', 'Other (specify)')}</option>
                </select>
                <div id="s1CurrencyCustomWrap" style="margin-top: var(--sp-xs); ${!['THB', 'USD', 'EUR'].includes(cur) ? '' : 'display: none;'}">
                  <input type="text" name="currency" class="input" value="${escapeHtml(cur)}" maxlength="3" placeholder="GBP" />
                </div>
              </div>
            </div>

            <details class="s1-more" style="margin-top: var(--sp-lg);">
              <summary>${L('การตั้งค่าทางการเงินขั้นสูง (ผู้เชี่ยวชาญ)', 'Advanced finance settings (experts)')}</summary>
              <div class="form-grid" style="margin-top: var(--sp-md);">
                <div class="field">
                  <label class="field-label">${L('อัตราคิดลดต่อปี (%)', 'Discount rate per year (%)')}</label>
                  <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" value="${project.discount_rate !== null && project.discount_rate !== undefined ? (project.discount_rate * 100).toFixed(1) : '0.0'}" />
                  <span class="muted s1-hint">${L('แนะนำ 0% สำหรับ 1 ปี หรือ 3% ตามเกณฑ์ธนาคารแห่งประเทศไทย', 'Suggested: 0% for 1 year, or 3% for longer')}</span>
                </div>
                <div class="field">
                  <label class="field-label">${L('ชนิดอัตราคิดลด', 'Discount rate basis')}</label>
                  <select name="discount_rate_basis" class="input">
                    <option value="real" ${project.discount_rate_basis === 'real' ? 'selected' : ''}>${L('Real (หักเงินเฟ้อแล้ว)', 'Real (inflation removed)')}</option>
                    <option value="nominal" ${project.discount_rate_basis === 'nominal' ? 'selected' : ''}>${L('Nominal (ตามอัตราตลาด)', 'Nominal (market rate)')}</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">${L('แหล่งอ้างอิงอัตราคิดลด', 'Where the rate comes from')}</label>
                  <input type="text" name="discount_rate_source" class="input" value="${escapeHtml(project.discount_rate_source || '')}" placeholder="${L('เช่น ธนาคารแห่งประเทศไทย', 'e.g. Bank of Thailand')}" />
                </div>
                <div class="field">
                  <label class="field-label">${L('มูลค่าเงินลงทุนคิดแบบ', 'Value investment as')}</label>
                  <select name="investment_basis" class="input">
                    <option value="nominal" ${project.investment_basis === 'nominal' ? 'selected' : ''}>${L('ยอดเงินจริง', 'Actual amount')}</option>
                    <option value="present_value" ${project.investment_basis === 'present_value' ? 'selected' : ''}>${L('มูลค่าปัจจุบัน (คิดลด)', 'Present value (discounted)')}</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">${L('นับแรงอาสา/ของบริจาครวมในเงินลงทุนไหม', 'Count volunteer time & donated items?')}</label>
                  <select name="include_in_kind" class="input">
                    <option value="1" ${project.include_in_kind ? 'selected' : ''}>${L('นับรวม', 'Yes, include')}</option>
                    <option value="0" ${!project.include_in_kind ? 'selected' : ''}>${L('ไม่นับ (เฉพาะเงินสดจริง)', 'No (cash only)')}</option>
                  </select>
                </div>
              </div>
              <input type="hidden" name="country" value="${escapeHtml(project.country || 'Thailand')}" />
            </details>
          </div>
        </form>
      </section>

      <!-- PART 2 · Money put in -->
      <section class="card" id="s1-money">
        <div class="card-head">
          <div>
            <h2 class="card-title"><span class="s1-part">2</span> ${L('เงินที่ใช้ทำโครงการ', 'Money put into the project')}</h2>
            <p class="muted s1-sub">${L('ทุกอย่างที่ต้องจ่าย หรือมีคนสนับสนุน เพื่อทำโครงการนี้ — ยังไม่ครบก็ไม่เป็นไร กลับมาเพิ่มได้', 'Everything spent or given to run the project. It is fine if it is not complete yet.')}</p>
          </div>
          ${costsOk ? `<button class="btn btn-primary" id="btnAddCost" type="button">${icons.plus} ${L('เพิ่มรายการ', 'Add item')}</button>` : ''}
        </div>

        ${
          costsOk
            ? `
        <div class="s1-stats">
          <div class="s1-stat s1-stat-main"><small>${L('รวมทั้งหมด', 'Total')}</small><b>${money(total)}</b></div>
          <div class="s1-stat"><small>${L('เงินสด', 'Cash')}</small><b>${money(cash)}</b></div>
          <div class="s1-stat"><small>${L('ไม่ใช่เงินสด', 'Non-cash')}</small><b>${money(inKind)}</b></div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${L('ใช้ไปกับอะไร', 'What it was for')}</th>
                <th>${L('ใครให้ / จ่าย', 'Who provided it')}</th>
                <th>${L('ชนิด', 'Kind')}</th>
                ${showYear ? `<th class="num">${L('ปีที่', 'Year')}</th>` : ''}
                <th class="num">${L('จำนวนเงิน', 'Amount')}</th>
                <th><span class="sr-only">${L('จัดการ', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody id="costTableBody">
              ${costs
                .map((c) => {
                  const stk = c.stakeholder_id ? stkById[c.stakeholder_id] : null;
                  const notCounted = !c.is_cash && !project.include_in_kind;
                  return `
                <tr data-id="${c.id}">
                  <td>
                    <div class="strong">${escapeHtml(c.description)}
                      ${c.period_label ? `<span class="badge badge-integrated s1-mini">${escapeHtml(c.period_label)}</span>` : ''}
                      ${dupIds.has(c.id) ? `<span class="badge s1-mini s1-warn" title="${L('มีรายการเหมือนกันอีก — ตรวจว่านับซ้ำหรือไม่', 'Another identical item exists — check for double counting')}">${L('อาจซ้ำ', 'Possible duplicate')}</span>` : ''}
                    </div>
                    <div class="muted s1-mini-line">${escapeHtml(costCategoryLabel(c.category, isTh))}</div>
                  </td>
                  <td>${stk ? `<span class="badge badge-integrated">${escapeHtml(stk.group_code || '')}</span> ${escapeHtml(stk.name)}` : '<span class="muted">–</span>'}</td>
                  <td>${c.is_cash ? L('เงินสด', 'Cash') : `<span class="muted">${L('ไม่ใช่เงินสด', 'Non-cash')}</span>`}
                    ${notCounted ? `<div class="s1-mini-line s1-warn-text">${L('ไม่นับในการคำนวณ', 'Not counted')}</div>` : ''}</td>
                  ${showYear ? `<td class="num">${Number(c.year) === 0 ? L('เริ่มต้น', 'Start') : `${L('ปีที่', 'Year')} ${c.year}`}</td>` : ''}
                  <td class="num strong">${money(c.amount * (c.exchange_rate || 1))}</td>
                  <td>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-icon" data-edit-cost="${c.id}" title="${t('edit', 'Edit')}" aria-label="${t('edit', 'Edit')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button class="btn-icon" data-remove-cost="${c.id}" title="${t('delete', 'Delete')}" aria-label="${t('delete', 'Delete')}">${icons.trash}</button>
                    </div>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
        ${
          unlinked > 0 && stakeholders.length > 0
            ? `<p class="muted s1-sub" style="margin-top: var(--sp-sm);">${unlinked} ${L('รายการยังไม่ระบุว่าใครให้ — ระบุตอนนี้ (กดแก้ไข) หรือที่ขั้นที่ 2 ก็ได้', 'items do not say who provided them — set it now (Edit) or in Step 2')}</p>`
            : ''
        }`
            : `
        <!-- Empty state: say what to do, give examples, one big button -->
        <div class="s1-empty">
          <div class="s1-empty-icon" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
          <div class="strong">${L('เริ่มจากรายการแรกของโครงการ', 'Start with the first item')}</div>
          <div class="muted s1-sub">${L('เลือกตัวอย่างด้านล่างเพื่อเริ่มเร็วขึ้น หรือกดปุ่มเพื่อกรอกเอง', 'Pick an example to start faster, or add your own.')}</div>
          <div class="s1-presets">
            <button type="button" class="s1-preset" data-preset="honorarium">${L('ค่าตอบแทนวิทยากร / ทีมงาน', 'Speakers & staff pay')}</button>
            <button type="button" class="s1-preset" data-preset="supplies">${L('ค่าวัสดุ / อุปกรณ์', 'Supplies & equipment')}</button>
            <button type="button" class="s1-preset" data-preset="volunteer">${L('แรงอาสา / ของบริจาค', 'Volunteer time & donations')}</button>
          </div>
          <button class="btn btn-primary s1-empty-btn" id="btnAddCost" type="button">${icons.plus} ${L('เพิ่มรายการแรก', 'Add first item')}</button>
        </div>`
        }
      </section>

      ${wizardFooterHtml(1, {
        canProceed: true,
        nextLabel: L(
          'ไปต่อ: ใครได้รับผลกระทบ (ขั้นที่ 2) →',
          'Continue: Who is affected (Step 2) →',
        ),
      })}
    </div>
  `;

  justSaved = false;

  // ── Behaviour ────────────────────────────────────────────────────────────────────────────
  const form = document.getElementById('projectScopeForm');
  const dirtyEl = document.getElementById('s1Dirty');
  const savedEl = document.getElementById('s1Saved');
  const nameErr = document.getElementById('s1NameErr');
  const descErr = document.getElementById('s1DescErr');
  const footerStatus = container.querySelector('.wizard-footer .save-status');
  const footerSavedHtml = footerStatus ? footerStatus.innerHTML : '';
  let dirty = false;

  const setDirty = (v) => {
    dirty = v;
    if (dirtyEl) dirtyEl.hidden = !v;
    if (savedEl && v) savedEl.hidden = true;
    if (footerStatus) {
      footerStatus.classList.toggle('is-saving', v);
      footerStatus.innerHTML = v
        ? `● ${L('มีการแก้ไขที่ยังไม่บันทึก', 'Unsaved changes')}`
        : footerSavedHtml;
    }
  };
  form?.addEventListener('input', () => setDirty(true));
  form?.addEventListener('change', () => setDirty(true));
  form?.addEventListener('submit', (e) => e.preventDefault());

  const toggleBtn = document.getElementById('btnToggleAdvancedScope');
  const horizonSelect = document.getElementById('s1HorizonSelect');
  const horizonCustomWrap = document.getElementById('s1HorizonCustomWrap');
  const currencySelect = document.getElementById('s1CurrencySelect');
  const currencyCustomWrap = document.getElementById('s1CurrencyCustomWrap');

  horizonSelect?.addEventListener('change', (e) => {
    if (e.target.value === 'Other') {
      horizonCustomWrap.style.display = 'block';
      form.analysis_period_years.focus();
    } else {
      horizonCustomWrap.style.display = 'none';
      form.analysis_period_years.value = e.target.value;
      setDirty(true);
    }
  });

  currencySelect?.addEventListener('change', (e) => {
    if (e.target.value === 'Other') {
      currencyCustomWrap.style.display = 'block';
      form.currency.focus();
    } else {
      currencyCustomWrap.style.display = 'none';
      form.currency.value = e.target.value;
      setDirty(true);
    }
  });
  const advContent = document.getElementById('advancedScopeContent');
  toggleBtn?.addEventListener('click', () => {
    advContent.hidden = !advContent.hidden;
    toggleBtn.setAttribute('aria-expanded', String(!advContent.hidden));
    toggleBtn.textContent = advContent.hidden
      ? L('เปลี่ยนค่าเหล่านี้', 'Change these')
      : L('ซ่อนการตั้งค่า', 'Hide settings');
  });

  container.querySelectorAll('[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document
        .getElementById(a.dataset.scroll)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /** Validates and saves the profile form. Resolves true when saved (or nothing to save). */
  async function saveProfile() {
    if (!form) return true;
    const name = form.name.value.trim();
    if (!name) {
      if (nameErr) nameErr.hidden = false;
      form.name.focus();
      form.name.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!form.description.value.trim()) {
      if (descErr) descErr.hidden = false;
      form.description.focus();
      form.description.setAttribute('aria-invalid', 'true');
      return false;
    }
    let years = 1;
    if (horizonSelect && horizonSelect.value !== 'Other') {
      years = parseInt(horizonSelect.value, 10);
      form.analysis_period_years.value = years;
    } else {
      years = parseInt(form.analysis_period_years.value, 10);
    }

    if (currencySelect && currencySelect.value !== 'Other') {
      form.currency.value = currencySelect.value;
    }
    if (Number.isNaN(years) || years < 1) {
      if (advContent.hidden) toggleBtn?.click();
      form.analysis_period_years.focus();
      return false;
    }
    const rate = form.discount_rate.value;
    const changes = {
      name,
      description: form.description.value.trim() || null,
      category: form.category.value.trim(),
      country: form.country.value.trim(),
      evaluation_type: form.evaluation_type.value,
      analysis_period_years: years,
      assessment_months: form.assessment_months.value
        ? parseInt(form.assessment_months.value, 10)
        : null,
      discount_rate: rate !== '' ? parseFloat(rate) / 100 : 0.0,
      discount_rate_basis: form.discount_rate_basis.value,
      investment_basis: form.investment_basis.value,
      include_in_kind: form.include_in_kind.value === '1',
      discount_rate_source: form.discount_rate_source.value.trim(),
      currency: form.currency.value.trim().toUpperCase(),
    };
    // NOTE: the owner (faculty / department) is deliberately not editable here — a plan has exactly
    // one direct owner, fixed at creation. organization_name is left untouched.
    try {
      await updateProject(changes);
      setDirty(false);
      justSaved = true;
      renderStep1(container);
      return true;
    } catch (err) {
      showToast(`${L('บันทึกไม่สำเร็จ', 'Could not save')}: ${err.message}`, 'error');
      return false;
    }
  }

  document.getElementById('btnSaveProjectDetails')?.addEventListener('click', () => saveProfile());
  form?.name?.addEventListener('input', () => {
    if (nameErr) nameErr.hidden = true;
    form.name.removeAttribute('aria-invalid');
  });
  form?.description?.addEventListener('input', () => {
    if (descErr) descErr.hidden = true;
    form.description.removeAttribute('aria-invalid');
  });

  // "Continue" must save first — it used to be a plain link that silently dropped edits.
  container.querySelector('.wizard-btn-next')?.addEventListener('click', async (e) => {
    if (!dirty && form?.description?.value.trim()) return;
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href');
    if (await saveProfile()) window.location.hash = href;
  });

  // Money
  const openAdd = (prefill = null) =>
    openAddCostModal({ project, prefill, onAdded: () => renderStep1(container) });
  document.getElementById('btnAddCost')?.addEventListener('click', () => openAdd());
  container
    .querySelectorAll('[data-preset]')
    .forEach((b) => b.addEventListener('click', () => openAdd(costPreset(b.dataset.preset, isTh))));

  container.querySelectorAll('[data-edit-cost]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = costs.find((c) => c.id === Number(btn.dataset.editCost));
      if (target)
        openAddCostModal({ project, initialData: target, onAdded: () => renderStep1(container) });
    });
  });

  container.querySelectorAll('[data-remove-cost]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const costId = Number(btn.dataset.removeCost);
      confirmModal({
        title: t('delete', 'Delete'),
        message: L('ต้องการลบรายการนี้ใช่หรือไม่?', 'Remove this item?'),
        onConfirm: async () => {
          await removeCost(costId);
          renderStep1(container);
        },
      });
    });
  });

  attachWizardFooterEvents(container);
}

function costPreset(key, isTh) {
  const P = {
    honorarium: {
      description: isTh ? 'ค่าตอบแทนวิทยากร / ทีมงาน' : 'Speaker & staff honorarium',
      category: 'administration',
      is_cash: 1,
    },
    supplies: {
      description: isTh ? 'ค่าวัสดุ / อุปกรณ์' : 'Supplies & equipment',
      category: 'opex',
      is_cash: 1,
    },
    volunteer: {
      description: isTh ? 'แรงอาสาสมัคร / ของบริจาค' : 'Volunteer time & donated items',
      category: 'in_kind',
      is_cash: 0,
    },
  };
  return P[key] || null;
}

function costCategoryLabel(cat, isTh) {
  const mapTh = {
    capex: 'ครุภัณฑ์ / อุปกรณ์ / สถานที่',
    opex: 'ค่าใช้จ่ายดำเนินงาน',
    delivery: 'ค่ากิจกรรมและการจัดอบรม',
    administration: 'ค่าตอบแทนบุคลากร / วิทยากร',
    in_kind: 'อาสาสมัคร / สิ่งสนับสนุน',
    other: 'อื่นๆ',
  };
  const mapEn = {
    capex: 'Equipment / venue',
    opex: 'Running costs',
    delivery: 'Activities & training',
    administration: 'Staff & speaker pay',
    in_kind: 'Volunteer & in-kind',
    other: 'Other',
  };
  return isTh ? mapTh[cat] || cat : mapEn[cat] || cat;
}

function openAddCostModal({ project, initialData = null, prefill = null, onAdded }) {
  const { stakeholders } = getState();
  const isEdit = !!initialData;
  const isTh = getLanguage() !== 'en';
  const L = (th, en) => (isTh ? th : en);
  const src = initialData || prefill || {};
  const v = (k, d = '') => (src[k] !== null && src[k] !== undefined ? src[k] : d);
  const funderGroups = GROUPS.filter((g) => g.fundsByDefault);
  const isCash = isEdit ? !!initialData.is_cash : v('is_cash', 1) === 1 || v('is_cash', 1) === true;
  const curr = escapeHtml(project.currency || 'THB');

  // Open "more details" by default only when editing an item that already uses them.
  const hasExtra =
    isEdit &&
    (initialData.stakeholder_id ||
      initialData.evidence_source ||
      initialData.period_label ||
      Number(initialData.year) > 0);

  const categories = [
    ['opex', L('ค่าใช้จ่ายดำเนินงาน', 'Running costs')],
    ['delivery', L('ค่ากิจกรรม / การจัดอบรม', 'Activities & training')],
    ['administration', L('ค่าตอบแทนบุคลากร / วิทยากร', 'Staff & speaker pay')],
    ['capex', L('ครุภัณฑ์ / อุปกรณ์ / สถานที่', 'Equipment / venue')],
    ['in_kind', L('แรงอาสา / ของบริจาค', 'Volunteer & in-kind')],
    ['other', L('อื่นๆ', 'Other')],
  ];

  const formHtml = `
    <form id="addCostForm" class="stack" style="gap: var(--sp-lg);" autocomplete="off" novalidate>
      <div class="field">
        <label class="field-label" for="cDesc">${L('ใช้ไปกับอะไร', 'What was it for?')} <span class="s1-tag s1-tag-req">${L('จำเป็น', 'Required')}</span></label>
        <input id="cDesc" type="text" name="description" class="input" value="${escapeHtml(v('description'))}" placeholder="${L('เช่น ค่าวิทยากรและเวชภัณฑ์ตรวจสายตา', 'e.g. Speaker fees and eye-test supplies')}" />
      </div>

      <div class="field">
        <span class="field-label">${L('เป็นเงินสดหรือไม่', 'Is it cash?')}</span>
        <div class="s1-kind">
          <label class="s1-kind-opt ${isCash ? 'is-on' : ''}">
            <input type="radio" name="kind" value="1" ${isCash ? 'checked' : ''} />
            
            <span><b>${L('เงินสด', 'Cash')}</b><small>${L('จ่ายจริงหรือได้รับเป็นเงิน', 'Actually paid or received as money')}</small></span>
          </label>
          <label class="s1-kind-opt ${!isCash ? 'is-on' : ''}">
            <input type="radio" name="kind" value="0" ${!isCash ? 'checked' : ''} />
            
            <span><b>${L('ไม่ใช่เงินสด', 'Not cash')}</b><small>${L('แรงอาสา ของบริจาค ใช้ห้อง/อุปกรณ์ฟรี', 'Volunteer time, donations, free use of space')}</small></span>
          </label>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="cAmt"><span id="cAmtLabel">${isCash ? L('จำนวนเงิน', 'Amount') : L('มูลค่าโดยประมาณ', 'Estimated value')}</span> (${curr}) <span class="s1-tag s1-tag-req">${L('จำเป็น', 'Required')}</span></label>
        <input id="cAmt" type="text" inputmode="decimal" name="amount" class="input" value="${v('amount')}" placeholder="50000" />
      </div>

      <details class="s1-more" ${hasExtra ? 'open' : ''}>
        <summary>${L('รายละเอียดเพิ่มเติม (ไม่บังคับ)', 'More details (optional)')}</summary>
        <div class="stack" style="gap: var(--sp-md); margin-top: var(--sp-md);">
          <div class="field">
            <label class="field-label">${L('ใครเป็นผู้ให้', 'Who provided it?')}</label>
            <select name="stakeholder_id" class="input">
              <option value="">${L('— ไม่ระบุ —', '— not specified —')}</option>
              ${stakeholderOptionsHtml(stakeholders, v('stakeholder_id', ''), escapeHtml)}
              <option value="__new__">${L('＋ เพิ่มผู้ให้ทุนใหม่…', '＋ Add a new funder…')}</option>
            </select>
            <span class="muted s1-hint">${L('ระบุแล้วจะแสดงในขั้นที่ 2 ให้อัตโนมัติ', 'It will show up in Step 2 automatically')}</span>
          </div>
          <div class="in-grid" id="newFunderBox" hidden>
            <label class="field in-w6"><span class="field-label">${L('ชื่อผู้ให้ทุนใหม่', 'New funder name')}</span>
              <input class="input" name="new_name" placeholder="${L('เช่น เทศบาลตำบล, สสส.', 'e.g. Local municipality')}" /></label>
            <label class="field in-w6"><span class="field-label">${L('กลุ่ม', 'Group')}</span>
              <select class="input" name="new_group">${funderGroups.map((g) => `<option value="${g.key}" ${g.key === 'project_supporter' ? 'selected' : ''}>${escapeHtml(groupLabel(g))}</option>`).join('')}</select></label>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">${L('หมวดค่าใช้จ่าย', 'Category')}</label>
              <select name="category" class="input">
                ${categories.map(([k, l]) => `<option value="${k}" ${v('category', isCash ? 'opex' : 'in_kind') === k ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field-label">${L('จ่ายในปีที่', 'Which year was it spent?')}</label>
              <input type="number" name="year" min="0" max="${project.analysis_period_years || 5}" class="input" value="${v('year', 0)}" />
              <span class="muted s1-hint">${L('0 = ปีที่เริ่มโครงการ', '0 = the year the project starts')}</span>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">${L('หลักฐานอ้างอิง', 'Evidence')}</label>
              <input type="text" name="evidence_source" class="input" value="${escapeHtml(v('evidence_source'))}" placeholder="${L('เช่น ใบเสร็จรับเงิน, สรุปงบประมาณ', 'e.g. receipts, budget summary')}" />
            </div>
            <div class="field">
              <label class="field-label">${L('ป้ายกำกับช่วงเวลา', 'Period label')}</label>
              <input type="text" name="period_label" class="input" value="${escapeHtml(v('period_label'))}" placeholder="${L('เช่น 6 เดือนแรก', 'e.g. first 6 months')}" />
            </div>
          </div>
        </div>
      </details>

      <div id="costModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: isEdit ? L('แก้ไขรายการ', 'Edit item') : L('เพิ่มรายการเงินที่ใช้', 'Add money put in'),
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>${t('cancel', L('ยกเลิก', 'Cancel'))}</button>
      ${isEdit ? '' : `<button class="btn btn-secondary" id="btnSaveCostNext" type="button">${L('บันทึกและเพิ่มต่อ', 'Save & add another')}</button>`}
      <button class="btn btn-primary" id="btnSaveCost" type="button">${L('บันทึก', 'Save')}</button>
    `,
  });

  const form = document.getElementById('addCostForm');
  const errBox = document.getElementById('costModalError');
  const box = document.getElementById('newFunderBox');
  const amtLabel = document.getElementById('cAmtLabel');
  const showErr = (m) => {
    errBox.textContent = m;
    errBox.style.display = 'block';
  };
  const kindVal = () => form.querySelector('input[name="kind"]:checked')?.value;

  const syncKind = () => {
    form
      .querySelectorAll('.s1-kind-opt')
      .forEach((o) => o.classList.toggle('is-on', o.querySelector('input').checked));
    amtLabel.textContent =
      kindVal() === '1' ? L('จำนวนเงิน', 'Amount') : L('มูลค่าโดยประมาณ', 'Estimated value');
  };
  form.querySelectorAll('input[name="kind"]').forEach((r) =>
    r.addEventListener('change', () => {
      syncKind();
      // keep category consistent with cash / non-cash (same rule as before)
      if (kindVal() === '0') form.category.value = 'in_kind';
      else if (form.category.value === 'in_kind') form.category.value = 'opex';
    }),
  );
  form.category.addEventListener('change', () => {
    if (form.category.value === 'in_kind') {
      form.querySelector('input[name="kind"][value="0"]').checked = true;
      syncKind();
    }
  });
  form.stakeholder_id.addEventListener('change', () => {
    box.hidden = form.stakeholder_id.value !== '__new__';
    if (!box.hidden) form.new_name.focus();
  });

  const save = async (andNext) => {
    errBox.style.display = 'none';
    const amount = parseFloat(String(form.amount.value).replace(/[,\s]/g, ''));
    const desc = form.description.value.trim();
    if (!desc) return showErr(L('กรุณาบอกว่าใช้ไปกับอะไร', 'Please say what it was for'));
    if (Number.isNaN(amount) || amount < 0)
      return showErr(
        L(
          'กรุณากรอกจำนวนเงินเป็นตัวเลข (ใส่ 0 ได้หากไม่มีค่าใช้จ่าย)',
          'Please enter the amount as a number',
        ),
      );

    const btns = document.querySelectorAll('#btnSaveCost, #btnSaveCostNext');
    btns.forEach((b) => (b.disabled = true));
    try {
      let funderId = form.stakeholder_id.value === '' ? null : form.stakeholder_id.value;
      if (funderId === '__new__') {
        const name = form.new_name.value.trim();
        if (!name)
          throw new Error(L('กรุณากรอกชื่อผู้ให้ทุนใหม่', 'Please enter the new funder name'));
        const g = groupByKey(form.new_group.value);
        const created = await addStakeholder({
          name,
          stakeholder_group: g.key,
          group_code: nextGroupCode(getState().stakeholders, g),
          count_unit: g.unit,
          category: 'Government agencies',
        });
        funderId = created.id;
      } else if (funderId !== null) {
        funderId = Number(funderId);
      }
      const yearRaw = parseInt(form.year.value, 10);
      const data = {
        description: desc,
        category: form.category.value,
        amount,
        currency: project.currency,
        year: Number.isNaN(yearRaw) ? 0 : yearRaw,
        is_cash: kindVal() === '1',
        evidence_source: form.evidence_source.value.trim(),
        period_label: form.period_label.value.trim() || null,
        stakeholder_id: funderId,
      };
      if (isEdit) await updateCost(initialData.id, data);
      else await addCost(data);
      closeModal();
      onAdded();
      if (andNext) {
        openAddCostModal({ project, onAdded });
        const f = document.getElementById('addCostForm');
        if (f && funderId) {
          f.stakeholder_id.value = String(funderId);
          f.year.value = data.year;
          f.querySelector('details.s1-more')?.setAttribute('open', '');
        }
      }
    } catch (err) {
      showErr(err.message);
      btns.forEach((b) => (b.disabled = false));
    }
  };
  document.getElementById('btnSaveCost')?.addEventListener('click', () => save(false));
  document.getElementById('btnSaveCostNext')?.addEventListener('click', () => save(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.description.focus();
}