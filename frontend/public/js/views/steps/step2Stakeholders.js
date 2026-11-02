/**
 * Step 2: Stakeholders AND their funding — entered once, laid out like the Excel (S1–S4 groups).
 *
 * One form per stakeholder holds everything the workbook asks for on that row: name, population + unit, activity,
 * and the funding / resources ("INPUTS") that stakeholder provides. Funding lines are saved as investment items linked
 * to the stakeholder, so Step 1 (Investment) shows them automatically and nothing has to be typed twice.
 */

import { getState, saveStakeholderWithInputs, removeStakeholder } from '../../store.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { GROUPS, UNIT_SUGGESTIONS, groupByKey, groupLabel, nextGroupCode, parseAmount } from '../../utils/stakeholderGroups.js';
import { t } from '../../i18n.js';

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
  if (!project) {
    container.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }

  const fundingOf = (id) => costs.filter((c) => c.stakeholder_id === id).reduce((n, c) => n + Number(c.amount) * Number(c.exchange_rate || 1), 0);
  const fundingCount = (id) => costs.filter((c) => c.stakeholder_id === id).length;
  const unlinked = costs.filter((c) => !c.stakeholder_id);

  const rowHtml = (s) => `
    <tr data-id="${s.id}">
      <td>${s.group_code ? `<span class="badge badge-integrated">${escapeHtml(s.group_code)}</span>` : ''}</td>
      <td>
        <div class="strong">${escapeHtml(s.name)}</div>
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

  const groupSection = (g) => {
    const list = stakeholders.filter((s) => s.stakeholder_group === g.key);
    const total = list.reduce((n, s) => n + fundingOf(s.id), 0);
    return `
      <section class="card in-group" data-group="${g.key}">
        <div class="card-head">
          <div>
            <h2 class="card-title">${escapeHtml(groupLabel(g))}</h2>
            <p class="muted" style="font-size: 0.8125rem;">${t(`grp_hint_${g.code.toLowerCase()}`, '')}</p>
          </div>
          <div style="display: flex; gap: var(--sp-md); align-items: center; flex-wrap: wrap;">
            ${total ? `<span class="muted">${t('in_funding_total', 'Funding total')}: <b>${escapeHtml(project.currency)} ${formatBaht(total)}</b></span>` : ''}
            <button class="btn btn-primary" data-add-in="${g.key}">${icons.plus} ${t('in_add_to', 'Add to')} ${g.code}</button>
          </div>
        </div>
        ${
          list.length === 0
            ? `<p class="in-empty muted">${t('in_empty_group', 'Nothing here yet.')}</p>`
            : `<div class="table-wrap"><table class="table">
                <thead><tr>
                  <th>${t('in_code', 'Code')}</th><th>${t('in_name_short', 'Stakeholder')}</th>
                  <th class="num">${t('in_count', 'Population')}</th><th class="num">${t('in_funding_short', 'Funding')}</th>
                  <th class="num">${t('in_col_outcomes', 'Outcomes')}</th><th></th>
                </tr></thead>
                <tbody>${list.map(rowHtml).join('')}</tbody>
              </table></div>`
        }
      </section>`;
  };

  const loose = stakeholders.filter((s) => !groupByKey(s.stakeholder_group));

  container.innerHTML = `
    <div class="stack" style="gap: var(--sp-xl);">
      <div class="alert alert-info in-banner">
        <div>
          <strong>${t('in_step2_title', 'Enter each stakeholder once.')}</strong>
          ${t('in_step2_desc', 'Pick the group (S1–S4), then fill the stakeholder and the funding they provide in the same form. Funding appears in Step 1 automatically; in Step 3 you only pick the stakeholder from a list.')}
        </div>
      </div>
      ${
        unlinked.length
          ? `<div class="alert alert-warning in-banner">
              ${t('in_unlinked', 'Investment items not linked to any stakeholder')}: <b>${unlinked.length}</b>
              — ${t('in_unlinked_hint', 'open Step 1 and choose a funder for each one (optional).')}
              <a href="#/wizard/step-1">${t('in_go_step1', 'Go to Step 1')}</a>
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
    </div>`;

  const refresh = () => renderStep2(container);

  container.querySelectorAll('[data-add-in]').forEach((btn) =>
    btn.addEventListener('click', () => openStakeholderModal({ defaultGroup: btn.dataset.addIn, onSaved: refresh })),
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
          ? t('in_confirm_delete_funded', 'Delete this stakeholder? Its funding lines are kept in Step 1 but become unlinked.')
          : t('confirm_delete', 'Are you sure you want to delete this stakeholder? Any associated outcomes will need to be re-assigned.'),
        onConfirm: async () => {
          try {
            await removeStakeholder(sId);
            // the server keeps the cost rows (stakeholder_id → NULL); mirror that locally
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
}

function fundingRowHtml(row, idx, project) {
  const k = row.key;
  return `
    <div class="in-fund-row" data-key="${k}">
      <span class="in-fund-n">${idx + 1}</span>
      <label class="field in-f-desc"><span class="field-label">${t('in_fund_desc', 'Resource / item')}</span>
        <input class="input" name="desc" value="${escapeHtml(row.description || '')}" placeholder="${t('in_fund_desc_ph', 'e.g. Budget from the faculty, travel cost')}" /></label>
      <label class="field in-f-amt"><span class="field-label">${t('in_fund_amount', 'Amount')} (${escapeHtml(project.currency)})</span>
        <input class="input" name="amount" type="text" inputmode="decimal" autocomplete="off" value="${row.amount ?? ''}" placeholder="0" /></label>
      <label class="field in-f-year"><span class="field-label">${t('in_fund_year', 'Year (0 = Y0)')}</span>
        <input class="input" name="year" type="number" min="0" max="${project.analysis_period_years || 5}" value="${row.year ?? 0}" /></label>
      <label class="field in-f-src"><span class="field-label">${t('in_fund_source', 'Basis / source')}</span>
        <input class="input" name="source" value="${escapeHtml(row.evidence_source || '')}" placeholder="${t('in_fund_source_ph', 'How it was calculated, where from')}" /></label>
      <label class="in-f-kind" title="${t('in_fund_inkind_hint', 'Tick when it is not cash (volunteer time, venue, equipment)')}"><input type="checkbox" name="inkind" ${row.category === 'in_kind' ? 'checked' : ''} /> ${t('in_fund_inkind', 'In-kind')}</label>
      <button type="button" class="btn-icon in-f-del" data-del-row="${k}" title="${t('delete', 'Delete')}" aria-label="${t('delete', 'Delete')}">✕</button>
    </div>`;
}

function openStakeholderModal({ initialData = null, defaultGroup = null, onSaved }) {
  const { project, stakeholders, costs } = getState();
  let editId = initialData?.id ?? null;
  let keySeq = 0;
  const newKey = () => `r${++keySeq}`;

  let group = groupByKey(initialData?.stakeholder_group) || groupByKey(defaultGroup) || null;
  let codeTouched = !!initialData?.group_code;
  let unitTouched = !!initialData?.count_unit;

  // funding lines of this stakeholder (edit) — each keeps its id so saving updates instead of duplicating
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
  if (rows.length === 0 && (!group || group.fundsByDefault) && !initialData) rows.push({ key: newKey(), year: 0, category: 'opex' });

  const body = `
    <form id="stakeholderForm" class="stack" style="gap: var(--sp-md);" autocomplete="off">
      <div class="field">
        <span class="field-label">${t('in_group_pick', 'Group (S1–S4 as in the Excel)')} *</span>
        <div class="in-chips" id="groupChips" role="radiogroup">
          ${GROUPS.map(
            (g) => `<label class="in-chip ${group?.key === g.key ? 'is-on' : ''}"><input type="radio" name="grp" value="${g.key}" ${group?.key === g.key ? 'checked' : ''} /><b>${g.code}</b> ${escapeHtml(groupLabel(g).replace(/^S\d\s*/, ''))}</label>`,
          ).join('')}
        </div>
      </div>

      <div class="in-grid">
        <label class="field in-w6"><span class="field-label">${t('in_name', 'Stakeholder name')} *</span>
          <input class="input" name="name" value="${escapeHtml(initialData?.name || '')}" placeholder="${t('in_name_ph', 'e.g. Faculty of Allied Health Sciences')}" required /></label>
        <label class="field in-w2"><span class="field-label">${t('in_code', 'Code')}</span>
          <input class="input" name="group_code" value="${escapeHtml(initialData?.group_code || '')}" placeholder="S3.1" /></label>
        <label class="field in-w2"><span class="field-label">${t('in_count', 'Population')}</span>
          <input class="input" name="estimated_count" type="number" min="0" step="1" value="${initialData?.estimated_count ?? ''}" /></label>
        <label class="field in-w2"><span class="field-label">${t('in_unit', 'Unit')}</span>
          <input class="input" name="count_unit" list="unitList" value="${escapeHtml(initialData?.count_unit || '')}" />
          <datalist id="unitList">${UNIT_SUGGESTIONS.map((u) => `<option value="${u}"></option>`).join('')}</datalist></label>
        <label class="field in-w6"><span class="field-label">${t('in_activity', 'Activity / resource')}</span>
          <input class="input" name="role_in_project" value="${escapeHtml(initialData?.role_in_project || '')}" placeholder="${t('in_activity_ph', 'e.g. provides budget and venue')}" /></label>
        <label class="field in-w6"><span class="field-label">${t('in_note', 'Note')}</span>
          <input class="input" name="description" value="${escapeHtml(initialData?.description || '')}" /></label>
      </div>

      <details class="in-more">
        <summary>${t('in_more', 'More details (optional)')}</summary>
        <div class="in-grid" style="margin-top: var(--sp-sm);">
          <label class="field in-w6"><span class="field-label">${t('col_cost_cat', 'Category')}</span>
            <select class="input" name="category">${CATEGORIES.map((c) => `<option value="${c}" ${initialData?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="field in-w6"><span class="field-label">${t('field_rationale', 'Evidence / source')}</span>
            <input class="input" name="evidence_source" value="${escapeHtml(initialData?.evidence_source || '')}" /></label>
          <label class="field in-w6"><span class="field-label">${t('field_expected_benefits', 'Expected positive outcomes')}</span>
            <input class="input" name="expected_positive" value="${escapeHtml(initialData?.expected_positive || '')}" /></label>
          <label class="field in-w6"><span class="field-label">${t('field_potential_harms', 'Potential harms')}</span>
            <input class="input" name="expected_negative" value="${escapeHtml(initialData?.expected_negative || '')}" /></label>
          <label class="field in-w12"><span class="field-label">${t('field_overlap_notes', 'Overlap safeguard notes')}</span>
            <input class="input" name="overlap_notes" value="${escapeHtml(initialData?.overlap_notes || '')}" /></label>
        </div>
      </details>

      <section class="in-fund">
        <div class="in-fund-head">
          <div>
            <h3>${t('in_funding_title', 'Funding / resources used (INPUTS)')}</h3>
            <p class="muted">${t('in_funding_hint', 'Enter it here once — it is added to Step 1 (Investment) automatically.')}</p>
          </div>
          <span class="in-fund-total muted" id="fundTotal"></span>
        </div>
        <div id="fundRows"></div>
        <button type="button" class="line-add" id="btnAddFund">＋ ${t('in_fund_add', 'Add a funding line')}</button>
      </section>

      <div id="stakeholderModalError" class="alert alert-danger" style="display: none;"></div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
    ${editId ? '' : `<button class="btn btn-secondary" id="btnSaveStkNext">${t('in_save_add', 'Save & add next')}</button>`}
    <button class="btn btn-primary" id="btnSaveStakeholder">${t('save', 'Save')}</button>`;

  openModal({
    title: editId ? t('modal_edit_stakeholder_title', 'Edit Stakeholder') : t('modal_add_stakeholder_title', 'Add Stakeholder'),
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

  /** copy what is typed back into `rows` (so re-rendering the lines never loses input) */
  const readRows = () => {
    rowsBox.querySelectorAll('.in-fund-row').forEach((el) => {
      const r = rows.find((x) => x.key === el.dataset.key);
      if (!r) return;
      r.description = el.querySelector('[name=desc]').value;
      r.amount = el.querySelector('[name=amount]').value;
      r.year = el.querySelector('[name=year]').value;
      r.evidence_source = el.querySelector('[name=source]').value;
      r.inkind = el.querySelector('[name=inkind]').checked;
    });
  };
  const renderRows = () => {
    rowsBox.innerHTML = rows.length
      ? rows.map((r, i) => fundingRowHtml(r, i, project)).join('')
      : `<p class="in-empty muted">${t('in_fund_none', 'No funding lines. Add one if this stakeholder provides money or resources.')}</p>`;
    updateTotal();
  };
  const updateTotal = () => {
    let sum = 0;
    rowsBox.querySelectorAll('[name=amount]').forEach((i) => {
      const v = parseAmount(i.value);
      if (v && !Number.isNaN(v)) sum += v;
    });
    document.getElementById('fundTotal').textContent = sum ? `${t('in_funding_total', 'Funding total')}: ${project.currency} ${formatBaht(sum)}` : '';
  };
  renderRows();

  rowsBox.addEventListener('input', updateTotal);
  rowsBox.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-row]');
    if (!del) return;
    readRows();
    rows.splice(
      rows.findIndex((r) => r.key === del.dataset.delRow),
      1,
    );
    renderRows();
  });
  document.getElementById('btnAddFund').addEventListener('click', () => {
    readRows();
    rows.push({ key: newKey(), year: 0, category: 'opex' });
    renderRows();
    rowsBox.querySelector('.in-fund-row:last-child [name=desc]')?.focus();
  });

  // choosing S1–S4 fills the code and unit for you (until you type your own)
  const applyGroup = () => {
    if (!group) return;
    if (!codeTouched) form.group_code.value = nextGroupCode(stakeholders.filter((s) => s.id !== editId), group);
    if (!unitTouched) form.count_unit.value = group.unit;
    document.querySelectorAll('#groupChips .in-chip').forEach((c) => c.classList.toggle('is-on', c.querySelector('input').value === group.key));
  };
  document.getElementById('groupChips').addEventListener('change', (e) => {
    group = groupByKey(e.target.value);
    applyGroup();
    if (group.fundsByDefault && rows.length === 0 && !editId) {
      rows.push({ key: newKey(), year: 0, category: 'opex' });
      renderRows();
    }
  });
  form.group_code.addEventListener('input', () => (codeTouched = true));
  form.count_unit.addEventListener('input', () => (unitTouched = true));
  if (group && !initialData) applyGroup();

  const collect = () => {
    readRows();
    const name = form.name.value.trim();
    if (!group) throw new Error(t('in_err_group', 'Please choose a group (S1–S4).'));
    if (!name) throw new Error(t('required', 'Please enter a stakeholder name.'));
    const count = form.estimated_count.value === '' ? null : parseInt(form.estimated_count.value, 10);

    const inputs = [];
    rows.forEach((r, i) => {
      const desc = String(r.description || '').trim();
      const amount = parseAmount(r.amount);
      const blank = !desc && (amount === null || Number.isNaN(amount));
      if (blank && !r.id) return; // an untouched new line is simply ignored
      if (!desc || amount === null || Number.isNaN(amount) || amount < 0) {
        throw new Error(t('in_row_err', 'Funding line {n}: enter both the item and a valid amount (or press ✕ to remove the line).').replace('{n}', String(i + 1)));
      }
      const year = parseInt(r.year, 10);
      if (Number.isNaN(year) || year < 0) throw new Error(`${t('in_fund_year', 'Year')} ${i + 1}: ≥ 0`);
      const inkind = r.inkind !== undefined ? r.inkind : r.category === 'in_kind';
      inputs.push({
        id: r.id,
        description: desc,
        amount,
        year,
        category: inkind ? 'in_kind' : r.category && r.category !== 'in_kind' ? r.category : 'opex',
        is_cash: !inkind,
        evidence_source: String(r.evidence_source || '').trim(),
        _row: r,
      });
    });

    return {
      data: {
        name,
        stakeholder_group: group.key,
        group_code: form.group_code.value.trim() || null,
        category: form.category.value,
        estimated_count: count,
        count_unit: form.count_unit.value.trim() || null,
        role_in_project: form.role_in_project.value.trim(),
        description: form.description.value.trim(),
        expected_positive: form.expected_positive.value.trim(),
        expected_negative: form.expected_negative.value.trim(),
        evidence_source: form.evidence_source.value.trim(),
        overlap_notes: form.overlap_notes.value.trim(),
      },
      inputs,
    };
  };

  const save = async (andNext) => {
    errBox.style.display = 'none';
    let payload;
    try {
      payload = collect();
    } catch (err) {
      showErr(err.message);
      return;
    }
    const btns = document.querySelectorAll('#btnSaveStakeholder, #btnSaveStkNext');
    btns.forEach((b) => (b.disabled = true));
    try {
      const stk = await saveStakeholderWithInputs({ id: editId, ...payload });
      closeModal();
      onSaved();
      // "save & add next": reopen with the same group chosen, ready for the next row
      if (andNext) openStakeholderModal({ defaultGroup: group.key, onSaved });
      return stk;
    } catch (err) {
      // a failure after the stakeholder was created: continue in edit mode so a retry never creates a duplicate
      if (err.savedStakeholder) {
        editId = err.savedStakeholder.id;
        payload.inputs.forEach((i) => {
          if (i.id && i._row) i._row.id = i.id;
        });
      }
      showErr(err.message);
      btns.forEach((b) => (b.disabled = false));
    }
  };

  document.getElementById('btnSaveStakeholder').addEventListener('click', () => save(false));
  document.getElementById('btnSaveStkNext')?.addEventListener('click', () => save(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.name.focus();
}
