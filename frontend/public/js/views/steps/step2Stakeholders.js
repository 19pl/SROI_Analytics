/**
 * Step 2: Stakeholders AND their funding — entered once, laid out like the Excel (S1–S4 groups).
 * Guided, beginner-friendly experience with progressive micro-steps.
 * Features a primary Dropdown for "ใครได้รับผลประโยชน์" with an "อื่นๆ" button/text reveal.
 * Fully bilingual (Thai & English).
 */

import { getState, saveStakeholderWithInputs, removeStakeholder } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import {
  GROUPS,
  UNIT_SUGGESTIONS,
  groupByKey,
  groupLabel,
  nextGroupCode,
  parseAmount,
} from '../../utils/stakeholderGroups.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';

export const BENEFICIARY_PRESETS = [
  { id: 'students', th: 'นิสิต / นักศึกษา', en: 'Students & Learners', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'patients', th: 'ผู้ป่วย / ผู้รับบริการสุขภาพ', en: 'Patients & Healthcare Clients', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'elderly', th: 'ผู้สูงอายุในชุมชน', en: 'Elderly Community Residents', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'residents', th: 'ประชาชน / ชุมชนในพื้นที่', en: 'Local Residents & Community', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'farmers', th: 'เกษตรกร / กลุ่มเกษตรกรรม', en: 'Farmers & Agricultural Groups', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'school', th: 'ครู / นักเรียนในโรงเรียนเครือข่าย', en: 'School Teachers & Pupils', group: 'primary_beneficiary', unit: 'คน' },
  { id: 'business', th: 'ผู้ประกอบการ / วิสาหกิจชุมชน', en: 'Local Enterprises & Businesses', group: 'other_agency', unit: 'แห่ง' },
  { id: 'operators', th: 'อาจารย์ / นักวิจัย / ทีมงานโครงการ', en: 'Project Team & Staff (S2)', group: 'project_operator', unit: 'คน' },
  { id: 'supporters', th: 'คณะ / ส่วนงานภายในมหาวิทยาลัย', en: 'Faculty / University Division (S3)', group: 'project_supporter', unit: 'คณะ' },
  { id: 'local_gov', th: 'องค์กรปกครองส่วนท้องถิ่น (อปท.) / รพ.สต.', en: 'Local Govt / Health Center (S4)', group: 'other_agency', unit: 'แห่ง' },
  { id: '__other__', th: '✏️ อื่นๆ (ระบุเอง...)', en: '✏️ Other (Specify...)', group: 'primary_beneficiary', unit: 'คน' },
];

const CATEGORIES = [
  'Students and learners',
  'Teachers and educational staff',
  'Local communities',
  'Employees and volunteers',
  'Beneficiary households',
  'Local businesses',
  'Government agencies',
  'Ecosystems and environmental resources',
];

