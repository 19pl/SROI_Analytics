/**
 * Step 2: Stakeholders AND their funding — entered once, laid out like the Excel (S1–S4 groups).
 * Guided, beginner-friendly experience for university employees.
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
      th_title: 'S1: กลุ่มเป้าหมาย / ผู้ได้รับผลประโยชน์หลัก (Primary Beneficiaries)',
      en_title: 'S1: Primary Beneficiaries',
      th_desc:
        'ผู้ที่ได้รับผลประโยชน์โดยตรงจากโครงการ เช่น นิสิต, ประชาชนในชุมชน, ผู้สูงอายุ, ผู้ป่วย หรือครัวเรือนในพื้นที่',
      en_desc:
        'Direct recipients of project services (e.g. students, community members, elderly, patients).',
      empty_th:
        'ยังไม่มีกลุ่มเป้าหมาย — คลิกปุ่ม "+ เพิ่มในกลุ่ม S1" เพื่อระบุผู้รับผลประโยชน์หลัก',
      empty_en: 'No beneficiaries added yet. Click "+ Add to S1" to record the primary group.',
    },
    project_operator: {
      th_title: 'S2: คณะทำงานและผู้ดำเนินงานโครงการ (Project Operators)',
      en_title: 'S2: Project Operators & Staff',
      th_desc:
        'อาจารย์ นักวิจัย บุคลากร และเจ้าหน้าที่โครงการที่เป็นผู้จัดกิจกรรมหรือให้บริการวิชาการ',
      en_desc: 'Lecturers, researchers, staff, and team members who deliver project activities.',
      empty_th: 'ยังไม่มีคณะทำงาน — คลิก "+ เพิ่มในกลุ่ม S2" เพื่อระบุบุคลากรหรือคณะทำงาน',
      empty_en: 'No operators added yet. Click "+ Add to S2" to record project delivery staff.',
    },
    project_supporter: {
      th_title: 'S3: หน่วยงานสนับสนุนภายในมหาวิทยาลัย (Institutional Supporters)',
      en_title: 'S3: Institutional Supporters',
      th_desc:
        'คณะ, ภาควิชา, กองบริหารการวิจัย, หรือส่วนงานภายในมหาวิทยาลัยนเรศวรที่สนับสนุนงบประมาณหรือสถานที่',
      en_desc:
        'Faculties, departments, research divisions, or university offices providing funding or resources.',
      empty_th:
        'ยังไม่มีหน่วยงานสนับสนุนภายใน — คลิก "+ เพิ่มในกลุ่ม S3" เพื่อระบุคณะหรือกองทุนสนับสนุน',
      empty_en:
        'No internal supporters yet. Click "+ Add to S3" to record faculty or university funding.',
    },
    other_agency: {
      th_title: 'S4: หน่วยงานภายนอกและภาคีเครือข่าย (External Partners & Agencies)',
      en_title: 'S4: External Partners & Agencies',
      th_desc:
        'องค์กรปกครองส่วนท้องถิ่น (อปท.), โรงพยาบาลชุมชน, กระทรวง, ภาคธุรกิจ, หรือแหล่งทุนภายนอก',
      en_desc:
        'Local government authorities, community clinics, ministries, private partners, or donors.',
      empty_th: 'ยังไม่มีภาคีภายนอก — คลิก "+ เพิ่มในกลุ่ม S4" เพื่อระบุหน่วยงานความร่วมมือภายนอก',
      empty_en:
        'No external partners yet. Click "+ Add to S4" to record external partner contributions.',
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
      empty_th: 'ยังไม่มีข้อมูลในกลุ่มนี้',
      empty_en: 'Nothing in this group yet.',
    };

    return `
      <section class="card in-group" data-group="${g.key}">
        <div class="card-head">
          <div>
            <h2 class="card-title">${escapeHtml(isTh ? info.th_title : info.en_title)}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${escapeHtml(isTh ? info.th_desc : info.en_desc)}</p>
          </div>
          <div style="display: flex; gap: var(--sp-md); align-items: center; flex-wrap: wrap;">
            ${total ? `<span class="muted">${t('in_funding_total', 'เงินสนับสนุนรวม')}: <b>${escapeHtml(project.currency)} ${formatBaht(total)}</b></span>` : ''}
            <button class="btn btn-primary" data-add-in="${g.key}">${icons.plus} ${isTh ? `+ เพิ่มในกลุ่ม ${g.code}` : `+ Add to ${g.code}`}</button>
          </div>
        </div>
        ${
          list.length === 0
            ? `<div class="in-empty muted" style="padding: var(--sp-md) var(--sp-lg); background: var(--surface-soft); border-radius: var(--radius-sm); border: 1px dashed var(--outline); font-size: 0.8125rem;">
                ${escapeHtml(isTh ? info.empty_th : info.empty_en)}
              </div>`
            : `<div class="table-wrap"><table class="table">
                <thead><tr>
                  <th>${t('in_code', 'รหัส')}</th><th>${t('in_name_short', 'ผู้มีส่วนได้ส่วนเสีย')}</th>
                  <th class="num">${t('in_count', 'จำนวนประชากร')}</th><th class="num">${t('in_funding_short', 'งบสนับสนุน')}</th>
                  <th class="num">${t('in_col_outcomes', 'ผลลัพธ์ที่เชื่อมโยง')}</th><th></th>
                </tr></thead>
                <tbody>${list.map(rowHtml).join('')}</tbody>
              </table></div>`
        }
      </section>`;
  };

  const loose = stakeholders.filter((s) => !groupByKey(s.stakeholder_group));

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <!-- Guidance Banner -->
      <div class="alert alert-info in-banner" style="background: rgba(25, 118, 210, 0.08); border-left: 4px solid var(--primary); padding: var(--sp-md);">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--primary); display: block; margin-bottom: 2px;">
            ${isTh ? 'ขั้นตอนที่ 2: ระบุผู้มีส่วนได้ส่วนเสีย (Stakeholders)' : 'Step 2: Identify Stakeholders'}
          </strong>
          <span style="font-size: 0.8125rem; color: var(--on-background);">
            ${
              isTh
                ? 'ผู้มีส่วนได้ส่วนเสียคือบุคคล ชุมชน หรือองค์กรที่ได้รับผลกระทบหรือเกิดการเปลี่ยนแปลงเพราะโครงการของคุณ โดยแบ่งออกเป็น 4 กลุ่ม (S1–S4) ตามโครงสร้างมาตรฐานของมหาวิทยาลัย'
                : 'Stakeholders are people, communities, or organizations experiencing change or contributing inputs. Grouped into S1–S4 matching institutional standards.'
            }
          </span>
        </div>
      </div>

      ${
        unlinked.length
          ? `<div class="alert alert-warning in-banner">
              ${isTh ? 'มีรายการเงินลงทุนในขั้นตอนที่ 1 ที่ยังไม่ได้เชื่อมโยงกับผู้สนับสนุน' : 'Investment items not linked to any stakeholder'}: <b>${unlinked.length}</b>
              — <a href="#/wizard/step-1">${isTh ? 'กลับไปเลือกผู้สนับสนุนในขั้นตอนที่ 1 (ไม่บังคับ)' : 'Go to Step 1 to link funders (optional)'}</a>
            </div>`
          : ''
      }

      ${GROUPS.map(groupSection).join('')}

      ${
        loose.length
          ? `<section class="card in-group">
              <div class="card-head"><div><h2 class="card-title">${t('grp_none', 'Unclassified')}</h2>
              <p class="muted" style="font-size: 0.8125rem;">${t('in_loose_hint', 'Older entries without a group — open one and pick S1–S4.')}</p></div></div>
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

function openStakeholderModal({ initialData = null, defaultGroup = null, onSaved }) {
  const { project, stakeholders, costs } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';
  let editId = initialData?.id ?? null;
  let keySeq = 0;
  const newKey = () => `r${++keySeq}`;

  let group = groupByKey(initialData?.stakeholder_group) || groupByKey(defaultGroup) || null;
  let codeTouched = !!initialData?.group_code;
  let unitTouched = !!initialData?.count_unit;

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
  if (rows.length === 0 && (!group || group.fundsByDefault) && !initialData)
    rows.push({ key: newKey(), year: 0, category: 'opex' });

  const body = `
    <form id="stakeholderForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
      <div class="field">
        <span class="field-label">${isTh ? 'กลุ่มผู้มีส่วนได้ส่วนเสีย (S1–S4 ตามมาตรฐานมหาวิทยาลัย) *' : 'Group (S1–S4) *'}</span>
        <div class="in-chips" id="groupChips" role="radiogroup">
          ${GROUPS.map(
            (g) =>
              `<label class="in-chip ${group?.key === g.key ? 'is-on' : ''}"><input type="radio" name="grp" value="${g.key}" ${group?.key === g.key ? 'checked' : ''} /><b>${g.code}</b> ${escapeHtml(groupLabel(g).replace(/^S\d\s*/, ''))}</label>`,
          ).join('')}
        </div>
      </div>

      <div class="in-grid">
        <label class="field in-w6"><span class="field-label">${isTh ? 'ชื่อผู้มีส่วนได้ส่วนเสียคือใคร? *' : 'Stakeholder name *'}</span>
          <input class="input" name="name" value="${escapeHtml(initialData?.name || '')}" placeholder="${isTh ? 'เช่น ผู้สูงอายุและประชาชนในชุมชน, นิสิตชั้นปีที่ 3' : 'e.g. Elderly and community residents'}" required /></label>
        <label class="field in-w2"><span class="field-label">${isTh ? 'รหัสกลุ่ม (Code)' : 'Code'}</span>
          <input class="input" name="group_code" value="${escapeHtml(initialData?.group_code || '')}" placeholder="S1.1" /></label>
        <label class="field in-w2"><span class="field-label">${isTh ? 'จำนวนประชากร' : 'Population'}</span>
          <input class="input" name="estimated_count" type="number" min="0" step="1" value="${initialData?.estimated_count ?? ''}" placeholder="120" /></label>
        <label class="field in-w2"><span class="field-label">${isTh ? 'หน่วยนับ' : 'Unit'}</span>
          <input class="input" name="count_unit" list="unitList" value="${escapeHtml(initialData?.count_unit || '')}" placeholder="${isTh ? 'คน' : 'people'}" />
          <datalist id="unitList">${UNIT_SUGGESTIONS.map((u) => `<option value="${u}"></option>`).join('')}</datalist></label>
        <label class="field in-w6"><span class="field-label">${isTh ? 'บทบาทหรือลักษณะการมีส่วนร่วมในโครงการ' : 'Role / Activity in project'}</span>
          <input class="input" name="role_in_project" value="${escapeHtml(initialData?.role_in_project || '')}" placeholder="${isTh ? 'เช่น เข้ารับการตรวจคัดกรองสายตา, สนับสนุนงบประมาณและสถานที่' : 'e.g. Receives screening, provides venue'}" /></label>
        <label class="field in-w6"><span class="field-label">${isTh ? 'หมายเหตุเพิ่มเติม' : 'Notes'}</span>
          <input class="input" name="description" value="${escapeHtml(initialData?.description || '')}" /></label>
      </div>

      <details class="in-more">
        <summary>${isTh ? 'ข้อมูลเพิ่มเติม (ไม่บังคับ)' : 'More details (optional)'}</summary>
        <div class="in-grid" style="margin-top: var(--sp-sm);">
          <label class="field in-w6"><span class="field-label">${t('col_cost_cat', 'หมวดหมู่')}</span>
            <select class="input" name="category">${CATEGORIES.map((c) => `<option value="${c}" ${initialData?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="field in-w6"><span class="field-label">${t('field_rationale', 'แหล่งข้อมูลอ้างอิง')}</span>
            <input class="input" name="evidence_source" value="${escapeHtml(initialData?.evidence_source || '')}" /></label>
          <label class="field in-w6"><span class="field-label">${t('field_expected_benefits', 'ผลประโยชน์ที่คาดว่าจะได้รับ')}</span>
            <input class="input" name="expected_positive" value="${escapeHtml(initialData?.expected_positive || '')}" /></label>
          <label class="field in-w6"><span class="field-label">${t('field_potential_harms', 'ผลกระทบเชิงลบที่อาจเกิดขึ้น')}</span>
            <input class="input" name="expected_negative" value="${escapeHtml(initialData?.expected_negative || '')}" /></label>
          <label class="field in-w12"><span class="field-label">${t('field_overlap_notes', 'บันทึกป้องกันการนับซ้ำ (Overlap safeguard)')}</span>
            <input class="input" name="overlap_notes" value="${escapeHtml(initialData?.overlap_notes || '')}" /></label>
        </div>
      </details>

      <section class="in-fund">
        <div class="in-fund-head">
          <div>
            <h3>${isTh ? 'งบประมาณหรือทรัพยากรที่กลุ่มนี้จัดสรรให้กับโครงการ (ถ้ามี)' : 'Funding / resources provided (INPUTS)'}</h3>
            <p class="muted">${isTh ? 'กรอกที่นี่เพียงครั้งเดียว ข้อมูลจะเชื่อมโยงไปยังขั้นตอนที่ 1 โดยอัตโนมัติ' : 'Enter here once — automatically linked to Step 1 investment.'}</p>
          </div>
          <span class="in-fund-total muted" id="fundTotal"></span>
        </div>
        <div id="fundRows"></div>
        <button type="button" class="line-add" id="btnAddFund">＋ ${isTh ? 'เพิ่มรายการงบประมาณ / สิ่งสนับสนุน' : 'Add funding line'}</button>
      </section>

      <div id="stakeholderModalError" class="alert alert-danger" style="display: none;"></div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'ยกเลิก')}</button>
    ${editId ? '' : `<button class="btn btn-secondary" id="btnSaveStkNext">${isTh ? 'บันทึกและเพิ่มคนต่อไป' : 'Save & add next'}</button>`}
    <button class="btn btn-primary" id="btnSaveStakeholder">${isTh ? 'บันทึกข้อมูลผู้มีส่วนได้ส่วนเสีย' : 'Save Stakeholder'}</button>`;

  openModal({
    title: editId
      ? isTh
        ? 'แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย'
        : 'Edit Stakeholder'
      : isTh
        ? 'เพิ่มผู้มีส่วนได้ส่วนเสีย (Add Stakeholder)'
        : 'Add Stakeholder',
    body,
    footer,
    size: 'lg',
  });

  const form = document.getElementById('stakeholderForm');
  const rowsBox = document.getElementById('fundRows');
  const errBox = document.getElementById('stakeholderModalError');
  const showErr = (msg) => {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ block: 'nearest' });
  };

  const syncGroupUI = () => {
    document.querySelectorAll('#groupChips .in-chip').forEach((c) => {
      const radio = c.querySelector('input[type=radio]');
      c.classList.toggle('is-on', radio.value === group?.key);
    });
    if (group && !codeTouched) form.group_code.value = nextGroupCode(stakeholders, group);
    if (group && !unitTouched && !form.count_unit.value) form.count_unit.value = group.unit;
  };

  const renderFundRows = () => {
    rowsBox.innerHTML = rows.map((r, i) => fundingRowHtml(r, i, project)).join('');
    updateFundTotal();
    rowsBox.querySelectorAll('.in-fund-row').forEach((div) => {
      const k = div.dataset.key;
      const r = rows.find((x) => x.key === k);
      div
        .querySelector('input[name=desc]')
        .addEventListener('input', (e) => (r.description = e.target.value));
      div.querySelector('input[name=amount]').addEventListener('input', (e) => {
        r.amount = parseAmount(e.target.value);
        updateFundTotal();
      });
      div
        .querySelector('input[name=year]')
        .addEventListener('input', (e) => (r.year = parseInt(e.target.value, 10) || 0));
      div
        .querySelector('input[name=source]')
        .addEventListener('input', (e) => (r.evidence_source = e.target.value));
      div.querySelector('input[name=inkind]').addEventListener('change', (e) => {
        r.category = e.target.checked ? 'in_kind' : 'opex';
        r.is_cash = !e.target.checked;
      });
      div.querySelector('[data-del-row]').addEventListener('click', () => {
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

  form.querySelectorAll('#groupChips input[type=radio]').forEach((radio) => {
    radio.addEventListener('change', () => {
      group = groupByKey(radio.value);
      syncGroupUI();
    });
  });

  form.group_code.addEventListener('input', () => (codeTouched = true));
  form.count_unit.addEventListener('input', () => (unitTouched = true));
  document.getElementById('btnAddFund').addEventListener('click', () => {
    rows.push({ key: newKey(), year: 0, category: 'opex', is_cash: true });
    renderFundRows();
  });

  renderFundRows();
  syncGroupUI();

  const save = async (andNext) => {
    errBox.style.display = 'none';
    const name = form.name.value.trim();
    if (!name) {
      showErr(t('required', 'Please enter a stakeholder name.'));
      form.name.focus();
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
      .filter(
        (r) => r.description?.trim() && typeof r.amount === 'number' && !Number.isNaN(r.amount),
      )
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
      count_unit: form.count_unit.value.trim() || null,
      estimated_count:
        form.estimated_count.value !== '' ? Number(form.estimated_count.value) : null,
      role_in_project: form.role_in_project.value.trim() || null,
      description: form.description.value.trim() || null,
      category: form.category.value,
      evidence_source: form.evidence_source.value.trim() || null,
      expected_positive: form.expected_positive.value.trim() || null,
      expected_negative: form.expected_negative.value.trim() || null,
      overlap_notes: form.overlap_notes.value.trim() || null,
    };

    const btns = document.querySelectorAll('#btnSaveStakeholder, #btnSaveStkNext');
    btns.forEach((b) => (b.disabled = true));
    try {
      await saveStakeholderWithInputs(editId, stkData, cleanInputs);
      closeModal();
      onSaved();
      if (andNext) {
        openStakeholderModal({ defaultGroup: group.key, onSaved });
      }
    } catch (err) {
      showErr(err.message);
      btns.forEach((b) => (b.disabled = false));
    }
  };

  document.getElementById('btnSaveStakeholder')?.addEventListener('click', () => save(false));
  document.getElementById('btnSaveStkNext')?.addEventListener('click', () => save(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.name.focus();
}
