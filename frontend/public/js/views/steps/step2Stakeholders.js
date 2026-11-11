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
          </div>
          ${s.description ? `<div class="muted-sm">${escapeHtml(s.description)}</div>` : ''}
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
  let unitTouched = !!initialData?.count_unit;

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

  const body = `
    <form id="stakeholderForm" class="form-stack" autocomplete="off" novalidate>
      <!-- Section 1: Choose Stakeholder -->
      <div class="field">
        <label class="field-label" for="presetSelect">
          ${isTh ? '1. ใครคือผู้ได้รับผลประโยชน์หรือผู้เกี่ยวข้อง?' : '1. Who is the stakeholder?'}
          <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
        </label>
        <select id="presetSelect" class="input">
          <option value="">${isTh ? '— เลือกผู้มีส่วนได้ส่วนเสีย —' : '— Select a stakeholder —'}</option>
          ${BENEFICIARY_PRESETS.map((p) => `
            <option value="${p.id}" ${initialPresetVal === p.id ? 'selected' : ''}>
              ${escapeHtml(isTh ? p.th : p.en)}
            </option>
          `).join('')}
        </select>
      </div>

      <div id="customNameRow" class="field" ${initialPresetVal === '__other__' ? '' : 'hidden'}>
        <label class="field-label" for="customNameInput">
          ${isTh ? 'ระบุชื่อผู้มีส่วนได้ส่วนเสีย' : 'Specify Stakeholder Name'}
          <span class="field-hint field-hint--primary">${isTh ? 'จำเป็น' : 'Required'}</span>
        </label>
        <input type="text" id="customNameInput" name="name" class="input" value="${escapeHtml(initialData?.name || '')}" placeholder="${isTh ? 'เช่น ผู้ดูแลผู้ป่วยติดเตียง, ชมรมจิตอาสา...' : 'e.g. Caregivers, Volunteer club...'}" />
      </div>

      <!-- SROI Group Code Selection (Compact) -->
      <div class="field">
        <div class="cluster cluster--space-between">
          <span class="field-label">
            ${isTh ? 'ประเภทกลุ่มตามมาตรฐาน SROI' : 'SROI Group Classification'}
          </span>
          <span id="groupHintBadge" class="badge badge-planned">${group ? group.code : 'S1'}</span>
        </div>
        <div class="in-chips" id="groupChips" role="radiogroup">
          ${GROUPS.map(
            (g) =>
              `<label class="in-chip ${group?.key === g.key ? 'is-on' : ''}"><input type="radio" name="grp" value="${g.key}" ${group?.key === g.key ? 'checked' : ''} /><b>${g.code}</b> ${escapeHtml(groupLabel(g).replace(/^S\d\s*/, ''))}</label>`,
          ).join('')}
        </div>
      </div>

      <!-- Section 2: Population and Unit (Revealed only after stakeholder is chosen) -->
      <div id="stkSection2" class="form-stack" ${initialPresetVal ? '' : 'hidden'}>
        <div class="form-row">
          <div class="field">
            <label class="field-label" for="stkEstimatedCount">
              ${isTh ? '2. จำนวนประชากรที่ได้รับผลกระทบ' : '2. Population Size'}
            </label>
            <input class="input" id="stkEstimatedCount" name="estimated_count" type="number" min="0" step="1" value="${initialData?.estimated_count ?? ''}" placeholder="${isTh ? 'เช่น 120' : 'e.g. 120'}" />
          </div>

          <div class="field">
            <label class="field-label" for="unitPresetSelect">${isTh ? 'หน่วยนับ' : 'Unit'}</label>
            <select id="unitPresetSelect" class="input">
              ${[...UNIT_SUGGESTIONS, '__other__'].map((u) => `
                <option value="${u}" ${(initialData?.count_unit === u || (!initialData?.count_unit && u === 'คน')) ? 'selected' : ''}>
                  ${u === '__other__' ? (isTh ? 'อื่นๆ (ระบุ)' : 'Other (specify)') : u}
                </option>
              `).join('')}
            </select>
            <div id="customUnitRow" class="stack-xs" ${initialData?.count_unit && !UNIT_SUGGESTIONS.includes(initialData.count_unit) ? '' : 'hidden'}>
              <input class="input" name="count_unit" id="customUnitInput" value="${escapeHtml(initialData?.count_unit || 'คน')}" placeholder="${isTh ? 'ระบุหน่วยนับ' : 'Specify unit'}" />
            </div>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="stkRole">${isTh ? 'บทบาทในโครงการ (ไม่บังคับ)' : 'Role in project (Optional)'}</label>
          <input class="input" id="stkRole" name="role_in_project" value="${escapeHtml(initialData?.role_in_project || '')}" placeholder="${isTh ? 'เช่น เข้ารับการตรวจคัดกรองสายตา, อบรมอาชีพ' : 'e.g. Receives screening, attends training'}" />
        </div>

        <!-- Section 3: Collapsed Funding Disclosure (Revealed only after Section 2 is shown) -->
        <details class="disclosure" id="stkFundingDetails" ${rows.length ? 'open' : ''}>
          <summary class="disclosure__summary">
            ${isTh ? '3. เงิน / สิ่งสนับสนุนที่กลุ่มนี้ให้โครงการ' : '3. Money & support this group gives the project'}
          </summary>
          <div class="stack-sm">
            <div class="cluster cluster--space-between">
              <p class="field-hint">
                ${isTh ? 'ใส่เฉพาะกลุ่มที่เป็นผู้ให้เงินหรือสิ่งสนับสนุน (ส่วนใหญ่คือ S2–S4) ต้องมีอย่างน้อย 1 รายการในโครงการ' : 'Fill in for groups that give money or support (mostly S2–S4). The project needs at least one item.'}
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

      <div hidden>
        <input class="input" name="group_code" value="${escapeHtml(initialData?.group_code || '')}" />
        <input class="input" name="description" value="${escapeHtml(initialData?.description || '')}" />
        <select name="category">${CATEGORIES.map((c) => `<option value="${c}" ${initialData?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input name="evidence_source" value="${escapeHtml(initialData?.evidence_source || '')}" />
        <input name="expected_positive" value="${escapeHtml(initialData?.expected_positive || '')}" />
        <input name="expected_negative" value="${escapeHtml(initialData?.expected_negative || '')}" />
        <input name="overlap_notes" value="${escapeHtml(initialData?.overlap_notes || '')}" />
      </div>

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
  const presetSelect = document.getElementById('presetSelect');
  const customNameRow = document.getElementById('customNameRow');
  const customNameInput = document.getElementById('customNameInput');
  const stkSection2 = document.getElementById('stkSection2');
  const groupHintBadge = document.getElementById('groupHintBadge');
  const unitPresetSelect = document.getElementById('unitPresetSelect');
  const customUnitRow = document.getElementById('customUnitRow');
  const customUnitInput = document.getElementById('customUnitInput');
  const btnSaveStk = document.getElementById('btnSaveStk');

  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
  };

  const getEffectiveName = () => {
    if (presetSelect.value === '__other__') {
      return customNameInput.value.trim();
    }
    const found = BENEFICIARY_PRESETS.find((p) => p.id === presetSelect.value);
    return found ? (isTh ? found.th : found.en) : customNameInput.value.trim();
  };

  const syncPresetUI = () => {
    const isOther = presetSelect.value === '__other__';
    const isChosen = presetSelect.value !== '';
    customNameRow.hidden = !isOther;

    // Reveal Section 2 and Section 3 only once stakeholder is selected
    stkSection2.hidden = !isChosen;

    if (isOther) {
      customNameInput.focus();
    } else if (isChosen) {
      const found = BENEFICIARY_PRESETS.find((p) => p.id === presetSelect.value);
      if (found) {
        // NOTE: the S1–S4 group is intentionally NOT changed here; the user picks it themselves.
        if (found.unit && !unitTouched) {
          form.count_unit.value = found.unit;
          if (unitPresetSelect) unitPresetSelect.value = found.unit;
          customUnitRow.hidden = true;
        }
      }
    }
    syncGroupUI();
    validateForm();
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

  const validateForm = () => {
    const name = getEffectiveName();
    const isValid = !!name;
    if (btnSaveStk) btnSaveStk.disabled = !isValid;
  };

  presetSelect.addEventListener('change', syncPresetUI);
  customNameInput.addEventListener('input', validateForm);

  unitPresetSelect.addEventListener('change', () => {
    unitTouched = true;
    if (unitPresetSelect.value === '__other__') {
      customUnitRow.hidden = false;
      customUnitInput.focus();
    } else {
      customUnitRow.hidden = true;
      customUnitInput.value = unitPresetSelect.value;
    }
  });

  form.querySelectorAll('#groupChips input[type=radio]').forEach((radio) => {
    radio.addEventListener('change', () => {
      group = groupByKey(radio.value);
      syncGroupUI();
    });
  });

  // Funding lines
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
  validateForm();

  // Save handler
  const save = async () => {
    errBox.hidden = true;
    const name = getEffectiveName();
    if (!name) {
      showErr(isTh ? 'กรุณาระบุชื่อผู้ได้รับผลประโยชน์' : 'Please specify a stakeholder name.');
      return;
    }
    if (!group) {
      showErr(isTh ? 'กรุณาเลือกกลุ่ม S1–S4' : 'Please select a group (S1–S4).');
      return;
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

    const countUnit = unitPresetSelect.value === '__other__' ? customUnitInput.value.trim() : unitPresetSelect.value;

    const stkData = {
      name,
      stakeholder_group: group.key,
      group_code: form.group_code.value.trim() || null,
      count_unit: countUnit || 'คน',
      estimated_count: form.estimated_count.value !== '' ? Number(form.estimated_count.value) : null,
      role_in_project: form.role_in_project.value.trim() || null,
      description: form.description.value.trim() || null,
      category: form.category.value,
      evidence_source: form.evidence_source.value.trim() || null,
      expected_positive: form.expected_positive.value.trim() || null,
      expected_negative: form.expected_negative.value.trim() || null,
      overlap_notes: form.overlap_notes.value.trim() || null,
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