export function renderStep2(container) {
  const { project, stakeholders, costs } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const fundingOf = (id) =>
    costs
      .filter((c) => c.stakeholder_id === id)
      .reduce((n, c) => n + Number(c.amount) * Number(c.exchange_rate || 1), 0);
  const fundingCount = (id) => costs.filter((c) => c.stakeholder_id === id).length;
  const unlinked = costs.filter((c) => !c.stakeholder_id);

  const rowHtml = (s) => `
    <tr data-id="${s.id}">
      <td>${s.group_code ? `<span class="badge badge-integrated">${escapeHtml(s.group_code)}</span>` : ''}</td>
      <td>
        <div class="strong" style="color: var(--on-background);">${escapeHtml(s.name)}</div>
        ${s.role_in_project ? `<div class="muted" style="font-size: 0.75rem;">${escapeHtml(s.role_in_project)}</div>` : ''}
      </td>
      <td class="num">${s.estimated_count !== null && s.estimated_count !== undefined ? `${Number(s.estimated_count).toLocaleString()} <span class="muted">${escapeHtml(s.count_unit || '')}</span>` : '<span class="muted">–</span>'}</td>
      <td class="num">${fundingCount(s.id) ? `<span class="strong">${escapeHtml(project.currency)} ${formatBaht(fundingOf(s.id))}</span> <span class="muted">(${fundingCount(s.id)})</span>` : '<span class="muted">–</span>'}</td>
      <td class="num">${s.outcome_count || 0}</td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn-icon" data-edit-stakeholder="${s.id}" title="${t('edit', 'Edit')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="btn-icon" data-remove-stakeholder="${s.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
        </div>
      </td>
    </tr>`;

  const groupDescriptions = {
    primary_beneficiary: {
      th_title: 'S1: กลุ่มเป้าหมาย / ผู้ได้รับผลประโยชน์หลัก',
      en_title: 'S1: Primary Beneficiaries',
      th_desc: 'ผู้รับประโยชน์โดยตรง (นิสิต, ประชาชน, ผู้สูงอายุ, ผู้ป่วย)',
      en_desc: 'Direct recipients of project services.',
    },
    project_operator: {
      th_title: 'S2: คณะทำงานและผู้ดำเนินงานโครงการ',
      en_title: 'S2: Project Operators & Staff',
      th_desc: 'อาจารย์ นักวิจัย และทีมงานผู้จัดกิจกรรม',
      en_desc: 'Staff and team members who deliver project activities.',
    },
    project_supporter: {
      th_title: 'S3: หน่วยงานสนับสนุนภายในมหาวิทยาลัย',
      en_title: 'S3: Institutional Supporters',
      th_desc: 'คณะ ภาควิชา หรือกองทุนภายในมหาวิทยาลัย',
      en_desc: 'Faculties or university divisions providing support.',
    },
    other_agency: {
      th_title: 'S4: หน่วยงานภายนอกและภาคีเครือข่าย',
      en_title: 'S4: External Partners & Agencies',
      th_desc: 'อปท., รพ.สต., ชุมชน, หรือแหล่งทุนภายนอก',
      en_desc: 'Local government authorities, health clinics, or partners.',
    },
  };

  const groupSection = (g) => {
    const list = stakeholders.filter((s) => s.stakeholder_group === g.key);
    const total = list.reduce((n, s) => n + fundingOf(s.id), 0);
    const info = groupDescriptions[g.key] || {
      th_title: groupLabel(g),
      en_title: groupLabel(g),
      th_desc: '',
      en_desc: '',
    };

    if (list.length === 0) {
      return `
        <div class="card in-group" data-group="${g.key}" style="padding: var(--sp-md); background: var(--surface-soft); border: 1px dashed var(--outline);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-sm);">
            <div>
              <strong style="font-size: 0.875rem; color: var(--on-background);">${escapeHtml(isTh ? info.th_title : info.en_title)}</strong>
              <div class="muted" style="font-size: 0.75rem;">${escapeHtml(isTh ? info.th_desc : info.en_desc)}</div>
            </div>
            <button class="btn btn-secondary" data-add-in="${g.key}" style="height: 32px; font-size: 0.75rem; padding: 0 10px;">
              ${icons.plus} ${isTh ? `+ เพิ่มในกลุ่ม ${g.code}` : `+ Add to ${g.code}`}
            </button>
          </div>
        </div>`;
    }

    return `
      <section class="card in-group" data-group="${g.key}">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title" style="font-size: 1rem;">${escapeHtml(isTh ? info.th_title : info.en_title)}</h2>
            <p class="muted" style="font-size: 0.75rem; margin-bottom: 0;">${escapeHtml(isTh ? info.th_desc : info.en_desc)}</p>
          </div>
          <div style="display: flex; gap: var(--sp-md); align-items: center; flex-wrap: wrap;">
            ${total ? `<span class="muted" style="font-size: 0.8125rem;">${t('in_funding_total', 'เงินสนับสนุนรวม')}: <b>${escapeHtml(project.currency)} ${formatBaht(total)}</b></span>` : ''}
            <button class="btn btn-secondary" data-add-in="${g.key}" style="height: 32px; font-size: 0.8125rem;">${icons.plus} ${isTh ? `+ เพิ่มในกลุ่ม ${g.code}` : `+ Add to ${g.code}`}</button>
          </div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr>
            <th>${t('in_code', 'รหัส')}</th><th>${t('in_name_short', 'ผู้มีส่วนได้ส่วนเสีย')}</th>
            <th class="num">${t('in_count', 'จำนวนประชากร')}</th><th class="num">${t('in_funding_short', 'งบสนับสนุน')}</th>
            <th class="num">${t('in_col_outcomes', 'ผลลัพธ์ที่เชื่อมโยง')}</th><th></th>
          </tr></thead>
          <tbody>${list.map(rowHtml).join('')}</tbody>
        </table></div>
      </section>`;
  };

  const loose = stakeholders.filter((s) => !groupByKey(s.stakeholder_group));

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-lg);">
      <!-- Clean, Short Guidance Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-md);">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 2: ระบุผู้มีส่วนได้ส่วนเสีย (Stakeholders)' : 'Step 2: Stakeholders'}
          </h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            ${isTh ? 'ระบุว่าใครได้รับผลประโยชน์ หรือใครเป็นผู้สนับสนุนโครงการของคุณ' : 'Identify primary beneficiaries and supporting partners.'}
          </p>
        </div>
        <button class="btn btn-primary" id="btnTopAddStakeholder" style="font-weight: 600;">
          ${icons.plus} ${isTh ? '+ เพิ่มผู้มีส่วนได้ส่วนเสีย' : '+ Add Stakeholder'}
        </button>
      </div>

      ${
        unlinked.length
          ? `<div class="alert alert-warning in-banner" style="font-size: 0.8125rem;">
              ${isTh ? 'มีรายการเงินลงทุนที่ยังไม่ได้เชื่อมโยงกับผู้สนับสนุน' : 'Investment items not linked to any stakeholder'}: <b>${unlinked.length}</b>
              — <a href="#/wizard/step-1">${isTh ? 'เลือกผู้สนับสนุนในขั้นตอนที่ 1' : 'Link funders in Step 1'}</a>
            </div>`
          : ''
      }

      <!-- Groups S1 to S4 -->
      <div class="stack" style="gap: var(--sp-md);">
        ${GROUPS.map(groupSection).join('')}
      </div>

      ${
        loose.length
          ? `<section class="card in-group">
              <div class="card-head"><div><h2 class="card-title">${t('grp_none', 'Unclassified')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">${t('in_loose_hint', 'Entries without a group.')}</p></div></div>
              <div class="table-wrap"><table class="table"><tbody>${loose.map(rowHtml).join('')}</tbody></table></div>
            </section>`
          : ''
      }

      <!-- Sticky Wizard Footer Navigation -->
      ${wizardFooterHtml(2, {
        canProceed: stakeholders.length > 0,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ระบุผลลัพธ์ที่เกิดขึ้น (Step 3) →'
          : 'Continue: Outcomes & Changes (Step 3) →',
      })}
    </div>`;

  const refresh = () => renderStep2(container);

  document.getElementById('btnTopAddStakeholder')?.addEventListener('click', () => {
    openStakeholderModal({ defaultGroup: 'primary_beneficiary', onSaved: refresh });
  });

  container
    .querySelectorAll('[data-add-in]')
    .forEach((btn) =>
      btn.addEventListener('click', () =>
        openStakeholderModal({ defaultGroup: btn.dataset.addIn, onSaved: refresh }),
      ),
    );
  container.querySelectorAll('[data-edit-stakeholder]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const target = stakeholders.find((s) => s.id === Number(btn.dataset.editStakeholder));
      if (target) openStakeholderModal({ initialData: target, onSaved: refresh });
    }),
  );
  container.querySelectorAll('[data-remove-stakeholder]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const sId = Number(btn.dataset.removeStakeholder);
      const n = fundingCount(sId);
      confirmModal({
        title: t('delete', 'Delete'),
        message: n
          ? isTh
            ? 'ลบผู้มีส่วนได้ส่วนเสียนี้หรือไม่? รายการเงินสนับสนุนจะยังคงอยู่ในขั้นตอนที่ 1 แต่จะกลายเป็นแบบไม่ระบุผู้สนับสนุน'
            : 'Delete this stakeholder? Its funding lines remain in Step 1 as unlinked.'
          : t(
              'confirm_delete',
              'Are you sure you want to delete this stakeholder? Any associated outcomes will need to be re-assigned.',
            ),
        onConfirm: async () => {
          try {
            await removeStakeholder(sId);
            getState().costs.forEach((c) => {
              if (c.stakeholder_id === sId) c.stakeholder_id = null;
            });
            refresh();
          } catch (err) {
            alert(`${t('in_cannot_delete', 'Cannot delete')}: ${err.message}`);
          }
        },
      });
    }),
  );

  attachWizardFooterEvents(container);
}

function fundingRowHtml(row, idx, project) {
  const k = row.key;
  const lang = getLanguage();
  const isTh = lang !== 'en';

  return `
    <div class="in-fund-row" data-key="${k}">
      <span class="in-fund-n">${idx + 1}</span>
      <label class="field in-f-desc"><span class="field-label">${isTh ? 'รายการงบประมาณ / สิ่งสนับสนุน' : 'Resource / item'}</span>
        <input class="input" name="desc" value="${escapeHtml(row.description || '')}" placeholder="${isTh ? 'เช่น งบประมาณจากคณะ, ค่าเดินทาง' : 'e.g. Budget from faculty'}" /></label>
      <label class="field in-f-amt"><span class="field-label">${isTh ? 'จำนวนเงิน' : 'Amount'} (${escapeHtml(project.currency)})</span>
        <input class="input" name="amount" type="text" inputmode="decimal" autocomplete="off" value="${row.amount ?? ''}" placeholder="0" /></label>
      <label class="field in-f-year"><span class="field-label">${isTh ? 'ปีที่เกิด (0 = ปีแรก)' : 'Year (0 = Y0)'}</span>
        <input class="input" name="year" type="number" min="0" max="${project.analysis_period_years || 5}" value="${row.year ?? 0}" /></label>
      <label class="field in-f-src"><span class="field-label">${isTh ? 'แหล่งหลักฐาน' : 'Basis / source'}</span>
        <input class="input" name="source" value="${escapeHtml(row.evidence_source || '')}" placeholder="${isTh ? 'เช่น สรุปงบประมาณจริง' : 'How calculated / source'}" /></label>
      <label class="in-f-kind" title="${isTh ? 'เลือกหากไม่ใช่เงินสด เช่น เวลาอาสาสมัคร สถานที่ อุปกรณ์' : 'Tick when not cash (volunteer time, venue)'}"><input type="checkbox" name="inkind" ${row.category === 'in_kind' ? 'checked' : ''} /> ${isTh ? 'In-kind' : 'In-kind'}</label>
      <button type="button" class="btn-icon in-f-del" data-del-row="${k}" title="${t('delete', 'Delete')}" aria-label="${t('delete', 'Delete')}">✕</button>
    </div>`;
}

/**
 * Progressive Micro-Step Stakeholder Modal
 * Step 1: Who Benefits? (Dropdown + "อื่นๆ" reveal)
 * Step 2: Population count & Unit
 * Step 3: Optional Role & Funding lines
 */
function openStakeholderModal({ initialData = null, defaultGroup = null, onSaved }) {
  const { project, stakeholders, costs } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';
  let editId = initialData?.id ?? null;
  let keySeq = 0;
  const newKey = () => `r${++keySeq}`;

  let group = groupByKey(initialData?.stakeholder_group) || groupByKey(defaultGroup) || groupByKey('primary_beneficiary');
  let codeTouched = !!initialData?.group_code;
  let unitTouched = !!initialData?.count_unit;

  // Determine if initial name matches any preset
  const matchedPreset = initialData
    ? BENEFICIARY_PRESETS.find((p) => p.th === initialData.name || p.en === initialData.name)
    : (defaultGroup ? BENEFICIARY_PRESETS.find(p => p.group === defaultGroup) : BENEFICIARY_PRESETS[0]);
  const initialPresetVal = matchedPreset ? matchedPreset.id : (initialData ? '__other__' : BENEFICIARY_PRESETS[0].id);

  const rows = initialData
    ? costs
        .filter((c) => c.stakeholder_id === initialData.id)
        .map((c) => ({
          key: newKey(),
          id: c.id,
          description: c.description,
          amount: c.amount,
          year: c.year,
          category: c.category,
          is_cash: c.is_cash,
          evidence_source: c.evidence_source,
        }))
    : [];

  const body = `
    <div class="stack" style="gap: var(--sp-md);">
      <!-- Progressive Step Indicator Bar -->
      <div style="display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--outline); padding-bottom: 12px; margin-bottom: 4px;">
        <span id="stkStepBadge1" class="badge badge-production" style="font-weight: 700; font-size: 0.8125rem; padding: 4px 10px;">
          1. ${isTh ? 'ใครได้รับผลประโยชน์' : '1. Who Benefits'}
        </span>
        <span class="muted" style="font-size: 0.75rem;">➔</span>
        <span id="stkStepBadge2" class="badge" style="background: var(--surface-soft); color: var(--muted); font-size: 0.8125rem; padding: 4px 10px;">
          2. ${isTh ? 'จำนวนประชากร' : '2. Population'}
        </span>
        <span class="muted" style="font-size: 0.75rem;">➔</span>
        <span id="stkStepBadge3" class="badge" style="background: var(--surface-soft); color: var(--muted); font-size: 0.8125rem; padding: 4px 10px;">
          3. ${isTh ? 'งบสนับสนุน (ถ้ามี)' : '3. Funding (Optional)'}
        </span>
      </div>

      <form id="stakeholderForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
        <!-- ==================== PANE 1: WHO BENEFITS ==================== -->
        <div id="stkPane1" class="stack" style="gap: var(--sp-md);">
          <div class="field">
            <label class="field-label" style="font-size: 0.9375rem; font-weight: 700; color: var(--on-background);">
              ${isTh ? '1. ใครคือผู้ได้รับผลประโยชน์จากโครงการ? *' : '1. Who benefits from this project? *'}
            </label>
            
            <div style="display: flex; gap: var(--sp-sm); align-items: center;">
              <select id="presetSelect" class="input" style="flex: 1; font-size: 0.9375rem;">
                ${BENEFICIARY_PRESETS.map((p) => `
                  <option value="${p.id}" ${initialPresetVal === p.id ? 'selected' : ''}>
                    ${escapeHtml(isTh ? p.th : p.en)}
                  </option>
                `).join('')}
              </select>
              <button type="button" class="btn btn-secondary" id="btnPickOther" style="font-size: 0.8125rem;">
                ✏️ ${isTh ? 'อื่นๆ' : 'Other'}
              </button>
            </div>
          </div>

          <!-- Custom Name Field (Reveals when "อื่นๆ" is active) -->
          <div id="customNameRow" class="field" style="display: ${initialPresetVal === '__other__' ? 'grid' : 'none'};">
            <label class="field-label" style="color: var(--primary); font-weight: 600;">
              ${isTh ? 'ระบุชื่อผู้ได้รับผลประโยชน์ *' : 'Specify Custom Beneficiary Name *'}
            </label>
            <input type="text" id="customNameInput" name="name" class="input" value="${escapeHtml(initialData?.name || '')}" placeholder="${isTh ? 'เช่น ผู้ดูแลผู้ป่วยติดเตียง, ชมรมจิตอาสา...' : 'e.g. Caregivers, Volunteer club...'}" />
          </div>

          <!-- Group Assignment S1-S4 (Compact) -->
          <div class="field" style="margin-top: var(--sp-xs);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span class="field-label" style="font-size: 0.8125rem;">
                ${isTh ? 'ประเภทกลุ่มตามมาตรฐาน SROI (ระบบเลือกให้อัตโนมัติ)' : 'SROI Group Code'}
              </span>
              <span id="groupHintBadge" class="badge badge-planned" style="font-size: 0.75rem;">${group ? group.code : 'S1'}</span>
            </div>
            <div class="in-chips" id="groupChips" role="radiogroup" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
              ${GROUPS.map(
                (g) =>
                  `<label class="in-chip ${group?.key === g.key ? 'is-on' : ''}" style="padding: 6px 10px; font-size: 0.75rem;"><input type="radio" name="grp" value="${g.key}" ${group?.key === g.key ? 'checked' : ''} /><b>${g.code}</b> ${escapeHtml(groupLabel(g).replace(/^S\d\s*/, ''))}</label>`,
              ).join('')}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: var(--sp-sm);">
            <button type="button" class="btn btn-primary" id="btnNextToPane2" style="padding: 10px 22px;">
              ${isTh ? 'ต่อไป (ระบุจำนวนคน) ➔' : 'Next (Specify Population) ➔'}
            </button>
          </div>
        </div>

        <!-- ==================== PANE 2: HOW MANY ==================== -->
        <div id="stkPane2" class="stack" style="display: none; gap: var(--sp-md);">
          <div style="background: var(--surface-soft); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary); font-size: 0.875rem;">
            ${isTh ? 'ผู้ได้รับผลประโยชน์:' : 'Beneficiary:'} <strong id="pane2NameLabel" style="color: var(--primary);"></strong>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label" style="font-weight: 700;">
                ${isTh ? '2. จำนวนประชากรที่ได้รับผลกระทบ' : '2. Estimated Population Size'}
              </label>
              <input class="input" name="estimated_count" type="number" min="0" step="1" value="${initialData?.estimated_count ?? ''}" placeholder="${isTh ? 'เช่น 120' : 'e.g. 120'}" />
            </div>

            <div class="field">
              <label class="field-label">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
              <div style="display: flex; gap: 6px;">
                <select id="unitPresetSelect" class="input" style="flex: 1;">
                  ${['คน', 'ครัวเรือน', 'ราย', 'แห่ง', 'กลุ่ม', 'คณะ', '__other__'].map(u => `
                    <option value="${u}" ${(initialData?.count_unit === u || (!initialData?.count_unit && u === 'คน')) ? 'selected' : ''}>
                      ${u === '__other__' ? (isTh ? 'อื่นๆ (ระบุ)' : 'Other') : u}
                    </option>
                  `).join('')}
                </select>
                <input class="input" name="count_unit" id="customUnitInput" value="${escapeHtml(initialData?.count_unit || 'คน')}" style="flex: 1; display: none;" placeholder="${isTh ? 'ระบุหน่วย' : 'Unit'}" />
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label">${isTh ? 'บทบาทในโครงการ (ไม่บังคับ)' : 'Role in project (Optional)'}</label>
            <input class="input" name="role_in_project" value="${escapeHtml(initialData?.role_in_project || '')}" placeholder="${isTh ? 'เช่น เข้ารับการตรวจคัดกรองสายตา, อบรมอาชีพ' : 'e.g. Receives screening, attends training'}" />
          </div>

          <div class="form-grid" style="display: none;">
            <input class="input" name="group_code" value="${escapeHtml(initialData?.group_code || '')}" />
            <input class="input" name="description" value="${escapeHtml(initialData?.description || '')}" />
            <select name="category">${CATEGORIES.map((c) => `<option value="${c}" ${initialData?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
            <input name="evidence_source" value="${escapeHtml(initialData?.evidence_source || '')}" />
            <input name="expected_positive" value="${escapeHtml(initialData?.expected_positive || '')}" />
            <input name="expected_negative" value="${escapeHtml(initialData?.expected_negative || '')}" />
            <input name="overlap_notes" value="${escapeHtml(initialData?.overlap_notes || '')}" />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-sm);">
            <button type="button" class="btn btn-secondary" id="btnBackToPane1">
              ← ${isTh ? 'ย้อนกลับ' : 'Back'}
            </button>
            <div style="display: flex; gap: var(--sp-sm);">
              <button type="button" class="btn btn-secondary" id="btnNextToPane3">
                ${isTh ? 'ระบุงบสนับสนุน (ถ้ามี) ➔' : 'Funding Lines ➔'}
              </button>
              <button type="button" class="btn btn-primary" id="btnQuickSaveStk">
                ✓ ${isTh ? 'บันทึกข้อมูลทันที' : 'Save Stakeholder'}
              </button>
            </div>
          </div>
        </div>

        <!-- ==================== PANE 3: FUNDING & INPUTS (OPTIONAL) ==================== -->
        <div id="stkPane3" class="stack" style="display: none; gap: var(--sp-md);">
          <div style="background: var(--surface-soft); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary); font-size: 0.875rem;">
            ${isTh ? 'บันทึกงบประมาณที่กลุ่มนี้สนับสนุนโครงการ (ถ้ามี)' : 'Funding / resources provided (optional)'}
          </div>

          <section class="in-fund">
            <div class="in-fund-head">
              <div>
                <h3 style="font-size: 0.875rem; margin-bottom: 2px;">${isTh ? 'รายการงบประมาณหรือสิ่งสนับสนุน' : 'Funding / Resource Lines'}</h3>
                <p class="muted" style="font-size: 0.75rem; margin-bottom: 0;">${isTh ? 'ข้อมูลจะเชื่อมโยงไปยังขั้นตอนที่ 1 โดยอัตโนมัติ' : 'Automatically linked to Step 1 investment.'}</p>
              </div>
              <span class="in-fund-total muted" id="fundTotal"></span>
            </div>
            <div id="fundRows"></div>
            <button type="button" class="line-add" id="btnAddFund">＋ ${isTh ? 'เพิ่มรายการงบประมาณ / สิ่งสนับสนุน' : 'Add funding line'}</button>
          </section>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-sm); flex-wrap: wrap; gap: var(--sp-sm);">
            <button type="button" class="btn btn-secondary" id="btnBackToPane2">
              ← ${isTh ? 'ย้อนกลับ' : 'Back'}
            </button>
            <button type="button" class="btn btn-primary" id="btnFullSaveStk">
              ✓ ${isTh ? 'บันทึกข้อมูลผู้มีส่วนได้ส่วนเสีย' : 'Save All Details'}
            </button>
          </div>
        </div>

        <div id="stakeholderModalError" class="alert alert-danger" style="display: none;"></div>
      </form>
    </div>`;

  openModal({
    title: editId
      ? (isTh ? 'แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย' : 'Edit Stakeholder')
      : (isTh ? 'เพิ่มผู้มีส่วนได้ส่วนเสีย (Add Stakeholder)' : 'Add Stakeholder'),
    body,
    size: 'lg',
  });

  const form = document.getElementById('stakeholderForm');
  const errBox = document.getElementById('stakeholderModalError');
  const pane1 = document.getElementById('stkPane1');
  const pane2 = document.getElementById('stkPane2');
  const pane3 = document.getElementById('stkPane3');
  const badge1 = document.getElementById('stkStepBadge1');
  const badge2 = document.getElementById('stkStepBadge2');
  const badge3 = document.getElementById('stkStepBadge3');

  const presetSelect = document.getElementById('presetSelect');
  const btnPickOther = document.getElementById('btnPickOther');
  const customNameRow = document.getElementById('customNameRow');
  const customNameInput = document.getElementById('customNameInput');
  const pane2NameLabel = document.getElementById('pane2NameLabel');
  const groupHintBadge = document.getElementById('groupHintBadge');
  const unitPresetSelect = document.getElementById('unitPresetSelect');
  const customUnitInput = document.getElementById('customUnitInput');

  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ block: 'nearest' });
  };

  const getEffectiveName = () => {
    if (presetSelect.value === '__other__') {
      return customNameInput.value.trim();
    }
    const found = BENEFICIARY_PRESETS.find(p => p.id === presetSelect.value);
    return found ? (isTh ? found.th : found.en) : customNameInput.value.trim();
  };

  const syncPresetUI = () => {
    const isOther = presetSelect.value === '__other__';
    customNameRow.style.display = isOther ? 'grid' : 'none';
    if (isOther) {
      customNameInput.focus();
    } else {
      const found = BENEFICIARY_PRESETS.find(p => p.id === presetSelect.value);
      if (found) {
        group = groupByKey(found.group) || group;
        if (found.unit && !unitTouched) {
          form.count_unit.value = found.unit;
          if (unitPresetSelect) unitPresetSelect.value = found.unit;
        }
      }
    }
    syncGroupUI();
  };

  const syncGroupUI = () => {
    document.querySelectorAll('#groupChips .in-chip').forEach((c) => {
      const radio = c.querySelector('input[type=radio]');
      c.classList.toggle('is-on', radio.value === group?.key);
    });
    if (groupHintBadge && group) groupHintBadge.textContent = group.code;
    if (group && !codeTouched) form.group_code.value = nextGroupCode(stakeholders, group);
    if (group && !unitTouched && !form.count_unit.value) form.count_unit.value = group.unit;
  };

  presetSelect.addEventListener('change', syncPresetUI);
  btnPickOther.addEventListener('click', () => {
    presetSelect.value = '__other__';
    syncPresetUI();
  });

  unitPresetSelect.addEventListener('change', () => {
    unitTouched = true;
    if (unitPresetSelect.value === '__other__') {
      customUnitInput.style.display = 'block';
      customUnitInput.focus();
    } else {
      customUnitInput.style.display = 'none';
      customUnitInput.value = unitPresetSelect.value;
    }
  });

  form.querySelectorAll('#groupChips input[type=radio]').forEach((radio) => {
    radio.addEventListener('change', () => {
      group = groupByKey(radio.value);
      syncGroupUI();
    });
  });

  // Step Navigation Logic
  const goToPane = (paneNum) => {
    errBox.style.display = 'none';
    pane1.style.display = paneNum === 1 ? 'flex' : 'none';
    pane2.style.display = paneNum === 2 ? 'grid' : 'none';
    pane3.style.display = paneNum === 3 ? 'grid' : 'none';

    badge1.className = paneNum === 1 ? 'badge badge-production' : 'badge';
    badge1.style.background = paneNum === 1 ? '' : 'var(--surface-soft)';
    badge1.style.color = paneNum === 1 ? '' : 'var(--muted)';

    badge2.className = paneNum === 2 ? 'badge badge-production' : 'badge';
    badge2.style.background = paneNum === 2 ? '' : 'var(--surface-soft)';
    badge2.style.color = paneNum === 2 ? '' : 'var(--muted)';

    badge3.className = paneNum === 3 ? 'badge badge-production' : 'badge';
    badge3.style.background = paneNum === 3 ? '' : 'var(--surface-soft)';
    badge3.style.color = paneNum === 3 ? '' : 'var(--muted)';
  };

  document.getElementById('btnNextToPane2')?.addEventListener('click', () => {
    const name = getEffectiveName();
    if (!name) {
      showErr(isTh ? 'กรุณาระบุชื่อผู้ได้รับผลประโยชน์' : 'Please specify a stakeholder name.');
      if (presetSelect.value === '__other__') customNameInput.focus();
      return;
    }
    pane2NameLabel.textContent = name;
    goToPane(2);
  });

  document.getElementById('btnBackToPane1')?.addEventListener('click', () => goToPane(1));
  document.getElementById('btnNextToPane3')?.addEventListener('click', () => goToPane(3));
  document.getElementById('btnBackToPane2')?.addEventListener('click', () => goToPane(2));

  // Funding rows
  const rowsBox = document.getElementById('fundRows');
  const renderFundRows = () => {
    rowsBox.innerHTML = rows.map((r, i) => fundingRowHtml(r, i, project)).join('');
    updateFundTotal();
    rowsBox.querySelectorAll('.in-fund-row').forEach((div) => {
      const k = div.dataset.key;
      const r = rows.find((x) => x.key === k);
      div.querySelector('input[name=desc]')?.addEventListener('input', (e) => (r.description = e.target.value));
      div.querySelector('input[name=amount]')?.addEventListener('input', (e) => {
        r.amount = parseAmount(e.target.value);
        updateFundTotal();
      });
      div.querySelector('input[name=year]')?.addEventListener('input', (e) => (r.year = parseInt(e.target.value, 10) || 0));
      div.querySelector('input[name=source]')?.addEventListener('input', (e) => (r.evidence_source = e.target.value));
      div.querySelector('input[name=inkind]')?.addEventListener('change', (e) => {
        r.category = e.target.checked ? 'in_kind' : 'opex';
        r.is_cash = !e.target.checked;
      });
      div.querySelector('[data-del-row]')?.addEventListener('click', () => {
        const idx = rows.findIndex((x) => x.key === k);
        if (idx !== -1) rows.splice(idx, 1);
        renderFundRows();
      });
    });
  };

  const updateFundTotal = () => {
    const sum = rows.reduce(
      (n, r) => n + (typeof r.amount === 'number' && !Number.isNaN(r.amount) ? r.amount : 0),
      0,
    );
    const el = document.getElementById('fundTotal');
    if (el)
      el.innerHTML = sum
        ? `${isTh ? 'รวม:' : 'Total:'} <b>${escapeHtml(project.currency)} ${formatBaht(sum)}</b>`
        : '';
  };

  document.getElementById('btnAddFund')?.addEventListener('click', () => {
    rows.push({ key: newKey(), year: 0, category: 'opex', is_cash: true });
    renderFundRows();
  });

  renderFundRows();
  syncGroupUI();

  // Save implementation
  const save = async () => {
    errBox.style.display = 'none';
    const name = getEffectiveName();
    if (!name) {
      goToPane(1);
      showErr(isTh ? 'กรุณาระบุชื่อผู้ได้รับผลประโยชน์' : 'Please specify a stakeholder name.');
      return;
    }
    if (!group) {
      showErr(isTh ? 'กรุณาเลือกกลุ่ม S1–S4' : 'Please select a group (S1–S4).');
      return;
    }

    const badRow = rows.find((r) => r.description?.trim() && Number.isNaN(r.amount));
    if (badRow) {
      goToPane(3);
      showErr(isTh ? 'กรุณากรอกจำนวนเงินให้ถูกต้อง' : 'Please enter a valid amount.');
      return;
    }
    const cleanInputs = rows
      .filter((r) => r.description?.trim() && typeof r.amount === 'number' && !Number.isNaN(r.amount))
      .map((r) => ({
        id: r.id || undefined,
        description: r.description.trim(),
        amount: r.amount,
        year: r.year ?? 0,
        category: r.category || 'opex',
        is_cash: r.category !== 'in_kind',
        evidence_source: r.evidence_source?.trim() || null,
      }));

    const stkData = {
      name,
      stakeholder_group: group.key,
      group_code: form.group_code.value.trim() || null,
      count_unit: form.count_unit.value.trim() || 'คน',
      estimated_count: form.estimated_count.value !== '' ? Number(form.estimated_count.value) : null,
      role_in_project: form.role_in_project.value.trim() || null,
      description: form.description.value.trim() || null,
      category: form.category.value,
      evidence_source: form.evidence_source.value.trim() || null,
      expected_positive: form.expected_positive.value.trim() || null,
      expected_negative: form.expected_negative.value.trim() || null,
      overlap_notes: form.overlap_notes.value.trim() || null,
    };

    const btns = document.querySelectorAll('#btnQuickSaveStk, #btnFullSaveStk');
    btns.forEach((b) => (b.disabled = true));
    try {
      await saveStakeholderWithInputs({ id: editId, data: stkData, inputs: cleanInputs });
      closeModal();
      onSaved();
    } catch (err) {
      showErr(err.message);
      btns.forEach((b) => (b.disabled = false));
    }
  };

  document.getElementById('btnQuickSaveStk')?.addEventListener('click', save);
  document.getElementById('btnFullSaveStk')?.addEventListener('click', save);
  form.addEventListener('submit', (e) => e.preventDefault());
}