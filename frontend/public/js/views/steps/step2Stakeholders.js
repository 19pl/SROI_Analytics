/**
 * Step 2: Stakeholders AND their funding
 * Clean university standard, calm and uncluttered UI.
 * Progressive disclosure:
 *  1) Choose stakeholder preset (Other reveals text box)
 *  2) Population and Unit (dropdown from UNIT_SUGGESTIONS + Other)
 *  3) Collapsed Funding section
 * List shows Code, Name, Population as main columns; funding and linked outcomes expand in a details row.
 */

import { getState, saveStakeholderWithInputs, removeStakeholder } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
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
  { id: '__other__', th: 'อื่นๆ (ระบุเอง...)', en: 'Other (specify...)', group: 'primary_beneficiary', unit: 'คน' },
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


export const GROUP_DESCRIPTIONS = {
  primary_beneficiary: {
    code: 'S1',
    th_title: 'S1: ผู้รับผลประโยชน์หลัก (Primary Beneficiaries)',
    en_title: 'S1: Primary Beneficiaries',
    th_desc: 'ผู้ที่ได้รับผลกระทบหรือผลประโยชน์จากโครงการโดยตรง (เช่น ประชาชน, ผู้ป่วย, ผู้สูงอายุ, นักเรียน)',
    en_desc: 'Direct recipients and communities who experience impact.',
  },
  project_operator: {
    code: 'S2',
    th_title: 'S2: ผู้ดำเนินโครงการ (Project Implementers)',
    en_title: 'S2: Project Implementers & Staff',
    th_desc: 'คณะทำงาน อาจารย์ นักวิจัย หรือทีมงานที่มีบทบาทหลักในการดำเนินงานโครงการ',
    en_desc: 'Staff and teams who organize, deliver, and manage project activities.',
  },
  project_supporter: {
    code: 'S3',
    th_title: 'S3: ผู้สนับสนุนโครงการ (Project Supporters)',
    en_title: 'S3: Project Supporters & Funders',
    th_desc: 'หน่วยงาน แหล่งทุน คณะ หรือองค์กรที่สนับสนุนงบประมาณ ทรัพยากร หรือบริการ',
    en_desc: 'Faculties, funds, and organizations providing financial and in-kind resources.',
  },
  other_agency: {
    code: 'S4',
    th_title: 'S4: หน่วยงานอื่น ๆ (Other Stakeholders)',
    en_title: 'S4: External Partners & Other Agencies',
    th_desc: 'หน่วยงานภายนอก ภาคีเครือข่าย หรือชุมชนที่มีส่วนร่วมในการประสานงานหรือส่งเสริมโครงการ',
    en_desc: 'Local government authorities, health clinics, and network partners.',
  },
};

