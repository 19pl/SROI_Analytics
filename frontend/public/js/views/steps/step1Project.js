/**
 * Step 1: Project Details & Total Investment
 * Guided, beginner-friendly experience for university employees.
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
import { card, textField, numberField } from '../../components/ui.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import {
  GROUPS,
  groupByKey,
  groupLabel,
  nextGroupCode,
  stakeholderOptionsHtml,
} from '../../utils/stakeholderGroups.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

export function renderStep1(container) {
  const { project, costs, stakeholders, investmentSummary } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  const stkById = {};
  stakeholders.forEach((x) => (stkById[x.id] = x));
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const summary = investmentSummary || {
    nominal_total: 0,
    present_value_total: 0,
    cash_total: 0,
    in_kind_total: 0,
    by_category: {},
  };

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Guidance & Context Header -->
      <div class="alert alert-info in-banner" style="background: rgba(25, 118, 210, 0.08); border-left: 4px solid var(--primary); padding: var(--sp-md);">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--primary); display: block; margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 1: บอกเล่าเกี่ยวกับโครงการและเงินลงทุนของคุณ' : 'Step 1: Tell Us About Your Project & Resources'}
          </strong>
          <span style="font-size: 0.8125rem; color: var(--on-background);">
            ${
              isTh
                ? 'กรอกข้อมูลพื้นฐานของโครงการและบันทึกทรัพยากรหรือเงินลงทุนทั้งหมดที่ใช้ เพื่อเป็นฐานเปรียบเทียบกับมูลค่าทางสังคมที่จะได้รับ'
                : 'Define basic project information and record all invested capital or resource inputs to establish the baseline for social valuation.'
            }
          </span>
        </div>
      </div>

      <!-- Live Investment Summary Card -->
      <div class="card has-stripe" style="background: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-soft) 100%); --stripe: var(--primary);">
        <div class="card-head">
          <div>
            <h2 class="card-title">${t('live_inv_baseline', 'ฐานข้อมูลเงินลงทุนโครงการ (Investment Baseline)')}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('live_inv_desc', 'ทรัพยากรและงบประมาณที่ใช้จริงตลอดช่วงอายุโครงการ')}</p>
          </div>
          <span class="badge ${project.investment_basis === 'present_value' ? 'badge-integrated' : 'badge-planned'}">
            ${t('inv_basis_label', 'เกณฑ์')}: ${project.investment_basis === 'present_value' ? t('inv_basis_pv', 'มูลค่าปัจจุบัน (PV)') : t('inv_basis_nominal', 'ตามมูลค่าเงินสด')}
          </span>
        </div>
        <div class="stat-grid-4" style="margin-bottom: 0;">
          <div class="stat-card">
            <div class="stat-label">${t('stat_total_inv', 'เงินลงทุนรวมทั้งหมด')}</div>
            <div class="stat-val" style="color: var(--primary);">
              ${project.currency} ${formatBaht(summary.nominal_total || 0)}
            </div>
            <div class="stat-sub">${t('col_present_value', 'Present Value')}: ${project.currency} ${formatBaht(summary.present_value_total || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_cash_exp', 'ค่าใช้จ่ายเงินสด')}</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.cash_total || 0)}</div>
            <div class="stat-sub">${t('stat_direct_outlay', 'การจ่ายเงินสดจริง')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_inkind', 'สิ่งสนับสนุน / อาสาสมัคร (In-Kind)')}</div>
            <div class="stat-val">${project.currency} ${formatBaht(summary.in_kind_total || 0)}</div>
            <div class="stat-sub">${project.include_in_kind ? t('stat_inkind_included', 'รวมในการวิเคราะห์') : t('stat_inkind_excluded', 'ไม่รวมในการคำนวณ')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${t('stat_horizon', 'ระยะเวลาประเมินผลกระทบ')}</div>
            <div class="stat-val">${project.analysis_period_years || 1} ${t('years', 'ปี')}</div>
            <div class="stat-sub">${t('stat_discount_rate', 'อัตราคิดลด')}: ${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) + '%' : t('stat_unset', '0%')}</div>
          </div>
        </div>
      </div>

      <!-- Core Project Information Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${isTh ? 'ข้อมูลพื้นฐานของโครงการ (Project Profile)' : 'Project Profile'}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'กรอกชื่อโครงการ วัตถุประสงค์ และระยะเวลาที่ต้องการติดตามผลลัพธ์' : 'Identify the project title, objectives, and evaluation timeframe'}
            </p>
          </div>
          <button class="btn btn-primary" id="btnSaveProjectDetails">${t('btn_save_settings', 'บันทึกข้อมูลโครงการ')}</button>
        </div>

        <form id="projectScopeForm" class="stack" style="gap: var(--sp-lg);">
          <div class="form-grid">
            <div class="field">
              <label class="field-label">
                ${isTh ? '1. ชื่อโครงการ / แผนงานของคุณคืออะไร? *' : '1. What is the name of your project? *'}
              </label>
              <input type="text" name="name" class="input" value="${escapeHtml(project.name || '')}" required placeholder="${isTh ? 'เช่น โครงการตรวจคัดกรองสายตาผู้สูงอายุ 2568' : 'e.g. Elderly Eye Screening Initiative 2026'}" />
              <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
                ${isTh ? '💡 ระบุชื่อทางการที่ใช้ในคณะ หรือระบุไว้ในเอกสารขออนุมัติงบประมาณ' : 'Use the official project name from your faculty or department approval documents.'}
              </span>
            </div>

            <div class="field">
              <label class="field-label">
                ${isTh ? '2. สถาบัน / หน่วยงานเจ้าของโครงการ' : '2. Institution / Department'}
              </label>
              <input type="text" name="organization_name" class="input" value="${escapeHtml(project.organization_name || '')}" placeholder="${isTh ? 'เช่น คณะสหเวชศาสตร์ มหาวิทยาลัยนเรศวร' : 'e.g. Faculty of Allied Health Sciences, Naresuan University'}" />
              <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
                ${isTh ? 'ระบุคณะ หรือภาควิชาที่เป็นผู้รับผิดชอบหลัก' : 'Identifies the faculty or department directly responsible.'}
              </span>
            </div>

            <div class="field">
              <label class="field-label">
                ${isTh ? '3. หมวดหมู่โครงการ' : '3. Project Category'}
              </label>
              <input type="text" name="category" class="input" value="${escapeHtml(project.category || '')}" placeholder="${isTh ? 'เช่น สาธารณสุข, พัฒนาทักษะ, พัฒนาชุมชน, สิ่งแวดล้อม' : 'Health, Education, Community development...'}" />
            </div>

            <div class="field">
              <label class="field-label">
                ${isTh ? '4. ระยะเวลาที่ต้องการประเมินผลกระทบ (ปี) *' : '4. Evaluation Horizon (Years) *'}
              </label>
              <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="${project.analysis_period_years || 1}" required />
              <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
                ${isTh ? '💡 ผลกระทบจะเกิดขึ้นต่อเนื่องกี่ปี? (โครงการทั่วไปนิยม 1-3 ปี)' : 'How many years does the lasting impact continue? (Typically 1-3 years)'}
              </span>
            </div>
          </div>

          <!-- Advanced Economic Settings Accordion -->
          <div class="accordion-box">
            <div class="accordion-header" id="btnToggleAdvancedScope">
              <span style="display: flex; align-items: center; gap: 8px;">
                ⚙️ <strong>${isTh ? 'การตั้งค่าทางเศรษฐศาสตร์ขั้นสูง (Advanced Economic Parameters)' : 'Advanced Economic Parameters'}</strong>
                <span class="muted" style="font-size: 0.75rem; font-weight: normal;">${isTh ? '(ระบบกำหนดค่ามาตรฐานไว้ให้แล้ว สามารถปรับเปลี่ยนได้)' : '(Sensible defaults provided)'}</span>
              </span>
              <span id="advancedAccordionIcon" style="font-size: 0.8125rem;">▼ ${isTh ? 'คลิกเพื่อดูหรือแก้ไข' : 'Click to expand'}</span>
            </div>

            <div class="accordion-content" id="advancedScopeContent" hidden>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">${t('field_eval_type', 'ประเภทการประเมิน (Evaluation Type)')}</label>
                  <select name="evaluation_type" class="input">
                    <option value="evaluative" ${project.evaluation_type === 'evaluative' ? 'selected' : ''}>
                      ${isTh ? 'Evaluative — ประเมินย้อนหลังตามผลงานจริง (โครงการเสร็จแล้ว)' : 'Evaluative (Ex-post actuals — recommended)'}
                    </option>
                    <option value="forecast" ${project.evaluation_type === 'forecast' ? 'selected' : ''}>
                      ${isTh ? 'Forecast — ประเมินล่วงหน้า (คาดการณ์ก่อนเริ่มโครงการ)' : 'Forecast (Ex-ante prospective)'}
                    </option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">${t('field_discount_rate', 'อัตราคิดลดต่อปี (Annual Discount Rate %)')}</label>
                  <input type="number" name="discount_rate" step="0.1" min="0" max="100" class="input" value="${project.discount_rate !== null ? (project.discount_rate * 100).toFixed(1) : '0.0'}" placeholder="0.0 หรือ 3.0" />
                  <span class="muted" style="font-size: 0.75rem; margin-top: 4px; display: block;">
                    ${isTh ? 'มหาวิทยาลัยแนะนำ 0% สำหรับการประเมิน 1 ปี หรือ 3.0% ตามเกณฑ์ธนาคารแห่งประเทศไทย' : 'Recommended: 0% for 1-year analysis, or 3.0% benchmarked to central bank rates.'}
                  </span>
                </div>

                <div class="field">
                  <label class="field-label">${t('field_assessment_scope', 'ขอบเขตช่วงเวลาประเมิน (เดือน)')}</label>
                  <select name="assessment_months" class="input">
                    <option value="" ${!project.assessment_months ? 'selected' : ''}>${t('scope_full_year', 'เต็มปี (12 เดือน / มาตรฐาน)')}</option>
                    <option value="6" ${project.assessment_months === 6 ? 'selected' : ''}>${t('scope_6_months', '6 เดือน (ระหว่างกาล เช่น อาคารธาราบำบัด)')}</option>
                    <option value="9" ${project.assessment_months === 9 ? 'selected' : ''}>${t('scope_9_months', '9 เดือน (ระหว่างกาล)')}</option>
                    <option value="12" ${project.assessment_months === 12 ? 'selected' : ''}>${t('scope_12_months', '12 เดือน (ปีงบประมาณ)')}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">${t('field_discount_basis', 'เกณฑ์อัตราคิดลด')}</label>
                  <select name="discount_rate_basis" class="input">
                    <option value="real" ${project.discount_rate_basis === 'real' ? 'selected' : ''}>${t('discount_basis_real', 'Real (ปรับผลกระทบเงินเฟ้อแล้ว)')}</option>
                    <option value="nominal" ${project.discount_rate_basis === 'nominal' ? 'selected' : ''}>${t('discount_basis_nominal', 'Nominal (ตามอัตราตลาด)')}</option>
                  </select>
                </div>
              </div>

              <div class="form-grid" style="margin-top: var(--sp-md);">
                <div class="field">
                  <label class="field-label">${t('field_inv_basis', 'เกณฑ์การคิดมูลค่าเงินลงทุน')}</label>
                  <select name="investment_basis" class="input">
                    <option value="nominal" ${project.investment_basis === 'nominal' ? 'selected' : ''}>${t('inv_basis_nominal', 'Nominal Cash (ตามยอดเงินสดจริง)')}</option>
                    <option value="present_value" ${project.investment_basis === 'present_value' ? 'selected' : ''}>${t('inv_basis_pv', 'Present Value (คิดลดเงินลงทุนในอนาคต)')}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">${t('field_include_inkind', 'รวมทรัพยากร In-Kind / อาสาสมัคร?')}</label>
                  <select name="include_in_kind" class="input">
                    <option value="1" ${project.include_in_kind ? 'selected' : ''}>${t('opt_yes_inkind', 'ใช่ (รวมเวลาอาสาสมัครและทรัพยากรบริจาค)')}</option>
                    <option value="0" ${!project.include_in_kind ? 'selected' : ''}>${t('opt_no_inkind', 'ไม่รวม (คิดเฉพาะค่าใช้จ่ายเงินสดจริง)')}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">${t('field_rationale', 'แหล่งอ้างอิงอัตราคิดลด')}</label>
                  <input type="text" name="discount_rate_source" class="input" value="${escapeHtml(project.discount_rate_source || '')}" placeholder="e.g. Bank of Thailand benchmark" />
                </div>

                <div class="field">
                  <label class="field-label">${t('field_currency', 'สกุลเงิน')}</label>
                  <input type="text" name="currency" class="input" value="${escapeHtml(project.currency || 'THB')}" maxlength="3" required />
                </div>
                <input type="hidden" name="country" value="${escapeHtml(project.country || 'Thailand')}" />
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Itemized Investment Costs Table Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">${isTh ? 'รายการเงินลงทุนและค่าใช้จ่าย (Investment & Resource Inputs)' : 'Investment & Cost Registry'}</h2>
            <p class="muted" style="font-size: 0.8125rem;">
              ${isTh ? 'บันทึกค่าใช้จ่ายจริง งบประมาณดำเนินงาน หรือสิ่งสนับสนุนที่ใช้ในโครงการ' : 'Itemized financial outlays, staff costs, and volunteer inputs'}
            </p>
          </div>
          <button class="btn btn-primary" id="btnAddCost">${icons.plus} ${t('btn_add_cost', 'เพิ่มรายการค่าใช้จ่าย / เงินลงทุน')}</button>
        </div>

        <div style="background: var(--surface-soft); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.8125rem; margin-bottom: var(--sp-md); border-left: 3px solid var(--accent);">
          💡 <strong>${isTh ? 'คำแนะนำ:' : 'Tip:'}</strong> ${isTh ? 'เงินลงทุนนับรวมงบประมาณที่ได้รับจากคณะ, มหาวิทยาลัย หรือแหล่งทุนภายนอก โดยสามารถระบุผู้สนับสนุน (Funder) เพื่อเชื่อมโยงกับผู้มีส่วนได้ส่วนเสียในขั้นตอนที่ 2 ได้โดยอัตโนมัติ' : 'Funding lines can be linked to stakeholder groups (S1-S4) so you only need to enter them once.'}
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('col_cost_cat', 'หมวดหมู่')}</th>
                <th>${t('col_cost_desc', 'รายละเอียดค่าใช้จ่าย')}</th>
                <th>${t('in_funder', 'แหล่งทุน / ผู้สนับสนุน')}</th>
                <th>${t('col_cost_type', 'ลักษณะ')}</th>
                <th class="num">${t('col_cost_year', 'ปี')}</th>
                <th class="num">${t('col_cost_amount', 'จำนวนเงิน')} (${project.currency})</th>
                <th class="num">${t('col_cost_pv', 'มูลค่าปัจจุบัน (PV)')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="costTableBody">
              ${
                costs.length === 0
                  ? `<tr><td colspan="8" class="empty" style="padding: var(--sp-xl); text-align: center;">
                      <div style="font-size: 1.5rem; margin-bottom: 6px;">💰</div>
                      <div class="strong" style="margin-bottom: 4px;">${isTh ? 'ยังไม่มีรายการเงินลงทุน' : 'No investment costs recorded yet'}</div>
                      <div class="muted" style="font-size: 0.8125rem; margin-bottom: 12px;">${isTh ? 'คลิกปุ่ม "เพิ่มรายการค่าใช้จ่าย / เงินลงทุน" เพื่อบันทึกต้นทุนโครงการแรกของคุณ' : 'Click "Add Cost Item" to add project expenses'}</div>
                    </td></tr>`
                  : costs
                      .map(
                        (c) => `
                <tr data-id="${c.id}">
                  <td><span class="badge badge-planned">${escapeHtml(costCategoryLabel(c.category, isTh))}</span></td>
                  <td class="strong">
                    ${escapeHtml(c.description)}
                    ${c.period_label ? `<span class="badge badge-integrated" style="font-size: 0.6875rem; margin-left: 6px;">${escapeHtml(c.period_label)}</span>` : ''}
                  </td>
                  <td>${c.stakeholder_id && stkById[c.stakeholder_id] ? `<span class="badge badge-integrated">${escapeHtml(stkById[c.stakeholder_id].group_code || '')}</span> ${escapeHtml(stkById[c.stakeholder_id].name)}` : '<span class="muted">–</span>'}</td>
                  <td>${c.is_cash ? (isTh ? 'เงินสด' : 'Cash') : `<span class="muted">${t('cost_cat_inkind', 'In-Kind / อาสาสมัคร')}</span>`}</td>
                  <td class="num">${t('year', 'ปีที่')} ${c.year}</td>
                  <td class="num strong">${formatBaht(c.amount * (c.exchange_rate || 1))}</td>
                  <td class="num">${c.present_value !== undefined ? formatBaht(c.present_value) : '-'}</td>
                  <td>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-icon" data-edit-cost="${c.id}" title="${t('edit', 'Edit')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button class="btn-icon" data-remove-cost="${c.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
                    </div>
                  </td>
                </tr>
              `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(1, {
        canProceed: true,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ระบุผู้มีส่วนได้ส่วนเสีย (Step 2) →'
          : 'Save & Continue: Stakeholders (Step 2) →',
      })}
    </div>
  `;

  // Accordion toggle
  const toggleBtn = document.getElementById('btnToggleAdvancedScope');
  const advContent = document.getElementById('advancedScopeContent');
  const advIcon = document.getElementById('advancedAccordionIcon');
  toggleBtn?.addEventListener('click', () => {
    const isHidden = advContent.hidden;
    advContent.hidden = !isHidden;
    advIcon.textContent = isHidden
      ? `▲ ${isTh ? 'ซ่อนการตั้งค่า' : 'Collapse'}`
      : `▼ ${isTh ? 'คลิกเพื่อดูหรือแก้ไข' : 'Expand'}`;
  });

  // Attach event handlers
  document.getElementById('btnSaveProjectDetails')?.addEventListener('click', async () => {
    const form = document.getElementById('projectScopeForm');
    if (!form) return;

    const changes = {
      name: form.name.value.trim(),
      organization_name: form.organization_name.value.trim(),
      category: form.category.value.trim(),
      country: form.country.value.trim(),
      evaluation_type: form.evaluation_type.value,
      analysis_period_years: parseInt(form.analysis_period_years.value, 10),
      assessment_months: form.assessment_months.value
        ? parseInt(form.assessment_months.value, 10)
        : null,
      discount_rate:
        form.discount_rate.value !== '' ? parseFloat(form.discount_rate.value) / 100 : 0.0,
      discount_rate_basis: form.discount_rate_basis.value,
      investment_basis: form.investment_basis.value,
      include_in_kind: form.include_in_kind.value === '1',
      discount_rate_source: form.discount_rate_source.value.trim(),
      currency: form.currency.value.trim().toUpperCase(),
    };

    try {
      await updateProject(changes);
      renderStep1(container);
    } catch (err) {
      alert(`Error updating project: ${err.message}`);
    }
  });

  document.getElementById('btnAddCost')?.addEventListener('click', () => {
    openAddCostModal({
      project,
      onAdded: () => renderStep1(container),
    });
  });

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
        title: t('delete', 'Delete Cost Entry'),
        message: t('confirm_delete', 'Are you sure you want to remove this cost entry?'),
        onConfirm: async () => {
          await removeCost(costId);
          renderStep1(container);
        },
      });
    });
  });

  attachWizardFooterEvents(container);
}

function costCategoryLabel(cat, isTh) {
  const mapTh = {
    capex: 'ครุภัณฑ์ / อุปกรณ์ / สถานที่',
    opex: 'ค่าใช้จ่ายดำเนินงาน',
    delivery: 'ค่ากิจกรรมและการจัดอบรม',
    administration: 'ค่าตอบแทนบุคลากร / วิทยากร',
    in_kind: 'อาสาสมัคร / สิ่งสนับสนุน (In-Kind)',
    other: 'ทรัพยากรอื่นๆ',
  };
  const mapEn = {
    capex: 'Capital / Equipment (Capex)',
    opex: 'Operating Expenditure (Opex)',
    delivery: 'Program Delivery',
    administration: 'Personnel & Admin',
    in_kind: 'Volunteer & In-Kind',
    other: 'Other Resources',
  };
  return isTh ? mapTh[cat] || cat : mapEn[cat] || cat;
}

function openAddCostModal({ project, initialData = null, onAdded }) {
  const { stakeholders } = getState();
  const isEdit = !!initialData;
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const v = (k, d = '') =>
    initialData && initialData[k] !== null && initialData[k] !== undefined ? initialData[k] : d;
  const funderGroups = GROUPS.filter((g) => g.fundsByDefault);

  const formHtml = `
    <form id="addCostForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
      <div class="field">
        <label class="field-label">${isTh ? 'รายละเอียดค่าใช้จ่าย *' : 'Expense Description *'}</label>
        <input type="text" name="description" class="input" required value="${escapeHtml(v('description'))}" placeholder="${isTh ? 'เช่น ค่าวิทยากรและเวชภัณฑ์ตรวจสายตา' : 'e.g. Tutoring honorarium and supplies'}" />
      </div>

      <div class="field">
        <label class="field-label">${isTh ? 'แหล่งทุน / ผู้สนับสนุน' : 'Funder / Resource Source'} <span class="muted">(${isTh ? 'ระบุเพื่อเชื่อมโยงกับผู้มีส่วนได้ส่วนเสีย — ไม่บังคับ' : 'optional'})</span></label>
        <select name="stakeholder_id" class="input">
          <option value="">${isTh ? '— ไม่ได้ระบุ —' : '— not specified —'}</option>
          ${stakeholderOptionsHtml(stakeholders, v('stakeholder_id', ''), escapeHtml)}
          <option value="__new__">${isTh ? '＋ เพิ่มผู้มีส่วนได้ส่วนเสียใหม่…' : '＋ Add a new stakeholder…'}</option>
        </select>
      </div>
      <div class="in-grid" id="newFunderBox" hidden>
        <label class="field in-w6"><span class="field-label">${isTh ? 'ชื่อผู้มีส่วนได้ส่วนเสียใหม่ *' : 'New stakeholder name *'}</span>
          <input class="input" name="new_name" placeholder="${isTh ? 'เช่น เทศบาลตำบล, สสส.' : 'e.g. Local municipality'}" /></label>
        <label class="field in-w6"><span class="field-label">${isTh ? 'กลุ่ม' : 'Group'}</span>
          <select class="input" name="new_group">${funderGroups.map((g) => `<option value="${g.key}" ${g.key === 'project_supporter' ? 'selected' : ''}>${escapeHtml(groupLabel(g))}</option>`).join('')}</select></label>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field-label">${isTh ? 'หมวดหมู่ค่าใช้จ่าย *' : 'Cost Category *'}</label>
          <select name="category" class="input" required>
            ${[
              ['opex', isTh ? 'ค่าใช้จ่ายดำเนินงานโครงการ (Opex)' : 'Operating Expenditure (Opex)'],
              [
                'delivery',
                isTh ? 'ค่ากิจกรรมและการจัดบริการ (Delivery)' : 'Program Delivery & Activity',
              ],
              [
                'administration',
                isTh ? 'ค่าตอบแทนบุคลากร / วิทยากร (Personnel)' : 'Personnel & Honorarium',
              ],
              [
                'capex',
                isTh ? 'ค่าครุภัณฑ์ / อุปกรณ์ / สถานที่ (Capex)' : 'Capital & Equipment (Capex)',
              ],
              [
                'in_kind',
                isTh
                  ? 'สิ่งสนับสนุนที่ไม่ใช่ตัวเงิน / อาสาสมัคร'
                  : 'Volunteer & In-Kind Contribution',
              ],
              ['other', isTh ? 'ทรัพยากรอื่นๆ' : 'Other Resources'],
            ]
              .map(
                ([k, l]) =>
                  `<option value="${k}" ${v('category', 'opex') === k ? 'selected' : ''}>${l}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'จำนวนเงิน *' : 'Amount *'} (${project.currency})</label>
          <input type="text" inputmode="decimal" name="amount" class="input" required value="${v('amount')}" placeholder="50000" />
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'ปีที่เกิดค่าใช้จ่าย (Year) *' : 'Incurred Year *'}</label>
          <input type="number" name="year" min="0" max="${project.analysis_period_years || 5}" class="input" value="${v('year', 0)}" required />
          <span class="muted" style="font-size: 0.75rem; margin-top: 2px; display: block;">${isTh ? 'ปีที่ 0 = ปีเริ่มต้นโครงการ' : 'Year 0 = Project start'}</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">${isTh ? 'ลักษณะของรายการ' : 'Nature of Input'}</label>
          <select name="is_cash" class="input">
            <option value="1" ${initialData && !initialData.is_cash ? '' : 'selected'}>${isTh ? 'การจ่ายเงินสดจริง (Direct Cash Outlay)' : 'Direct Cash Expenditure'}</option>
            <option value="0" ${initialData && !initialData.is_cash ? 'selected' : ''}>${isTh ? 'สิ่งสนับสนุนที่ไม่ใช่ตัวเงิน / อาสาสมัคร (Non-Cash / In-Kind)' : 'Non-Cash / In-Kind Contribution'}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'แหล่งหลักฐานอ้างอิง' : 'Evidence / Source Citation'}</label>
          <input type="text" name="evidence_source" class="input" value="${escapeHtml(v('evidence_source'))}" placeholder="${isTh ? 'เช่น ใบเสร็จรับเงิน, สรุปงบประมาณประจำปี' : 'e.g. Budget report FY2026'}" />
        </div>
        <div class="field">
          <label class="field-label">${isTh ? 'ป้ายกำกับงวดเวลา (ถ้ามี)' : 'Period Label (Optional)'}</label>
          <input type="text" name="period_label" class="input" value="${escapeHtml(v('period_label'))}" placeholder="e.g. Y0, 6 เดือน" />
        </div>
      </div>
      <div id="costModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
    ${isEdit ? '' : `<button class="btn btn-secondary" id="btnSaveCostNext">${isTh ? 'บันทึกและเพิ่มรายการต่อไป' : 'Save & Add Next'}</button>`}
    <button class="btn btn-primary" id="btnSaveCost">${isTh ? 'บันทึกรายการ' : 'Save Expense'}</button>
  `;

  openModal({
    title: isEdit
      ? isTh
        ? 'แก้ไขรายการเงินลงทุน'
        : 'Edit Investment Cost'
      : isTh
        ? 'เพิ่มรายการค่าใช้จ่าย / เงินลงทุน'
        : 'Add Investment Cost',
    body: formHtml,
    footer,
  });

  const form = document.getElementById('addCostForm');
  const errBox = document.getElementById('costModalError');
  const box = document.getElementById('newFunderBox');
  const showErr = (m) => {
    errBox.textContent = m;
    errBox.style.display = 'block';
  };

  form.stakeholder_id.addEventListener('change', () => {
    box.hidden = form.stakeholder_id.value !== '__new__';
    if (!box.hidden) form.new_name.focus();
  });
  form.category.addEventListener('change', () => {
    if (form.category.value === 'in_kind') form.is_cash.value = '0';
  });
  form.is_cash.addEventListener('change', () => {
    if (form.is_cash.value === '0' && form.category.value !== 'in_kind')
      form.category.value = 'in_kind';
  });

  const save = async (andNext) => {
    errBox.style.display = 'none';
    const amount = parseFloat(String(form.amount.value).replace(/[,\s]/g, ''));
    const desc = form.description.value.trim();
    if (!desc || Number.isNaN(amount) || amount < 0) {
      showErr(t('required', 'Please fill in description and valid amount.'));
      return;
    }
    const btns = document.querySelectorAll('#btnSaveCost, #btnSaveCostNext');
    btns.forEach((b) => (b.disabled = true));
    try {
      let funderId =
        form.stakeholder_id.value === ''
          ? null
          : form.stakeholder_id.value === '__new__'
            ? '__new__'
            : Number(form.stakeholder_id.value);
      if (funderId === '__new__') {
        const name = form.new_name.value.trim();
        if (!name) throw new Error(t('required', 'Please enter a stakeholder name.'));
        const g = groupByKey(form.new_group.value);
        const created = await addStakeholder({
          name,
          stakeholder_group: g.key,
          group_code: nextGroupCode(getState().stakeholders, g),
          count_unit: g.unit,
          category: 'Government agencies',
        });
        funderId = created.id;
      }
      const data = {
        description: desc,
        category: form.category.value,
        amount,
        currency: project.currency,
        year: parseInt(form.year.value, 10),
        is_cash: form.is_cash.value === '1',
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