export function renderStep2(container) {
  const { project, stakeholders, costs } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__text">${t('alert_select_project_first', 'Please select or create a project first.')}</p></div>`;
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
        <div class="strong">${escapeHtml(s.name)}</div>
        ${s.role_in_project ? `<div class="muted-sm">${escapeHtml(s.role_in_project)}</div>` : ''}
      </td>
      <td class="num">${s.estimated_count !== null && s.estimated_count !== undefined ? `${Number(s.estimated_count).toLocaleString()} <span class="muted-sm">${escapeHtml(s.count_unit || '')}</span>` : '<span class="muted-sm">–</span>'}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn-icon" data-toggle-stk="${s.id}" title="${t('view_details', 'Details')}" aria-expanded="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button type="button" class="btn-icon" data-edit-stakeholder="${s.id}" title="${t('edit', 'Edit')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button type="button" class="btn-icon" data-remove-stakeholder="${s.id}" title="${t('delete', 'Delete')}">${icons.trash}</button>
        </div>
      </td>
    </tr>
    <tr class="stk-detail-row" id="stkDetail-${s.id}" hidden>
      <td colspan="4">
        <div class="panel panel--soft stack-sm">
          <div class="form-row">
            <div>
              <span class="muted-sm">${t('in_funding_short', 'งบสนับสนุน')}:</span>
              <strong>${fundingCount(s.id) ? `${escapeHtml(project.currency)} ${formatBaht(fundingOf(s.id))} (${fundingCount(s.id)} ${isTh ? 'รายการ' : 'lines'})` : (isTh ? 'ไม่มีงบสนับสนุน' : 'None')}</strong>
            </div>
            <div>
              <span class="muted-sm">${t('in_col_outcomes', 'ผลลัพธ์ที่เชื่อมโยง')}:</span>
              <strong>${s.outcome_count || 0} ${isTh ? 'ผลลัพธ์' : 'outcomes'}</strong>
            </div>
            ${s.category ? `<div><span class="muted-sm">${isTh ? 'ประเภท:' : 'Type:'}</span> <strong>${escapeHtml(s.category)}</strong></div>` : ''}
          </div>
          <div class="stk-detail-grid">
            ${s.target_characteristics ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ลักษณะกลุ่มเป้าหมาย:' : 'Characteristics:'}</span> ${escapeHtml(s.target_characteristics)}</div>` : ''}
            ${s.needs_or_problems ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ปัญหา/ความต้องการ:' : 'Needs & Problems:'}</span> ${escapeHtml(s.needs_or_problems)}</div>` : ''}
            ${s.operation_period ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ระยะเวลาดำเนินงาน:' : 'Timeline:'}</span> ${escapeHtml(s.operation_period)}</div>` : ''}
            ${s.resources_used ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ทรัพยากร/แรงงาน:' : 'Resources used:'}</span> ${escapeHtml(s.resources_used)}</div>` : ''}
            ${s.support_type ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'รูปแบบการสนับสนุน:' : 'Support Type:'}</span> <span class="badge">${escapeHtml(s.support_type)}</span> ${s.support_value ? `(${escapeHtml(project.currency)} ${formatBaht(s.support_value)})` : ''}</div>` : ''}
            ${s.support_amount_or_quantity ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ปริมาณทรัพยากร:' : 'Amount/Qty:'}</span> ${escapeHtml(s.support_amount_or_quantity)}</div>` : ''}
            ${s.cooperation_type ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'รูปแบบความร่วมมือ:' : 'Cooperation:'}</span> <span class="badge">${escapeHtml(s.cooperation_type)}</span></div>` : ''}
            ${s.resources_provided ? `<div class="stk-detail-item"><span class="muted-sm">${isTh ? 'ทรัพยากรที่สนับสนุน:' : 'Provided:'}</span> ${escapeHtml(s.resources_provided)}</div>` : ''}
          </div>
          ${s.description ? `<div class="muted-sm" style="margin-top: 4px;">${escapeHtml(s.description)}</div>` : ''}
        </div>
      </td>
    </tr>`;

  const groupDescriptions = GROUP_DESCRIPTIONS;

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
        <div class="panel in-group in-group--dashed" data-group="${g.key}">
          <div class="cluster cluster--space-between">
            <div>
              <h2 class="panel__title">${escapeHtml(isTh ? info.th_title : info.en_title)}</h2>
              <div class="muted-sm">${escapeHtml(isTh ? info.th_desc : info.en_desc)}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-add-in="${g.key}">
              ${icons.plus} ${isTh ? `เพิ่มในกลุ่ม ${g.code}` : `Add to ${g.code}`}
            </button>
          </div>
        </div>`;
    }

    return `
      <section class="panel in-group" data-group="${g.key}">
        <div class="page-head">
          <div>
            <h2 class="panel__title">${escapeHtml(isTh ? info.th_title : info.en_title)}</h2>
            <p class="muted-sm">${escapeHtml(isTh ? info.th_desc : info.en_desc)}</p>
          </div>
          <div class="page-head__actions">
            ${total ? `<span class="muted-sm">${t('in_funding_total', 'เงินสนับสนุนรวม')}: <b>${escapeHtml(project.currency)} ${formatBaht(total)}</b></span>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" data-add-in="${g.key}">${icons.plus} ${isTh ? `เพิ่มในกลุ่ม ${g.code}` : `Add to ${g.code}`}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>${t('in_code', 'รหัส')}</th>
                <th>${t('in_name_short', 'ผู้มีส่วนได้ส่วนเสีย')}</th>
                <th class="num">${t('in_count', 'จำนวนประชากร')}</th>
                <th><span class="sr-only">${t('actions', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>${list.map(rowHtml).join('')}</tbody>
          </table>
        </div>
      </section>`;
  };

  const loose = stakeholders.filter((s) => !groupByKey(s.stakeholder_group));

  container.innerHTML = `
    <div class="stack-md">
      <header class="page-head">
        <div>
          <h1 class="page-head__title">
            ${isTh ? 'ขั้นตอนที่ 2: ระบุผู้มีส่วนได้ส่วนเสีย (Stakeholders)' : 'Step 2: Stakeholders'}
          </h1>
          <p class="page-head__sub">
            ${isTh ? 'ระบุว่าใครได้รับผลประโยชน์ หรือใครเป็นผู้สนับสนุนโครงการของคุณ' : 'Identify primary beneficiaries and supporting partners.'}
          </p>
        </div>
        <div class="page-head__actions">
          <button type="button" class="btn btn-primary" id="btnTopAddStakeholder">
            ${icons.plus} ${isTh ? 'เพิ่มผู้มีส่วนได้ส่วนเสีย' : 'Add Stakeholder'}
          </button>
        </div>
      </header>

      ${
        unlinked.length
          ? `<div class="empty-state">
              <span class="muted-sm">${isTh ? 'มีรายการเงินลงทุนที่ยังไม่ได้เชื่อมโยงกับผู้สนับสนุน' : 'Investment items not linked to any stakeholder'}: <b>${unlinked.length}</b>
              — <a href="#/wizard/step-1">${isTh ? 'เลือกผู้สนับสนุนในขั้นตอนที่ 1' : 'Link funders in Step 1'}</a></span>
            </div>`
          : ''
      }

      <div class="stack-md">
        ${GROUPS.map(groupSection).join('')}
      </div>

      ${
        loose.length
          ? `<section class="panel in-group">
              <h2 class="panel__title">${t('grp_none', 'Unclassified')}</h2>
              <p class="muted-sm">${t('in_loose_hint', 'Entries without a group.')}</p>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>${t('in_code', 'รหัส')}</th>
                      <th>${t('in_name_short', 'ผู้มีส่วนได้ส่วนเสีย')}</th>
                      <th class="num">${t('in_count', 'จำนวนประชากร')}</th>
                      <th><span class="sr-only">${t('actions', 'Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>${loose.map(rowHtml).join('')}</tbody>
                </table>
              </div>
            </section>`
          : ''
      }

      ${wizardFooterHtml(2, {
        canProceed: stakeholders.length > 0,
        nextLabel: isTh
          ? 'บันทึกและไปต่อ: ระบุผลลัพธ์ที่เกิดขึ้น (Step 3) →'
          : 'Continue: Outcomes & Changes (Step 3) →',
      })}
    </div>`;

  const refresh = () => renderStep2(container);

  // Expandable details row handler
  container.querySelectorAll('[data-toggle-stk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleStk;
      const detailRow = document.getElementById(`stkDetail-${id}`);
      if (!detailRow) return;
      const isOpen = !detailRow.hidden;
      detailRow.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.style.transform = isOpen ? 'none' : 'rotate(180deg)';
    });
  });

  document.getElementById('btnTopAddStakeholder')?.addEventListener('click', () => {
    openStakeholderModal({ defaultGroup: 'primary_beneficiary', onSaved: refresh });
  });

  container.querySelectorAll('[data-add-in]').forEach((btn) =>
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
            showToast(`${t('in_cannot_delete', 'Cannot delete')}: ${err.message}`, 'error');
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
      <label class="field in-f-desc">
        <span class="field-label">${isTh ? 'รายการงบประมาณ / สิ่งสนับสนุน' : 'Resource / item'}</span>
        <input class="input" name="desc" value="${escapeHtml(row.description || '')}" placeholder="${isTh ? 'เช่น งบประมาณจากคณะ, ค่าเดินทาง' : 'e.g. Budget from faculty'}" />
      </label>
      <label class="field in-f-amt">
        <span class="field-label">${isTh ? 'จำนวนเงิน' : 'Amount'} (${escapeHtml(project.currency)})</span>
        <input class="input" name="amount" type="text" inputmode="decimal" autocomplete="off" value="${row.amount ?? ''}" placeholder="0" />
      </label>
      <label class="field in-f-year">
        <span class="field-label">${isTh ? 'ปีที่เกิด (0 = ปีแรก)' : 'Year (0 = Y0)'}</span>
        <input class="input" name="year" type="number" min="0" max="${project.analysis_period_years || 5}" value="${row.year ?? 0}" />
      </label>
      <label class="field in-f-src">
        <span class="field-label">${isTh ? 'แหล่งหลักฐาน' : 'Basis / source'}</span>
        <input class="input" name="source" value="${escapeHtml(row.evidence_source || '')}" placeholder="${isTh ? 'เช่น สรุปงบประมาณจริง' : 'How calculated / source'}" />
      </label>
      <label class="in-f-kind" title="${isTh ? 'เลือกหากไม่ใช่เงินสด เช่น เวลาอาสาสมัคร สถานที่ อุปกรณ์' : 'Tick when not cash (volunteer time, venue)'}">
        <input type="checkbox" name="inkind" ${row.category === 'in_kind' ? 'checked' : ''} />
        <span>${isTh ? 'In-kind' : 'In-kind'}</span>
      </label>
      <button type="button" class="btn-icon in-f-del" data-del-row="${k}" title="${t('delete', 'Delete')}" aria-label="${t('delete', 'Delete')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>`;
}

/**
 * Step 2 Stakeholder Modal:
 * Progressive flow:
 * 1) Choose stakeholder preset (Other reveals text box)
 * 2) ONLY THEN show Population and Unit (unit dropdown from UNIT_SUGGESTIONS + Other)
 * 3) ONLY THEN show collapsed "Funding (optional)" disclosure
 */
function openStakeholderModal({ initialData = null, defaultGroup = null, onSaved }) {
  const { project, stakeholders, costs } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const editId = initialData?.id ?? null;
  let keySeq = 0;
  const newKey = () => `r${++keySeq}`;

  let group = groupByKey(initialData?.stakeholder_group) || groupByKey(defaultGroup) || groupByKey('primary_beneficiary');
  let codeTouched = !!initialData?.group_code;

  const matchedPreset = initialData
    ? BENEFICIARY_PRESETS.find((p) => p.th === initialData.name || p.en === initialData.name)
    : null;
  const initialPresetVal = matchedPreset ? matchedPreset.id : (initialData ? '__other__' : '');

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

  const initialGroupKey = group?.key || 'primary_beneficiary';

  const body = `
    <form id="stakeholderForm" class="form-stack" autocomplete="off" novalidate>
      <!-- SROI Group Code Selection (Segmented Chips) -->
      <div class="field">
        <div class="cluster cluster--space-between" style="margin-bottom: var(--sp-xs);">
          <span class="field-label" style="font-weight: 600;">
            ${isTh ? 'เลือกประเภทกลุ่มผู้มีส่วนได้ส่วนเสีย (SROI Classification)' : 'Select SROI Classification'}
            <span class="field-hint field-hint--primary">*</span>
          </span>
          <span id="groupHintBadge" class="badge badge-planned" style="font-weight: 700;">${group ? group.code : 'S1'}</span>
        </div>
        <div class="in-chips" id="groupChips" role="radiogroup">
          ${GROUPS.map(
            (g) =>
              `<label class="in-chip ${group?.key === g.key ? 'is-on' : ''}"><input type="radio" name="grp" value="${g.key}" ${group?.key === g.key ? 'checked' : ''} /><b>${g.code}</b> ${escapeHtml(groupLabel(g).replace(/^S\d\s*/, ''))}</label>`,
          ).join('')}
        </div>
      </div>

      <!-- Dynamic Group Info Banner -->
      <div class="stk-group-banner" id="stkGroupBanner">
        <span class="stk-group-banner__badge" id="stkBannerBadge">${group ? group.code : 'S1'}</span>
        <div class="stk-group-banner__text">
          <div id="stkBannerTitle" style="font-weight: 600;">${escapeHtml(GROUP_DESCRIPTIONS[initialGroupKey]?.th_title || '')}</div>
          <div id="stkBannerDesc" class="stk-group-banner__desc">${escapeHtml(GROUP_DESCRIPTIONS[initialGroupKey]?.th_desc || '')}</div>
        </div>
      </div>

      <!-- S1 Form Section: Primary Beneficiaries -->
      <div id="stkSection-primary_beneficiary" class="form-stack stk-form-section" ${initialGroupKey === 'primary_beneficiary' ? '' : 'hidden'}>
        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s1PresetSelect">
              ${isTh ? 'ประเภทผู้ได้รับผลประโยชน์' : 'Beneficiary Type'}
            </label>
            <select id="s1PresetSelect" class="input">
              <option value="">${isTh ? '— เลือกประเภทหรือกลุ่มตัวอย่าง —' : '— Select a type or preset —'}</option>
              ${BENEFICIARY_PRESETS.map((p) => `<option value="${p.id}" ${initialPresetVal === p.id ? 'selected' : ''}>${escapeHtml(isTh ? p.th : p.en)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="s1NameInput">
              ${isTh ? 'ชื่อกลุ่มหรือผู้ได้รับผลประโยชน์' : 'Beneficiary Name'}
              <span class="field-hint field-hint--primary">*</span>
            </label>
            <input type="text" id="s1NameInput" name="name_s1" class="input" value="${escapeHtml(initialGroupKey === 'primary_beneficiary' ? (initialData?.name || '') : '')}" placeholder="${isTh ? 'เช่น ผู้สูงอายุในชุมชน, นิสิตนักศึกษา' : 'e.g. Elderly Community Residents'}" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s1EstimatedCount">
              ${isTh ? 'จำนวนประชากรที่ได้รับผลกระทบ' : 'Affected Population Size'}
              <span class="field-hint field-hint--primary">*</span>
            </label>
            <input class="input" id="s1EstimatedCount" name="estimated_count_s1" type="number" min="0" step="1" value="${initialGroupKey === 'primary_beneficiary' ? (initialData?.estimated_count ?? '') : ''}" placeholder="${isTh ? 'เช่น 120' : 'e.g. 120'}" />
          </div>
          <div class="field">
            <label class="field-label" for="s1UnitInput">
              ${isTh ? 'หน่วยนับ' : 'Unit'}
              <span class="field-hint field-hint--primary">*</span>
            </label>
            <input list="s1UnitSuggestions" class="input" id="s1UnitInput" name="count_unit_s1" value="${escapeHtml(initialGroupKey === 'primary_beneficiary' ? (initialData?.count_unit || 'คน') : 'คน')}" placeholder="${isTh ? 'เช่น คน, ครัวเรือน, กลุ่ม' : 'e.g. people, households'}" />
            <datalist id="s1UnitSuggestions">
              ${UNIT_SUGGESTIONS.map((u) => `<option value="${escapeHtml(u)}"></option>`).join('')}
            </datalist>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="s1TargetCharacteristics">
            ${isTh ? 'ลักษณะหรือกลุ่มเป้าหมาย' : 'Target Characteristics'}
          </label>
          <input type="text" class="input" id="s1TargetCharacteristics" name="target_characteristics" value="${escapeHtml(initialData?.target_characteristics || '')}" placeholder="${isTh ? 'เช่น ผู้สูงอายุ 60 ปีขึ้นไปที่มีปัญหาทางสายตา อาศัยอยู่ในเขต ต.บ้านดู่' : 'e.g. Age 60+ with vision difficulties'}" />
        </div>

        <div class="field">
          <label class="field-label" for="s1NeedsOrProblems">
            ${isTh ? 'ปัญหาหรือความต้องการของกลุ่มเป้าหมาย' : 'Needs & Problems of Target Group'}
          </label>
          <textarea class="input" id="s1NeedsOrProblems" name="needs_or_problems" rows="2" placeholder="${isTh ? 'เช่น ขาดโอกาสในการตรวจวัดสายตา ไม่มีแว่นตาที่เหมาะสม ส่งผลต่อการดำเนินชีวิตประจำวัน' : 'e.g. Lack of eye-care services'}">${escapeHtml(initialData?.needs_or_problems || '')}</textarea>
        </div>

        <div class="field">
          <label class="field-label" for="s1Description">${isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details'}</label>
          <textarea class="input" id="s1Description" name="description_s1" rows="2" placeholder="${isTh ? 'ข้อมูลเพิ่มเติมหรือบริบทแวดล้อม (ถ้ามี)...' : 'Context, survey source, or notes...'}">${escapeHtml(initialGroupKey === 'primary_beneficiary' ? (initialData?.description || '') : '')}</textarea>
        </div>
      </div>

      <!-- S2 Form Section: Project Implementers -->
      <div id="stkSection-project_operator" class="form-stack stk-form-section" ${initialGroupKey === 'project_operator' ? '' : 'hidden'}>
        <div class="field">
          <label class="field-label" for="s2NameInput">
            ${isTh ? 'ชื่อบุคคลหรือหน่วยงานผู้ดำเนินโครงการ' : 'Implementer / Operator Name'}
            <span class="field-hint field-hint--primary">*</span>
          </label>
          <input type="text" id="s2NameInput" name="name_s2" class="input" value="${escapeHtml(initialGroupKey === 'project_operator' ? (initialData?.name || '') : '')}" placeholder="${isTh ? 'เช่น คณะพยาบาลศาสตร์, ศูนย์บริการวิชาการ, ทีมวิจัย...' : 'e.g. Faculty of Nursing, Project Team'}" />
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s2Category">${isTh ? 'ประเภทผู้ดำเนินโครงการ' : 'Implementer Type'}</label>
            <select id="s2Category" name="category_s2" class="input">
              ${[
                ['Faculty / Department', isTh ? 'คณะ / สำนัก / ภาควิชาภายในมหาวิทยาลัย' : 'Faculty / Department'],
                ['Research Center / Institute', isTh ? 'ศูนย์วิจัย / สถาบันบริการวิชาการ' : 'Research Center / Institute'],
                ['Project Team / Researchers', isTh ? 'คณะทำงาน / ทีมวิจัยโครงการ' : 'Project Team / Researchers'],
                ['Civil Society / NGO', isTh ? 'องค์กรภาคประชาสังคม / มูลนิธิ' : 'Civil Society / NGO'],
                ['Other', isTh ? 'อื่นๆ' : 'Other'],
              ].map(([val, label]) => `<option value="${val}" ${initialData?.category === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="s2OperationPeriod">${isTh ? 'ระยะเวลาในการดำเนินงาน' : 'Operating Timeline'}</label>
            <input type="text" id="s2OperationPeriod" name="operation_period" class="input" value="${escapeHtml(initialData?.operation_period || '')}" placeholder="${isTh ? 'เช่น ตลอดโครงการ 12 เดือน, ไตรมาสที่ 1-2' : 'e.g. Entire 12 months, Months 1-6'}" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s2PersonnelCount">${isTh ? 'จำนวนบุคลากรที่เข้าร่วม' : 'Personnel Count'}</label>
            <input class="input" id="s2PersonnelCount" name="estimated_count_s2" type="number" min="0" step="1" value="${initialGroupKey === 'project_operator' ? (initialData?.estimated_count ?? '') : ''}" placeholder="${isTh ? 'เช่น 15' : 'e.g. 15'}" />
          </div>
          <div class="field">
            <label class="field-label" for="s2CountUnit">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
            <input type="text" class="input" id="s2CountUnit" name="count_unit_s2" value="${escapeHtml(initialGroupKey === 'project_operator' ? (initialData?.count_unit || 'คน') : 'คน')}" placeholder="${isTh ? 'เช่น คน, ทีม, หน่วย' : 'e.g. people, staff, team'}" />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="s2Role">
            ${isTh ? 'บทบาทและหน้าที่ในโครงการ' : 'Role & Responsibility in Project'}
            <span class="field-hint field-hint--primary">*</span>
          </label>
          <input class="input" id="s2Role" name="role_in_project_s2" value="${escapeHtml(initialGroupKey === 'project_operator' ? (initialData?.role_in_project || '') : '')}" placeholder="${isTh ? 'เช่น วางแผนหลักสูตร จัดอบรม และให้บริการตรวจคัดกรองสายตา' : 'e.g. Planning curriculum, conducting eye-screenings'}" />
        </div>

        <div class="field">
          <label class="field-label" for="s2ResourcesUsed">${isTh ? 'ทรัพยากรหรือแรงงานที่ใช้ในการดำเนินโครงการ' : 'Resources & Labor Contributed'}</label>
          <textarea class="input" id="s2ResourcesUsed" name="resources_used" rows="2" placeholder="${isTh ? 'เช่น อาจารย์ 4 คน, นักศึกษาจิตอาสา 8 คน, รถตู้ 1 คัน, อุปกรณ์ตรวจสายตา' : 'e.g. 4 faculty members, 8 volunteer students, mobile van'}">${escapeHtml(initialData?.resources_used || '')}</textarea>
        </div>

        <div class="field">
          <label class="field-label" for="s2Description">${isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details'}</label>
          <textarea class="input" id="s2Description" name="description_s2" rows="2" placeholder="${isTh ? 'ข้อมูลเพิ่มเติมเกี่ยวกับคณะทำงาน...' : 'Further notes about the implementers...'}">${escapeHtml(initialGroupKey === 'project_operator' ? (initialData?.description || '') : '')}</textarea>
        </div>
      </div>

      <!-- S3 Form Section: Project Supporters -->
      <div id="stkSection-project_supporter" class="form-stack stk-form-section" ${initialGroupKey === 'project_supporter' ? '' : 'hidden'}>
        <div class="field">
          <label class="field-label" for="s3NameInput">
            ${isTh ? 'ชื่อบุคคลหรือหน่วยงานผู้สนับสนุน' : 'Supporter Name'}
            <span class="field-hint field-hint--primary">*</span>
          </label>
          <input type="text" id="s3NameInput" name="name_s3" class="input" value="${escapeHtml(initialGroupKey === 'project_supporter' ? (initialData?.name || '') : '')}" placeholder="${isTh ? 'เช่น สำนักงานกองทุน สสส., เทศบาลตำบล, บริษัท ปตท. จำกัด' : 'e.g. Thai Health Promotion Foundation, Municipality, Donor'}" />
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s3Category">${isTh ? 'ประเภทผู้สนับสนุน' : 'Supporter Type'}</label>
            <select id="s3Category" name="category_s3" class="input">
              ${[
                ['Government Agency / Fund', isTh ? 'แหล่งทุนภาครัฐ / กองทุนวิจัย' : 'Government Agency / Fund'],
                ['Local Administration', isTh ? 'องค์กรปกครองส่วนท้องถิ่น (อปท.)' : 'Local Administration'],
                ['Private Sector / CSR', isTh ? 'ภาคเอกชน / บริษัทธุรกิจ (CSR)' : 'Private Sector / CSR'],
                ['University Division', isTh ? 'คณะ / ส่วนงานภายในมหาวิทยาลัย' : 'University Division'],
                ['Foundation / Donor', isTh ? 'มูลนิธิ / บุคคล / ผู้บริจาค' : 'Foundation / Donor'],
                ['Other', isTh ? 'อื่นๆ' : 'Other'],
              ].map(([val, label]) => `<option value="${val}" ${initialData?.category === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="s3SupportType">
              ${isTh ? 'รูปแบบการสนับสนุน' : 'Support Type'}
              <span class="field-hint field-hint--primary">*</span>
            </label>
            <select id="s3SupportType" name="support_type" class="input">
              ${[
                ['เงินทุน', isTh ? 'เงินทุน (Financial / Grants)' : 'Financial / Grants'],
                ['สิ่งของ / อุปกรณ์', isTh ? 'สิ่งของ / อุปกรณ์ (Equipment & Goods)' : 'Equipment & Goods'],
                ['บุคลากร / ผู้เชี่ยวชาญ', isTh ? 'บุคลากร / ผู้เชี่ยวชาญ (Personnel / Experts)' : 'Personnel / Experts'],
                ['สถานที่ / ยานพาหนะ', isTh ? 'สถานที่ / ยานพาหนะ (Venue & Logistics)' : 'Venue & Logistics'],
                ['บริการ / สื่อประชาสัมพันธ์', isTh ? 'บริการ / สื่อประชาสัมพันธ์ (Services & Media)' : 'Services & Media'],
                ['ผสมผสานหลายรูปแบบ', isTh ? 'ผสมผสานหลายรูปแบบ (Multi-type support)' : 'Multi-type support'],
              ].map(([val, label]) => `<option value="${val}" ${(initialData?.support_type || 'เงินทุน') === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s3SupportValue">${isTh ? 'มูลค่าการสนับสนุน (บาท)' : 'Support Value (Baht)'}</label>
            <input class="input" id="s3SupportValue" name="support_value" type="number" min="0" step="0.01" value="${initialData?.support_value ?? ''}" placeholder="${isTh ? 'เช่น 250000' : 'e.g. 250000'}" />
          </div>
          <div class="field">
            <label class="field-label" for="s3SupportAmountOrQty">${isTh ? 'จำนวนเงินหรือปริมาณทรัพยากรที่สนับสนุน' : 'Amount / Resource Quantity'}</label>
            <input class="input" id="s3SupportAmountOrQty" name="support_amount_or_quantity" value="${escapeHtml(initialData?.support_amount_or_quantity || '')}" placeholder="${isTh ? 'เช่น งบประมาณ 250,000 บาท, แว่นตา 300 อัน' : 'e.g. Budget 250,000 THB, 300 eyeglass kits'}" />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="s3Description">${isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details'}</label>
          <textarea class="input" id="s3Description" name="description_s3" rows="2" placeholder="${isTh ? 'เงื่อนไขการสนับสนุน, รายละเอียดงวดเงิน หรือข้อตกลง...' : 'Funding conditions, milestones, or notes...'}">${escapeHtml(initialGroupKey === 'project_supporter' ? (initialData?.description || '') : '')}</textarea>
        </div>

        <!-- Funding lines disclosure (Step 1 Integration) -->
        <details class="disclosure" id="stkFundingDetails">
          <summary class="disclosure__summary">
            ${isTh ? 'รายการงบประมาณที่เชื่อมโยงกับขั้นตอนที่ 1 (ไม่บังคับ)' : 'Funding lines linked to Step 1 (Optional)'}
          </summary>
          <div class="stack-sm" style="margin-top: var(--sp-sm);">
            <div class="cluster cluster--space-between">
              <p class="field-hint">
                ${isTh ? 'รายการงบประมาณที่กลุ่มนี้สนับสนุนโครงการ ข้อมูลจะเชื่อมโยงไปยังขั้นตอนที่ 1 โดยอัตโนมัติ' : 'Resources provided by this group. Automatically linked to Step 1.'}
              </p>
              <span class="muted-sm strong" id="fundTotal"></span>
            </div>
            <div id="fundRows"></div>
            <div>
              <button type="button" class="btn btn-secondary btn-sm" id="btnAddFund">
                ${icons.plus} ${isTh ? 'เพิ่มรายการงบประมาณ / สิ่งสนับสนุน' : 'Add funding line'}
              </button>
            </div>
          </div>
        </details>
      </div>

      <!-- S4 Form Section: Other Stakeholders -->
      <div id="stkSection-other_agency" class="form-stack stk-form-section" ${initialGroupKey === 'other_agency' ? '' : 'hidden'}>
        <div class="field">
          <label class="field-label" for="s4NameInput">
            ${isTh ? 'ชื่อหน่วยงานหรือกลุ่มบุคคล' : 'Agency / Partner Name'}
            <span class="field-hint field-hint--primary">*</span>
          </label>
          <input type="text" id="s4NameInput" name="name_s4" class="input" value="${escapeHtml(initialGroupKey === 'other_agency' ? (initialData?.name || '') : '')}" placeholder="${isTh ? 'เช่น รพ.สต. บ้านดู่, ชมรมผู้สูงอายุตำบล, สหกรณ์การเกษตร' : 'e.g. Sub-district Health Center, Community Club'}" />
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s4Category">${isTh ? 'ประเภทหน่วยงาน' : 'Agency Type'}</label>
            <select id="s4Category" name="category_s4" class="input">
              ${[
                ['Local Administration', isTh ? 'องค์กรปกครองส่วนท้องถิ่น (อปท. / เทศบาล / อบต.)' : 'Local Government / Municipality'],
                ['Health Center / Clinic', isTh ? 'สถานบริการสาธารณสุข / รพ.สต. / โรงพยาบาล' : 'Health Center / Clinic'],
                ['Local School / Education', isTh ? 'โรงเรียน / สถานศึกษาในพื้นที่' : 'Local School / Education'],
                ['Community Enterprise / Cooperative', isTh ? 'วิสาหกิจชุมชน / สหกรณ์ / ธุรกิจท้องถิ่น' : 'Community Enterprise / Cooperative'],
                ['Community Leaders / Volunteers', isTh ? 'ผู้นำชุมชน / กลุ่มอาสาสมัคร (อสม.)' : 'Community Leaders / Volunteers'],
                ['Other', isTh ? 'อื่นๆ' : 'Other'],
              ].map(([val, label]) => `<option value="${val}" ${initialData?.category === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="s4CooperationType">${isTh ? 'รูปแบบความร่วมมือ' : 'Collaboration Model'}</label>
            <select id="s4CooperationType" name="cooperation_type" class="input">
              ${[
                ['บันทึกข้อตกลงความร่วมมือ (MOU)', isTh ? 'บันทึกข้อตกลงความร่วมมือ (MOU)' : 'Memorandum of Understanding (MOU)'],
                ['ภาคีเครือข่ายร่วมดำเนินงาน', isTh ? 'ภาคีเครือข่ายร่วมดำเนินงาน (Joint Working Network)' : 'Joint Working Network'],
                ['การประสานงานและส่งต่อกลุ่มเป้าหมาย', isTh ? 'การประสานงานและส่งต่อกลุ่มเป้าหมาย (Referral & Coordination)' : 'Referral & Coordination'],
                ['การอำนวยความสะดวกในพื้นที่', isTh ? 'การอำนวยความสะดวกในพื้นที่ (Local Facilitation)' : 'Local Facilitation'],
                ['คณะกรรมการร่วม / ที่ปรึกษา', isTh ? 'คณะกรรมการร่วม / ที่ปรึกษา (Advisory / Steering)' : 'Advisory / Steering Committee'],
                ['อื่นๆ', isTh ? 'อื่นๆ' : 'Other'],
              ].map(([val, label]) => `<option value="${val}" ${(initialData?.cooperation_type || 'บันทึกข้อตกลงความร่วมมือ (MOU)') === val ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label" for="s4PersonnelCount">${isTh ? 'จำนวนผู้เกี่ยวข้อง (ถ้ามี)' : 'Related People / Units (Optional)'}</label>
            <input class="input" id="s4PersonnelCount" name="estimated_count_s4" type="number" min="0" step="1" value="${initialGroupKey === 'other_agency' ? (initialData?.estimated_count ?? '') : ''}" placeholder="${isTh ? 'เช่น 5' : 'e.g. 5'}" />
          </div>
          <div class="field">
            <label class="field-label" for="s4CountUnit">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
            <input type="text" class="input" id="s4CountUnit" name="count_unit_s4" value="${escapeHtml(initialGroupKey === 'other_agency' ? (initialData?.count_unit || 'แห่ง') : 'แห่ง')}" placeholder="${isTh ? 'เช่น แห่ง, คน, กลุ่ม' : 'e.g. agency, people, group'}" />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="s4Role">${isTh ? 'บทบาทในการมีส่วนร่วมกับโครงการ' : 'Role in Project Engagement'}</label>
          <input class="input" id="s4Role" name="role_in_project_s4" value="${escapeHtml(initialGroupKey === 'other_agency' ? (initialData?.role_in_project || '') : '')}" placeholder="${isTh ? 'เช่น ช่วยประชาสัมพันธ์ คัดกรองเบื้องต้น และส่งต่อกลุ่มเป้าหมาย' : 'e.g. Coordinating with villagers and screening'}" />
        </div>

        <div class="field">
          <label class="field-label" for="s4ResourcesProvided">${isTh ? 'ทรัพยากรที่นำมาสนับสนุน' : 'Resources Provided'}</label>
          <textarea class="input" id="s4ResourcesProvided" name="resources_provided" rows="2" placeholder="${isTh ? 'เช่น สถานที่จัดกิจกรรมใน รพ.สต., เจ้าหน้าที่ อสม. 10 ท่าน' : 'e.g. Health center venue, 10 local health volunteers'}">${escapeHtml(initialData?.resources_provided || '')}</textarea>
        </div>

        <div class="field">
          <label class="field-label" for="s4Description">${isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details'}</label>
          <textarea class="input" id="s4Description" name="description_s4" rows="2" placeholder="${isTh ? 'ข้อมูลเพิ่มเติมเกี่ยวกับหน่วยงานหรือข้อตกลง...' : 'Further notes about the agency...'}">${escapeHtml(initialGroupKey === 'other_agency' ? (initialData?.description || '') : '')}</textarea>
        </div>
      </div>

      <input type="hidden" name="group_code" value="${escapeHtml(initialData?.group_code || '')}" />
      <div id="stakeholderModalError" class="field-error" hidden></div>
    </form>`;

  openModal({
    title: editId
      ? (isTh ? 'แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย' : 'Edit Stakeholder')
      : (isTh ? 'เพิ่มผู้มีส่วนได้ส่วนเสีย' : 'Add Stakeholder'),
    body,
    size: 'lg',
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button type="button" class="btn btn-primary" id="btnSaveStk">${isTh ? 'บันทึก' : 'Save Stakeholder'}</button>
    `,
  });

  const form = document.getElementById('stakeholderForm');
  const errBox = document.getElementById('stakeholderModalError');
  const groupHintBadge = document.getElementById('groupHintBadge');
  const btnSaveStk = document.getElementById('btnSaveStk');

  const s1PresetSelect = document.getElementById('s1PresetSelect');
  const s1NameInput = document.getElementById('s1NameInput');
  const s1UnitInput = document.getElementById('s1UnitInput');

  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
  };

  const syncPresetS1 = () => {
    if (!s1PresetSelect) return;
    const val = s1PresetSelect.value;
    if (val && val !== '__other__') {
      const found = BENEFICIARY_PRESETS.find((p) => p.id === val);
      if (found) {
        if (!s1NameInput.value || BENEFICIARY_PRESETS.some((x) => x.th === s1NameInput.value || x.en === s1NameInput.value)) {
          s1NameInput.value = isTh ? found.th : found.en;
        }
        if (found.unit && s1UnitInput) {
          s1UnitInput.value = found.unit;
        }
      }
    } else if (val === '__other__') {
      s1NameInput.focus();
    }
    validateForm();
  };

  const syncGroupUI = () => {
    document.querySelectorAll('#groupChips .in-chip').forEach((c) => {
      const radio = c.querySelector('input[type=radio]');
      c.classList.toggle('is-on', radio.value === group?.key);
    });
    if (groupHintBadge && group) groupHintBadge.textContent = group.code;
    if (group && !codeTouched) form.group_code.value = nextGroupCode(stakeholders, group);

    const bannerBadge = document.getElementById('stkBannerBadge');
    const bannerTitle = document.getElementById('stkBannerTitle');
    const bannerDesc = document.getElementById('stkBannerDesc');
    const info = GROUP_DESCRIPTIONS[group?.key] || {};
    if (bannerBadge) bannerBadge.textContent = group?.code || 'S1';
    if (bannerTitle) bannerTitle.textContent = isTh ? info.th_title : info.en_title;
    if (bannerDesc) bannerDesc.textContent = isTh ? info.th_desc : info.en_desc;

    document.querySelectorAll('.stk-form-section').forEach((sec) => {
      sec.hidden = sec.id !== `stkSection-${group?.key}`;
    });

    validateForm();
  };

  const validateForm = () => {
    let isValid = true;
    if (!group) {
      isValid = false;
    } else if (group.key === 'primary_beneficiary') {
      isValid = !!form.name_s1?.value.trim() && form.estimated_count_s1?.value.trim() !== '' && !!form.count_unit_s1?.value.trim();
    } else if (group.key === 'project_operator') {
      isValid = !!form.name_s2?.value.trim() && !!form.role_in_project_s2?.value.trim();
    } else if (group.key === 'project_supporter') {
      isValid = !!form.name_s3?.value.trim() && !!form.support_type?.value.trim();
    } else if (group.key === 'other_agency') {
      isValid = !!form.name_s4?.value.trim();
    }
    if (btnSaveStk) btnSaveStk.disabled = !isValid;
  };

  if (s1PresetSelect) s1PresetSelect.addEventListener('change', syncPresetS1);
  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });

  form.querySelectorAll('#groupChips input[type=radio]').forEach((radio) => {
    radio.addEventListener('change', () => {
      group = groupByKey(radio.value);
      codeTouched = false;
      syncGroupUI();
      // Auto focus active name input
      const sec = document.getElementById(`stkSection-${group?.key}`);
      sec?.querySelector('input[type=text]')?.focus();
    });
  });

  // Funding lines (for S3 or existing funding records)
  const rowsBox = document.getElementById('fundRows');
  const renderFundRows = () => {
    if (!rowsBox) return;
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
  validateForm();

  // Save handler
  const save = async () => {
    errBox.hidden = true;
    if (!group) {
      showErr(isTh ? 'กรุณาเลือกกลุ่ม S1–S4' : 'Please select an SROI group (S1–S4).');
      return;
    }

    const grpKey = group.key;
    let name = '';
    let category = null;
    let estimated_count = null;
    let count_unit = null;
    let role_in_project = null;
    let description = null;
    let target_characteristics = null;
    let needs_or_problems = null;
    let operation_period = null;
    let resources_used = null;
    let support_type = null;
    let support_value = null;
    let support_amount_or_quantity = null;
    let cooperation_type = null;
    let resources_provided = null;

    if (grpKey === 'primary_beneficiary') {
      name = (form.name_s1?.value || '').trim();
      if (!name) {
        showErr(isTh ? 'กรุณาระบุชื่อกลุ่มหรือผู้ได้รับผลประโยชน์' : 'Please enter the beneficiary name.');
        form.name_s1?.focus();
        return;
      }
      const cntStr = (form.estimated_count_s1?.value || '').trim();
      if (cntStr === '' || Number.isNaN(Number(cntStr)) || Number(cntStr) < 0) {
        showErr(isTh ? 'กรุณากรอกจำนวนประชากรที่ได้รับผลกระทบเป็นตัวเลข (0 ขึ้นไป)' : 'Please enter a valid population count (>= 0).');
        form.estimated_count_s1?.focus();
        return;
      }
      count_unit = (form.count_unit_s1?.value || '').trim();
      if (!count_unit) {
        showErr(isTh ? 'กรุณาระบุหน่วยนับ' : 'Please specify a count unit.');
        form.count_unit_s1?.focus();
        return;
      }
      estimated_count = Number(cntStr);
      const presetVal = form.s1PresetSelect?.value;
      const presetObj = BENEFICIARY_PRESETS.find((x) => x.id === presetVal);
      category = presetObj ? (isTh ? presetObj.th : presetObj.en) : 'Primary Beneficiary';
      target_characteristics = form.target_characteristics?.value.trim() || null;
      needs_or_problems = form.needs_or_problems?.value.trim() || null;
      description = form.description_s1?.value.trim() || null;
    } else if (grpKey === 'project_operator') {
      name = (form.name_s2?.value || '').trim();
      if (!name) {
        showErr(isTh ? 'กรุณาระบุชื่อบุคคลหรือหน่วยงานผู้ดำเนินโครงการ' : 'Please enter the implementer name.');
        form.name_s2?.focus();
        return;
      }
      role_in_project = (form.role_in_project_s2?.value || '').trim();
      if (!role_in_project) {
        showErr(isTh ? 'กรุณาระบุบทบาทและหน้าที่ในโครงการ' : 'Please specify the role in the project.');
        form.role_in_project_s2?.focus();
        return;
      }
      category = form.category_s2?.value || 'Faculty / Department';
      const cntStr = (form.estimated_count_s2?.value || '').trim();
      estimated_count = cntStr !== '' ? Number(cntStr) : null;
      count_unit = (form.count_unit_s2?.value || '').trim() || 'คน';
      operation_period = form.operation_period?.value.trim() || null;
      resources_used = form.resources_used?.value.trim() || null;
      description = form.description_s2?.value.trim() || null;
    } else if (grpKey === 'project_supporter') {
      name = (form.name_s3?.value || '').trim();
      if (!name) {
        showErr(isTh ? 'กรุณาระบุชื่อบุคคลหรือหน่วยงานผู้สนับสนุน' : 'Please enter the supporter name.');
        form.name_s3?.focus();
        return;
      }
      support_type = (form.support_type?.value || '').trim();
      if (!support_type) {
        showErr(isTh ? 'กรุณาเลือกรูปแบบการสนับสนุน' : 'Please select a support type.');
        form.support_type?.focus();
        return;
      }
      category = form.category_s3?.value || 'Government Agency / Fund';
      const valStr = (form.support_value?.value || '').trim();
      support_value = valStr !== '' ? Number(valStr) : null;
      if (support_value !== null && (Number.isNaN(support_value) || support_value < 0)) {
        showErr(isTh ? 'มูลค่าการสนับสนุนต้องเป็นตัวเลข 0 ขึ้นไป' : 'Support value must be 0 or greater.');
        form.support_value?.focus();
        return;
      }
      support_amount_or_quantity = form.support_amount_or_quantity?.value.trim() || null;
      description = form.description_s3?.value.trim() || null;
      count_unit = 'คณะ';
    } else if (grpKey === 'other_agency') {
      name = (form.name_s4?.value || '').trim();
      if (!name) {
        showErr(isTh ? 'กรุณาระบุชื่อหน่วยงานหรือกลุ่มบุคคล' : 'Please enter the agency name.');
        form.name_s4?.focus();
        return;
      }
      category = form.category_s4?.value || 'Local Administration';
      cooperation_type = form.cooperation_type?.value || null;
      const cntStr = (form.estimated_count_s4?.value || '').trim();
      estimated_count = cntStr !== '' ? Number(cntStr) : null;
      count_unit = (form.count_unit_s4?.value || '').trim() || 'แห่ง';
      role_in_project = form.role_in_project_s4?.value.trim() || null;
      resources_provided = form.resources_provided?.value.trim() || null;
      description = form.description_s4?.value.trim() || null;
    }

    const badRow = rows.find((r) => r.description?.trim() && Number.isNaN(r.amount));
    if (badRow) {
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
      stakeholder_group: grpKey,
      group_code: form.group_code.value.trim() || null,
      count_unit,
      estimated_count,
      role_in_project,
      description,
      category,
      target_characteristics,
      needs_or_problems,
      operation_period,
      resources_used,
      support_type,
      support_value,
      support_amount_or_quantity,
      cooperation_type,
      resources_provided,
      evidence_source: initialData?.evidence_source || null,
      expected_positive: initialData?.expected_positive || null,
      expected_negative: initialData?.expected_negative || null,
      overlap_notes: initialData?.overlap_notes || null,
    };

    if (btnSaveStk) btnSaveStk.disabled = true;
    try {
      await saveStakeholderWithInputs({ id: editId, data: stkData, inputs: cleanInputs });
      closeModal();
      onSaved();
    } catch (err) {
      showErr(err.message);
      if (btnSaveStk) btnSaveStk.disabled = false;
    }
  };

  btnSaveStk?.addEventListener('click', save);
  form.addEventListener('submit', (e) => e.preventDefault());
}
