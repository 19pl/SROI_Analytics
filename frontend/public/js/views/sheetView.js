/**
 * Sheet mode — enter and calculate an SROI plan the way the customer's Excel workbooks do.
 *
 * One page, laid out like the workbook: the four fixed main groups S1–S4 are the headings, and under each heading the
 * user adds the stakeholder rows (S1.1, S1.2 … = the rows under "S1." in the Excel). Each stakeholder row is a card whose
 * sections are stacked vertically (no sideways scrolling across the whole sheet):
 *   Stakeholder (name · count · unit · activity) → Inputs → Outcomes → Valuation → Adjustment
 * Number cells accept formulas (=63999000/20). The backend is authoritative: every save is validated and the totals
 * shown here are the engine's result, never computed in the browser.
 * Users can add their own topics ("custom columns") to any band, and rows (lines / stakeholders) anywhere.
 *
 * Data model note: a stakeholder row is a `sheet_groups` row whose parent is the S-group. Older plans may hold data
 * directly on an S-group; that data is never hidden or dropped — it is shown in its own block (see hasDirectData).
 */

import { api } from '../api.js';
import { getState } from '../store.js';
import { escapeHtml as esc } from '../utils/html.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { t } from '../i18n.js';

// ---- built-in columns (the union of the two workbooks) ----------------------------------------------------------
// type: text | long | raw (number or formula) | pct | select | calc (read-only result)
const STK = [
  { k: 'population_raw', l: 'sheet_col_population', type: 'raw', w: 120, calc: 'population' },
  { k: 'unit', l: 'sheet_col_unit', type: 'text', w: 90 },
  { k: 'activity', l: 'sheet_col_activity', type: 'long', w: 190 },
  { k: 'note', l: 'sheet_col_note', type: 'long', w: 170 },
  { k: 'actual_count_raw', l: 'sheet_col_actual', type: 'raw', w: 130, calc: 'actual_count' },
  { k: 'actual_count_method', l: 'sheet_col_actual_method', type: 'long', w: 190 },
];
const INP = [
  { k: 'resource', l: 'sheet_col_resource', type: 'long', w: 230 },
  { k: 'y0_raw', l: 'sheet_col_y0_in', type: 'raw', w: 140, calc: 'y0' },
  { k: 'y1_raw', l: 'sheet_col_y1_in', type: 'raw', w: 140, calc: 'y1' },
  { k: 'total', l: 'sheet_col_total', type: 'calc', w: 120, calc: 'total' },
  { k: 'basis', l: 'sheet_col_basis', type: 'long', w: 230 },
  { k: 'source', l: 'sheet_col_source', type: 'long', w: 190 },
];
const OUT = [
  { k: 'dimension', l: 'sheet_col_dimension', type: 'select', w: 120, options: ['economic', 'social', 'environmental', 'other'] },
  { k: 'beneficiary', l: 'sheet_col_beneficiary', type: 'long', w: 140 },
  { k: 'outcome', l: 'sheet_col_outcome', type: 'long', w: 240 },
  { k: 'quantity_text', l: 'sheet_col_quantity', type: 'long', w: 170 },
  { k: 'weight', l: 'sheet_col_weight', type: 'pct', w: 100 },
  { k: 'indicator', l: 'sheet_col_indicator', type: 'long', w: 190 },
  { k: 'valuation_method', l: 'sheet_col_valuation', type: 'long', w: 240 },
  { k: 'y0_raw', l: 'sheet_col_y0_out', type: 'raw', w: 140, calc: 'y0' },
  { k: 'y1_raw', l: 'sheet_col_y1_out', type: 'raw', w: 140, calc: 'y1' },
  { k: 'gross_total', l: 'sheet_col_total', type: 'calc', w: 120, calc: 'gross_total' },
  { k: 'source', l: 'sheet_col_source', type: 'long', w: 190 },
];
const ADJ = [
  { k: 'adj_y0', l: 'sheet_col_adj_y0', type: 'pct', w: 100 },
  { k: 'adj_y0_reason', l: 'sheet_col_adj_y0_reason', type: 'long', w: 190 },
  { k: 'adj_y1', l: 'sheet_col_adj_y1', type: 'pct', w: 100 },
  { k: 'adj_y1_reason', l: 'sheet_col_adj_y1_reason', type: 'long', w: 190 },
  { k: 'adjusted_total', l: 'sheet_col_adjusted', type: 'calc', w: 130, calc: 'adjusted_total' },
  { k: 'adj_source', l: 'sheet_col_adj_source', type: 'long', w: 190 },
];
const byKey = (list, keys) => keys.map((k) => list.find((c) => c.k === k));

// ---- layout of each block: a 12-column grid, so related fields sit side by side and nothing scrolls sideways ----
// (the column definitions above stay the single source of truth for data; these maps only decide placement)
const STK_FIELDS = byKey(STK, ['population_raw', 'unit', 'actual_count_raw', 'actual_count_method', 'activity', 'note']);
const STK_SPAN = { population_raw: 's3', unit: 's2', actual_count_raw: 's3', actual_count_method: 's4', activity: 's6', note: 's6' };
const INP_SPAN = { resource: 's6', y0_raw: 's2', y1_raw: 's2', total: 's2', basis: 's6', source: 's6' };
const OUT_CHANGE = byKey(OUT, ['outcome', 'beneficiary', 'dimension', 'weight', 'quantity_text', 'indicator']);
const OUT_CHANGE_SPAN = { outcome: 's5', beneficiary: 's3', dimension: 's2', weight: 's2', quantity_text: 's6', indicator: 's6' };
const OUT_VALUE = byKey(OUT, ['valuation_method', 'source', 'y0_raw', 'y1_raw', 'gross_total']);
const OUT_VALUE_SPAN = { valuation_method: 's6', source: 's6', y0_raw: 's4', y1_raw: 's4', gross_total: 's4' };
const ADJ_SPAN = { adj_y0: 's2', adj_y0_reason: 's4', adj_y1: 's2', adj_y1_reason: 's4', adjusted_total: 's4', adj_source: 's8' };

const fmt = (n, dp = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '–'
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
const fmtRatio = (n) => (n === null || n === undefined ? '–' : Number(n).toFixed(4));
const isPlainNumber = (s) => /^\s*-?[\d,]*\.?\d+\s*$/.test(String(s ?? ''));

export async function renderSheet(root) {
  const { project } = getState();
  if (!project) {
    root.innerHTML = `<div class="alert alert-info">${t('alert_select_project_first', 'Please select or create a project first.')}</div>`;
    return;
  }
  const pid = project.id;
  const ctx = { pid, sheet: null, readOnly: true, chain: Promise.resolve(), statusTimer: null, closed: new Set() };

  root.innerHTML = `<div class="sheet-page"><div class="muted" style="padding: var(--sp-xl);">…</div></div>`;
  try {
    ctx.sheet = (await api.getSheet(pid)).data;
  } catch (err) {
    root.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
    return;
  }
  ctx.readOnly = ctx.sheet.project.role === 'viewer';
  buildPage();

  // ================================================================== page ==================================================================

  function buildPage() {
    const s = ctx.sheet;
    const p = s.project;
    if (s.groups.length === 0) {
      root.innerHTML = `
        <div class="sheet-page">
          ${scopeHtml(p)}
          <div class="card sheet-empty">
            <h2 class="card-title">${t('sheet_empty_title', 'Start from the Excel template')}</h2>
            <p class="muted">${t('sheet_empty_desc', '')}</p>
            ${ctx.readOnly ? '' : `<button class="btn btn-primary" id="btnSheetTemplate">${t('sheet_empty_btn', 'Create groups S1–S4')}</button>`}
          </div>
        </div>`;
      bindScope();
      document.getElementById('btnSheetTemplate')?.addEventListener('click', async () => {
        await guard(async () => {
          await api.startSheetTemplate(pid);
          await reload();
        });
      });
      return;
    }
    root.innerHTML = `
      <div class="sheet-page ${ctx.readOnly ? 'is-readonly' : ''}">
        ${scopeHtml(p)}
        <div class="sheet-sticky">
          <div class="sheet-summary" id="sheetSummary"></div>
          <div class="sheet-where" id="sheetWhere" hidden aria-live="off"></div>
        </div>
        <details class="sheet-issues" id="sheetIssues"></details>
        <nav class="sheet-nav" id="sheetNav" aria-label="S1–S4"></nav>
        <div class="sheet-groups" id="sheetTable"></div>
        <div class="sheet-foot">
          ${ctx.readOnly ? `<span class="muted">${t('sheet_read_only', '')}</span>` : `<span class="muted">${t('sheet_fixed_note', '')}</span>`}
          <span class="muted">${t('sheet_formula_note', '')}</span>
        </div>
      </div>`;
    bindScope();
    bindTable(document.getElementById('sheetTable')); // delegated listeners: bound once, the rows inside are re-rendered freely
    renderTable();
    document.getElementById('sheetNav')?.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        const card = document.querySelector(`.grp-card[data-gid="${jump.dataset.jump}"]`);
        if (card) {
          setCollapsed(card, false);
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      const fold = e.target.closest('[data-fold]');
      if (fold) {
        const collapse = fold.dataset.fold === 'collapse';
        document.querySelectorAll('.grp-card.lvl-1').forEach((c) => setCollapsed(c, collapse));
        if (!collapse) document.querySelectorAll('.grp-card.lvl-0').forEach((c) => setCollapsed(c, false));
      }
    });
  }

  function periodOptions() {
    return [['', t('scope_full_year', 'Full year')], ['6', t('scope_6_months', '6 months')], ['9', t('scope_9_months', '9 months')], ['12', t('scope_12_months', '12 months')]];
  }

  /** one-line digest of the assessment settings, shown while the settings panel is folded */
  function scopeSummaryText(p) {
    const period = periodOptions().find(([v]) => v === String(p.assessment_months ?? ''))?.[1] || '';
    const evalLabel = p.evaluation_type === 'forecast' ? t('eval_type_forecast', 'Forecast') : t('eval_type_evaluative', 'Evaluative');
    const adj = String(p.adjustment_mode === 'retain' ? t('sheet_adj_retain', '') : t('sheet_adj_deduct', '')).split(':')[0];
    return [`${p.y0_label || '–'} → ${p.y1_label || '–'}`, evalLabel, period, adj].filter(Boolean).join(' · ');
  }

  function scopeHtml(p) {
    const months = periodOptions();
    const dis = ctx.readOnly ? 'disabled' : '';
    const unset = !p.y0_label && !p.y1_label; // first visit: leave the settings open so they are not missed
    return `
      <section class="card sheet-head">
        <div class="sheet-head-top">
          <div class="sheet-title">
            <h2>${esc(p.name)} <span class="badge badge-integrated">${t('sheet_badge', 'Sheet')}</span></h2>
            <p class="muted">${t('sheet_subtitle', '')}</p>
          </div>
          <span class="sheet-status" id="sheetStatus" role="status" aria-live="polite"></span>
        </div>
        ${ctx.readOnly ? '' : `<p class="sheet-tip"><span aria-hidden="true">💡</span> ${t('sheet_tip', '')}</p>`}
        <details class="sheet-settings" ${unset ? 'open' : ''}>
          <summary><span class="set-title">⚙ ${t('sheet_scope', 'Assessment settings')}</span><span class="set-sum" id="scopeSummary">${esc(scopeSummaryText(p))}</span></summary>
          <div class="sheet-scope-grid">
            <label class="field"><span class="field-label">${t('sheet_y0', 'Y0')}</span>
              <input class="input" data-scope="y0_label" value="${esc(p.y0_label || '')}" placeholder="${t('sheet_y0_ph', '')}" ${dis} /></label>
            <label class="field"><span class="field-label">${t('sheet_y1', 'Y1')}</span>
              <input class="input" data-scope="y1_label" value="${esc(p.y1_label || '')}" placeholder="${t('sheet_y1_ph', '')}" ${dis} /></label>
            <label class="field"><span class="field-label">${t('sheet_eval_type', 'Evaluation type')}</span>
              <select class="input" data-scope="evaluation_type" ${dis}>
                <option value="evaluative" ${p.evaluation_type === 'evaluative' ? 'selected' : ''}>${t('eval_type_evaluative', 'Evaluative')}</option>
                <option value="forecast" ${p.evaluation_type === 'forecast' ? 'selected' : ''}>${t('eval_type_forecast', 'Forecast')}</option>
              </select></label>
            <label class="field"><span class="field-label">${t('sheet_months', 'Period')}</span>
              <select class="input" data-scope="assessment_months" ${dis}>
                ${months.map(([v, l]) => `<option value="${v}" ${String(p.assessment_months ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></label>
            <label class="field"><span class="field-label">${t('sheet_adj_mode', 'Adjustment')}</span>
              <select class="input" data-scope="sheet_adjustment_mode" ${dis}>
                <option value="deduct" ${p.adjustment_mode === 'deduct' ? 'selected' : ''}>${t('sheet_adj_deduct', '')}</option>
                <option value="retain" ${p.adjustment_mode === 'retain' ? 'selected' : ''}>${t('sheet_adj_retain', '')}</option>
              </select></label>
          </div>
        </details>
      </section>`;
  }

  function bindScope() {
    root.querySelectorAll('[data-scope]').forEach((el) => {
      el.addEventListener('change', () =>
        enqueue(async () => {
          const field = el.dataset.scope;
          let v = el.value;
          if (field === 'assessment_months') v = v === '' ? null : Number(v);
          if ((field === 'y0_label' || field === 'y1_label') && v === '') v = null;
          setStatus('saving');
          try {
            const res = await api.updateProject(pid, { [field]: v });
            const live = getState().project;
            if (live) Object.assign(live, res.data);
            ctx.sheet.project = {
              ...ctx.sheet.project,
              y0_label: res.data.y0_label,
              y1_label: res.data.y1_label,
              evaluation_type: res.data.evaluation_type,
              assessment_months: res.data.assessment_months,
              adjustment_mode: res.data.sheet_adjustment_mode,
            };
            const digest = document.getElementById('scopeSummary');
            if (digest) digest.textContent = scopeSummaryText(ctx.sheet.project);
            await refreshResult();
            setStatus('saved');
          } catch (err) {
            setStatus('error', err.message);
          }
        }),
      );
    });
  }

  // ================================================================== table ==================================================================

  function customCols(band) {
    return ctx.sheet.columns.filter((c) => c.band === band);
  }

  // Layout: one collapsible card per group (S1–S4 → stakeholders). Inside a stakeholder the work reads top to bottom:
  //   1 Stakeholder  →  2 Inputs (one card per line)  →  3 Outcomes (one card per outcome: change · value · adjustment)
  // Every line is a small labelled form instead of a wide table row, so nothing scrolls sideways and every field has its label next to it.

  function renderTable() {
    const root2 = document.getElementById('sheetTable');
    if (!root2) return;
    const keep = captureScroll();
    const s = ctx.sheet;
    const tops = s.groups.filter((g) => g.parent_id === null);
    root2.innerHTML = tops.map((g) => groupBlock(g, 0)).join('');
    const nav = document.getElementById('sheetNav');
    if (nav) {
      const chips = tops.map((g) => {
        const n = s.groups.filter((c) => c.parent_id === g.id).length;
        return `<button type="button" class="nav-chip" data-jump="${g.id}"><b>${esc(g.code || '')}</b> ${esc(g.name)}<span class="chip-n">${n}</span></button>`;
      }).join('');
      const fold = s.groups.some((g) => g.parent_id !== null)
        ? `<span class="nav-fold"><button type="button" class="nav-link" data-fold="collapse">${t('sheet_fold_all', 'Collapse all')}</button><button type="button" class="nav-link" data-fold="expand">${t('sheet_unfold_all', 'Expand all')}</button></span>`
        : '';
      nav.innerHTML = `<span class="nav-label">${t('sheet_jump', 'Go to')}</span>${chips}${fold}`;
    }
    root2.querySelectorAll('.sc-long').forEach(autosize);
    restoreScroll(keep);
    applyResult();
  }

  function hintOf(c) {
    return c.k === 'adj_y0' || c.k === 'adj_y1' ? ` <span class="hint" title="${esc(t('sheet_adj_hint', ''))}">ⓘ</span>` : '';
  }

  /** a labelled built-in field; `span` is its width in the 12-column grid (s2 … s12) */
  function fld(c, row, kind, span) {
    if (c.type === 'calc') {
      return `<div class="fld readout ${span}"><span class="fld-label" title="${esc(t(c.l, c.k))}">${t(c.l, c.k)}</span>${cellHtml(c, row, kind)}</div>`;
    }
    return `<label class="fld ${span}"><span class="fld-label" title="${esc(t(c.l, c.k))}">${t(c.l, c.k)}${hintOf(c)}</span>${cellHtml(c, row, kind)}</label>`;
  }

  /** a labelled user-defined field (custom topic) */
  function fldCustom(c, row, kind, span = 's6') {
    const sigma = c.counts_toward !== 'none' ? ` <span class="hint" title="${esc(t('sheet_col_counts', ''))}">Σ</span>` : '';
    const edit = ctx.readOnly ? '' : ` <button type="button" class="sheet-editcol" data-editcol="${c.id}" title="${esc(t('sheet_col_modal_title', 'Custom topic'))}">✎</button>`;
    return `<label class="fld custom ${span}"><span class="fld-label">${esc(c.label)}${sigma}${edit}</span>${customCell(c, row, kind)}</label>`;
  }

  function fields(cols, row, kind, spans) {
    return cols.map((c) => fld(c, row, kind, spans[c.k] || 's6')).join('');
  }

  /** numbered section heading with a one-line explanation of what to enter */
  function secHead(n, title, desc, band) {
    const add = band && !ctx.readOnly ? `<button type="button" class="sheet-addcol" data-addcol="${band}" title="${esc(t('sheet_add_column', 'Add topic'))}">＋ ${t('sheet_add_column', 'Add topic')}</button>` : '';
    return `<div class="sec-head"><span class="sec-n">${n}</span><div class="sec-ttl"><h3>${title}</h3>${desc ? `<p>${desc}</p>` : ''}</div>${add}</div>`;
  }

  /** include-in-total checkbox + delete, shown at the corner of every line card */
  function lineTools(r, kind) {
    if (ctx.readOnly) return '';
    return `<span class="line-tools">
      <label class="sheet-inc" title="${esc(t('sheet_include', ''))}"><input type="checkbox" data-kind="${kind}" data-id="${r.id}" data-field="include_in_total" ${r.include_in_total ? 'checked' : ''} /><span>${t('sheet_include_short', 'Count')}</span></label>
      <button type="button" class="sheet-del" data-act="del-line" data-kind="${kind}" data-id="${r.id}" title="${esc(t('sheet_delete_line', ''))}" aria-label="${esc(t('sheet_delete_line', ''))}">✕ <span>${t('sheet_del_short', 'Delete')}</span></button>
    </span>`;
  }

  function addLineBtn(act, gid, label) {
    return ctx.readOnly ? '' : `<button type="button" class="line-add" data-act="${act}" data-gid="${gid}">＋ ${label}</button>`;
  }

  function groupBlock(g, level) {
    const s = ctx.sheet;
    const ins = s.inputs.filter((r) => r.group_id === g.id);
    const outs = s.outcomes.filter((r) => r.group_id === g.id);
    const ro = ctx.readOnly;
    const cs = customCols('stakeholder');
    const ci = customCols('input');
    const co = customCols('outcome');
    const collapsed = ctx.closed.has(String(g.id));

    // Level 0 = the S1–S4 heading (fixed). Level 1 = one stakeholder under it (S1.1, S1.2 …).
    // An S-heading shows its own stakeholder/input/outcome sections only when an older plan already holds data there.
    const direct = level === 1 || hasDirectData(g);
    const kids = level === 0 ? s.groups.filter((c) => c.parent_id === g.id) : [];

    const meta = level === 1
      ? `<span class="grp-count">${ins.length} ${t('sheet_group_total_in', 'Input')} · ${outs.length} ${t('sheet_group_total_out', 'Outcome')}</span>`
      : `<span class="grp-count">${kids.length} ${t('sheet_stk_label', 'Stakeholder')}</span>`;

    const head = `<header class="grp-head">
      <button type="button" class="grp-toggle" data-act="toggle" data-gid="${g.id}" aria-expanded="${!collapsed}" title="${esc(t('sheet_toggle', 'Fold / unfold'))}"><span class="chev" aria-hidden="true">▾</span></button>
      <input class="sc grp-code" data-kind="groups" data-id="${g.id}" data-field="code" value="${esc(g.code || '')}" disabled title="${esc(t('sheet_code_locked', ''))}" />
      <input class="sc grp-name" data-kind="groups" data-id="${g.id}" data-field="name" value="${esc(g.name)}" ${ro ? 'disabled' : ''} ${level === 1 ? `placeholder="${esc(t('sheet_stk_name_ph', 'Stakeholder name'))}"` : ''} aria-label="${esc(t('sheet_stk_name', 'Stakeholder name'))}" />
      ${meta}
      <span class="grp-sum"><span>${t('sheet_group_total_in', 'Input')} <b data-gsum="${g.id}:in">–</b></span><span>${t('sheet_group_total_out', 'Outcome')} <b data-gsum="${g.id}:out">–</b></span></span>
      ${level === 1 && !ro ? `<button type="button" class="sheet-del-sub" data-act="del-group" data-gid="${g.id}" title="${esc(t('sheet_delete_group', ''))}">✕ ${t('sheet_delete_sub', 'Delete stakeholder')}</button>` : ''}
    </header>`;

    // ---- 1. stakeholder ----
    const stk = `<section class="sec b-stk">
      ${secHead(1, t('sheet_band_stakeholder', 'Stakeholder'), t('sheet_sec_stk_desc', ''), 'stakeholder')}
      <div class="fgrid">${fields(STK_FIELDS, g, 'groups', STK_SPAN)}${cs.map((c) => fldCustom(c, g, 'groups')).join('')}</div></section>`;

    // ---- 2. inputs: one small card per resource line ----
    const inLines = ins.map((r, i) => `<article class="line line-inp${r.include_in_total ? '' : ' is-excluded'}">
        <span class="line-n">${i + 1}</span>
        ${lineTools(r, 'inputs')}
        <div class="fgrid">${fields(INP, r, 'inputs', INP_SPAN)}${ci.map((c) => fldCustom(c, r, 'inputs')).join('')}</div>
      </article>`).join('');
    const inputs = `<section class="sec b-inp">
      ${secHead(2, t('sheet_band_input', 'Inputs'), t('sheet_sec_input_desc', ''), 'input')}
      ${ins.length ? `<div class="line-list">${inLines}</div>` : `<p class="line-empty">${t('sheet_no_inputs', 'No input lines yet')}</p>`}
      ${addLineBtn('add-input', g.id, t('sheet_add_input_btn', 'Add an input line'))}</section>`;

    // ---- 3. outcomes: one card per outcome holding its three blocks — change · value · adjustment ----
    const outCards = outs.map((r, i) => `<article class="line line-out${r.include_in_total ? '' : ' is-excluded'}">
        <header class="line-head">
          <span class="line-n">${i + 1}</span>
          <span class="line-title" data-ref="outcome:${r.id}" data-ph="${esc(t('sheet_unnamed', '(unnamed outcome)'))}">${esc(r.outcome || '')}</span>
          <span class="line-sum"><small>${t('sheet_col_adjusted', 'Adjusted value')}</small> <b class="calc-total" data-calc="outcomes:${r.id}:adjusted_total">–</b></span>
          ${lineTools(r, 'outcomes')}
        </header>
        <div class="blk b-chg"><h4>${t('sheet_blk_change', 'What changed')}</h4>
          <div class="fgrid">${fields(OUT_CHANGE, r, 'outcomes', OUT_CHANGE_SPAN)}${co.map((c) => fldCustom(c, r, 'outcomes')).join('')}</div></div>
        <div class="blk b-val"><h4>${t('sheet_band_valuation', 'Valuation')}</h4>
          <div class="fgrid">${fields(OUT_VALUE, r, 'outcomes', OUT_VALUE_SPAN)}</div></div>
        <div class="blk b-adj"><h4>${t('sheet_band_adjust', 'Adjustment')}</h4>
          <div class="fgrid">${fields(ADJ, r, 'outcomes', ADJ_SPAN)}</div></div>
      </article>`).join('');
    const outcomes = `<section class="sec b-out">
      ${secHead(3, t('sheet_sec_outcome', 'Outcomes'), t('sheet_sec_outcome_desc', ''), 'outcome')}
      ${outs.length ? `<div class="line-list">${outCards}</div>` : `<p class="line-empty">${t('sheet_no_outcomes', 'No outcome lines yet')}</p>`}
      ${addLineBtn('add-outcome', g.id, t('sheet_add_outcome_btn', 'Add an outcome'))}</section>`;

    let body = `${stk}${inputs}${outcomes}`;
    let subs = '';
    if (level === 0) {
      // the stakeholder rows (the rows below "S1." in the Excel) + the button that adds one
      const hintKey = `sheet_stk_empty_${g.group_type || 'other_agency'}`;
      subs = `<section class="sec sub-area">
        ${kids.length ? `<div class="sub-list">${kids.map((c) => groupBlock(c, 1)).join('')}</div>` : `<p class="sub-hint">${t('sheet_stk_empty', 'No stakeholders yet.')} ${t(hintKey, '')}</p>`}
        ${ro ? '' : `<button type="button" class="sub-add" data-act="add-sub" data-gid="${g.id}"><span class="plus">＋</span><span><b>${t('sheet_add_stk_btn', 'Add a stakeholder to')} ${esc(g.code || '')}</b><small>${t('sheet_add_stk_small', '')}</small></span></button>`}
      </section>`;
      // Data an older plan entered directly on the S-heading stays visible and editable (never silently hidden).
      body = direct ? `<div class="direct-block"><p class="direct-note">${t('sheet_direct_note', 'Entered directly on this group (older entry style).')}</p>${body}</div>` : '';
    }
    return `<article class="grp-card lvl-${level}${collapsed ? ' is-collapsed' : ''}" data-gid="${g.id}">${head}<div class="grp-body">${body}${subs}</div></article>`;
  }

  /** fold / unfold one group card without re-rendering it (so typed text and focus are untouched) */
  function setCollapsed(card, collapse) {
    if (!card) return;
    const id = String(card.dataset.gid);
    card.classList.toggle('is-collapsed', collapse);
    card.querySelector(':scope > .grp-head .grp-toggle')?.setAttribute('aria-expanded', String(!collapse));
    if (collapse) ctx.closed.add(id);
    else {
      ctx.closed.delete(id);
      card.querySelectorAll('.sc-long').forEach(autosize); // textareas inside a folded card could not measure themselves
    }
  }

  /** true when an S-heading carries its own stakeholder fields, custom values, input lines or outcome lines */
  function hasDirectData(g) {
    const s = ctx.sheet;
    const filled = ['population_raw', 'unit', 'note', 'activity', 'activity_summary', 'actual_count_raw', 'actual_count_method'].some((k) => String(g[k] ?? '').trim() !== '');
    const custom = g.custom && Object.keys(g.custom).length > 0;
    return filled || custom || s.inputs.some((r) => r.group_id === g.id) || s.outcomes.some((r) => r.group_id === g.id);
  }

  /** one built-in cell */
  function cellHtml(c, row, kind) {
    const base = `data-kind="${kind}" data-id="${row.id}" data-field="${c.k}"`;
    const dis = ctx.readOnly ? 'disabled' : '';
    const v = row[c.k];
    switch (c.type) {
      case 'calc':
        return `<span class="calc-total" data-calc="${kind}:${row.id}:${c.calc}">–</span>`;
      case 'raw':
        return `<input class="sc sc-raw" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(t('sheet_raw_ph', ''))}" ${base} value="${esc(v ?? '')}" ${dis} /><div class="calc" data-calc="${kind}:${row.id}:${c.calc}"></div>`;
      case 'pct': {
        const shown = v === null || v === undefined ? '' : Math.round(Number(v) * 1e6) / 1e4;
        return `<span class="pct-wrap"><input class="sc sc-pct" type="number" step="0.5" min="0" max="100" ${base} value="${shown}" placeholder="–" ${dis} /><i>%</i></span>`;
      }
      case 'select':
        return `<select class="sc" ${base} ${dis}><option value=""></option>${c.options.map((o) => `<option value="${o}" ${v === o ? 'selected' : ''}>${t('sheet_dim_' + o, o)}</option>`).join('')}</select>`;
      case 'long':
        return `<textarea class="sc sc-long" rows="1" ${base} ${dis}>${esc(v ?? '')}</textarea>`;
      default:
        return `<input class="sc" type="text" ${base} value="${esc(v ?? '')}" ${dis} />`;
    }
  }

  /** one user-defined cell; values live in row.custom[key] */
  function customCell(c, row, kind) {
    const base = `data-kind="${kind}" data-id="${row.id}" data-custom="${esc(c.key)}"`;
    const dis = ctx.readOnly ? 'disabled' : '';
    const v = (row.custom && row.custom[c.key]) ?? '';
    if (c.data_type === 'select') {
      return `<select class="sc" ${base} ${dis}><option value=""></option>${c.options.map((o) => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    if (c.data_type === 'date') return `<input class="sc" type="date" ${base} value="${esc(v)}" ${dis} />`;
    if (c.data_type === 'number' || c.data_type === 'percent') {
      return `<input class="sc sc-raw" type="text" inputmode="decimal" autocomplete="off" ${base} value="${esc(v)}" ${dis} />`;
    }
    return `<textarea class="sc sc-long" rows="1" ${base} ${dis}>${esc(v)}</textarea>`;
  }

  // ================================================================== live result ==================================================================

  async function refreshResult() {
    const res = await api.getSheet(pid);
    ctx.sheet.result = res.data.result;
    applyResult();
  }

  function applyResult() {
    const r = ctx.sheet.result;
    if (!r) return;
    const cur = ctx.sheet.project.currency || 'THB';

    const sum = document.getElementById('sheetSummary');
    if (sum) {
      const stat = (label, value, cls = '', sub = '') => `<div class="stat ${cls}"><div class="stat-label">${label}</div><div class="stat-val">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
      sum.innerHTML = `
        ${stat(t('sheet_total_input', 'Total input'), `${fmt(r.totals.input.total)} <small>${esc(cur)}</small>`, '', `Y0 ${fmt(r.totals.input.y0)} · Y1 ${fmt(r.totals.input.y1)}`)}
        ${stat(t('sheet_total_outcome', 'Total outcome'), `${fmt(r.totals.outcome_adjusted.total)} <small>${esc(cur)}</small>`, '', `Y0 ${fmt(r.totals.outcome_adjusted.y0)} · Y1 ${fmt(r.totals.outcome_adjusted.y1)}`)}
        ${stat(t('sheet_sroi', 'SROI'), r.blocked ? '–' : fmtRatio(r.sroi), 'sroi', `${t('sheet_sroi_unadj', '')}: ${r.blocked ? '–' : fmtRatio(r.sroi_unadjusted)}`)}
        ${stat(t('sheet_net', 'Net value'), `${fmt(r.net_value)} <small>${esc(cur)}</small>`)}
        ${ctx.readOnly ? '' : `<button class="btn btn-primary sheet-save" id="btnSaveRun">${t('sheet_save_run', 'Save calculation')}</button>`}`;
      document.getElementById('btnSaveRun')?.addEventListener('click', saveRun);
    }

    // issues panel
    const iss = document.getElementById('sheetIssues');
    if (iss) {
      const errs = r.errors || [];
      const warns = (r.warnings || []).filter((w) => w.code !== 'VALUE_NOT_ENTERED');
      const blank = (r.warnings || []).filter((w) => w.code === 'VALUE_NOT_ENTERED');
      const n = errs.length + warns.length + blank.length;
      iss.className = `sheet-issues ${errs.length ? 'has-errors' : ''}`;
      iss.innerHTML = `<summary>${errs.length ? `⛔ ${t('sheet_errors', 'Fix before calculating')} (${errs.length})` : `ⓘ ${t('sheet_warnings', 'Notes')} (${n})`}</summary>
        <ul>${errs.map((e) => `<li class="err">${esc(e.message)} <code>${esc(e.path)}</code></li>`).join('')}
        ${warns.map((w) => `<li class="${w.severity}">${esc(w.message)}</li>`).join('')}
        ${blank.map((w) => `<li class="info">${esc(w.message)}</li>`).join('')}
        ${n === 0 ? `<li class="info">${t('sheet_no_issues', 'No notes')}</li>` : ''}</ul>`;
    }

    // per-line and per-group numbers
    const maps = {
      inputs: new Map(r.inputs.map((x) => [String(x.id), x])),
      outcomes: new Map(r.outcomes.map((x) => [String(x.id), x])),
      groups: new Map(r.groups.map((x) => [String(x.id), x])),
    };
    document.querySelectorAll('[data-calc]').forEach((el) => {
      const [kind, id, field] = el.dataset.calc.split(':');
      const row = maps[kind]?.get(id);
      const v = row ? row[field] : null;
      if (el.classList.contains('calc-total')) {
        el.textContent = fmt(v);
        el.classList.toggle('muted', v === null || v === 0);
        return;
      }
      const inputEl = el.previousElementSibling;
      const raw = inputEl?.value ?? '';
      el.textContent = v !== null && v !== undefined && raw.trim() !== '' && !isPlainNumber(raw) ? `= ${fmt(v)}` : '';
    });
    document.querySelectorAll('[data-gsum]').forEach((el) => {
      const [id, which] = el.dataset.gsum.split(':');
      const g = maps.groups.get(id);
      el.textContent = g ? fmt(which === 'in' ? g.input.total : g.outcome_adjusted.total) : '–';
    });
    // line-level "not assessed" cue on adjusted totals
    document.querySelectorAll('[data-calc$=":adjusted_total"]').forEach((el) => {
      const id = el.dataset.calc.split(':')[1];
      const o = maps.outcomes.get(id);
      el.title = o && o.adj_y0 === null && o.adj_y1 === null && (o.gross_total || 0) !== 0 ? t('sheet_not_assessed', 'not assessed') : '';
      el.classList.toggle('unassessed', !!el.title);
    });
  }

  // ================================================================== editing ==================================================================

  function findRow(kind, id) {
    const list = { groups: ctx.sheet.groups, inputs: ctx.sheet.inputs, outcomes: ctx.sheet.outcomes }[kind];
    return list.find((r) => String(r.id) === String(id));
  }

  function readValue(el) {
    if (el.type === 'checkbox') return el.checked;
    const v = el.value;
    if (el.classList.contains('sc-pct')) return v === '' ? null : Math.round((Number(v) / 100) * 1e6) / 1e6;
    return typeof v === 'string' ? v.trim() : v;
  }

  function bindTable(table) {
    table.addEventListener('change', (e) => {
      const el = e.target.closest('[data-kind]');
      if (!el || ctx.readOnly) return;
      enqueue(() => saveField(el));
    });
    // grow long cells with their content
    table.addEventListener('input', (e) => {
      if (e.target.classList?.contains('sc-long')) autosize(e.target);
      if (e.target.closest?.('[data-kind]')) showWhere(e.target);
    });
    // pinned breadcrumb: which stakeholder / line / field is being typed in, wherever the page is scrolled to
    table.addEventListener('focusin', (e) => showWhere(e.target));
    table.addEventListener('focusout', (e) => {
      if (!table.contains(e.relatedTarget)) showWhere(null);
    });

    table.addEventListener('click', (e) => {
      const head = e.target.closest('.grp-head');
      if (head && !e.target.closest('input, select, textarea, label, button:not(.grp-toggle)')) {
        const card = head.closest('.grp-card');
        return setCollapsed(card, !card.classList.contains('is-collapsed'));
      }
      const add = e.target.closest('[data-addcol]');
      if (add) return openColumnModal(add.dataset.addcol, null);
      const edit = e.target.closest('[data-editcol]');
      if (edit) return openColumnModal(null, ctx.sheet.columns.find((c) => String(c.id) === edit.dataset.editcol));
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const gid = Number(b.dataset.gid);
      switch (b.dataset.act) {
        case 'toggle': return; // handled above through the header click
        case 'add-input': return addLine('inputs', gid, 'resource');
        case 'add-outcome': return addLine('outcomes', gid, 'outcome');
        case 'add-sub': return addGroup(gid);
        case 'del-line': return deleteLine(b.dataset.kind, b.dataset.id);
        case 'del-group': return deleteGroup(gid);
      }
    });
  }

  /** fill the pinned strip: S2.1 Name  ›  Outcome 3: title  ›  Field label */
  function showWhere(el) {
    const bar = document.getElementById('sheetWhere');
    if (!bar) return;
    const cell = el?.closest?.('[data-kind]');
    if (!cell) { bar.hidden = true; return; }
    const val = (n) => (n ? String(n.value ?? n.textContent ?? '').trim() : '');
    const crumbs = [];
    const card = cell.closest('.grp-card');
    const parent = card?.parentElement?.closest('.grp-card');
    [parent, card].forEach((c) => {
      if (!c) return;
      const code = val(c.querySelector(':scope > .grp-head .grp-code'));
      const name = val(c.querySelector(':scope > .grp-head .grp-name'));
      crumbs.push(`<b>${esc(code)}</b> ${esc(name)}`.trim());
    });
    const line = cell.closest('.line');
    if (line) {
      const n = line.querySelector('.line-n')?.textContent || '';
      if (line.classList.contains('line-out')) {
        const title = val(line.querySelector('[data-field="outcome"]')) || val(line.querySelector('.line-title'));
        crumbs.push(`${esc(t('sheet_group_total_out', 'Outcome'))} ${esc(n)}${title ? ': ' + esc(title) : ''}`);
      } else {
        const title = val(line.querySelector('[data-field="resource"]'));
        crumbs.push(`${esc(t('sheet_group_total_in', 'Input'))} ${esc(n)}${title ? ': ' + esc(title) : ''}`);
      }
    }
    const label = cell.closest('.fld')?.querySelector('.fld-label');
    if (label) crumbs.push(`<em>${esc(label.title || label.textContent.trim())}</em>`);
    bar.innerHTML = crumbs.join('<span class="sep">›</span>');
    bar.hidden = false;
  }

  function autosize(el) {
    if (!el.offsetParent) return; // inside a folded card: it cannot be measured now, setCollapsed() re-measures on unfold
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight + 2, 34), 112) + 'px';
  }

  async function saveField(el) {
    const { kind, id, field, custom } = el.dataset;
    const row = findRow(kind, id);
    if (!row) return;
    let payload;
    if (custom) {
      const next = { ...(row.custom || {}) };
      const v = readValue(el);
      if (v === '' || v === null) delete next[custom];
      else next[custom] = v;
      payload = { custom: next };
    } else {
      let v = readValue(el);
      if (v === '' && ['dimension', 'unit', 'note', 'population_raw', 'actual_count_raw', 'y0_raw', 'y1_raw'].includes(field)) v = null;
      payload = { [field]: v };
    }
    setStatus('saving');
    try {
      const res = await api.updateSheetRow(pid, kind, id, payload);
      Object.assign(row, res.data);
      if (kind === 'outcomes' && field === 'outcome') document.querySelectorAll(`[data-ref="outcome:${id}"]`).forEach((n) => { n.textContent = row.outcome || ''; });
      if (field === 'include_in_total') el.closest('.line')?.classList.toggle('is-excluded', !el.checked);
      el.classList.remove('is-invalid');
      el.removeAttribute('title');
      await refreshResult();
      setStatus('saved');
    } catch (err) {
      el.classList.add('is-invalid');
      const msg = err.details?.[field] || err.details?.[`custom.${custom}`] || err.message;
      el.title = `${t('sheet_invalid', 'Invalid value')}: ${msg}`;
      setStatus('error', msg);
      if (el.type === 'checkbox') el.checked = !el.checked;
    }
  }

  async function addLine(kind, gid, nameField) {
    await guard(async () => {
      const res = await api.createSheetRow(pid, kind, { group_id: gid, [nameField]: t('sheet_new_line', 'New line') });
      await reload();
      const first = document.querySelector(`[data-kind="${kind}"][data-id="${res.data.id}"][data-field="${nameField}"]`);
      first?.focus();
      first?.select?.();
    });
  }

  function addGroup(parentId) {
    const parent = ctx.sheet.groups.find((g) => g.id === parentId);
    if (!parent) return;
    const siblings = ctx.sheet.groups.filter((g) => g.parent_id === parentId);
    const used = siblings.map((g) => Number(String(g.code || '').split('.').pop())).filter((n) => Number.isFinite(n));
    const code = `${parent.code || 'S'}.${(used.length ? Math.max(...used) : 0) + 1}`;
    // The same first four columns as the Excel row: name (ระบุ) · count (จำนวนประชากร) · unit (หน่วย) · activity (กิจกรรม/ทรัพยากร)
    const body = `
      <form id="subForm" class="stack" style="gap: var(--sp-md);">
        <p class="muted" style="margin:0;">${t('sheet_sub_modal_desc', '')} <b>${esc(code)}</b> · ${esc(parent.code || '')} ${esc(parent.name)}</p>
        <div class="field"><label class="field-label">${t('sheet_stk_name', 'Stakeholder name')} *</label>
          <input class="input" name="name" required maxlength="300" placeholder="${esc(t(`sheet_stk_ph_${parent.group_type || 'other_agency'}`, ''))}" autocomplete="off" /></div>
        <div class="form-grid">
          <div class="field"><label class="field-label">${t('sheet_col_population', 'Population')}</label>
            <input class="input" name="population_raw" inputmode="decimal" autocomplete="off" /></div>
          <div class="field"><label class="field-label">${t('sheet_col_unit', 'Unit')}</label>
            <input class="input" name="unit" maxlength="50" autocomplete="off" /></div>
        </div>
        <div class="field"><label class="field-label">${t('sheet_col_activity', 'Activity / resource')}</label>
          <textarea class="input" name="activity" rows="2" maxlength="2000"></textarea></div>
        <p class="muted" style="margin:0; font-size:0.75rem;">${t('sheet_stk_modal_foot', '')}</p>
        <div id="subErr" class="alert alert-danger" style="display:none;"></div>
      </form>`;
    const footer = `<button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="btnCreateSub">${t('sheet_sub_create', 'Add stakeholder')}</button>`;
    openModal({ title: `${t('sheet_sub_modal_title', 'Add a stakeholder')} → ${parent.code || ''}`, body, footer });
    const form = document.getElementById('subForm');
    form.name.focus();
    const submit = async () => {
      const name = form.name.value.trim();
      const err = document.getElementById('subErr');
      if (!name) {
        err.textContent = t('required', 'Please fill in required fields.');
        err.style.display = 'block';
        return;
      }
      // optional cells are only sent when filled, so nothing is stored as an implied 0 or empty string
      const payload = { parent_id: parentId, code, name };
      for (const f of ['population_raw', 'unit', 'activity']) {
        const v = form[f].value.trim();
        if (v !== '') payload[f] = v;
      }
      try {
        const res = await api.createSheetRow(pid, 'groups', payload);
        closeModal();
        await reload();
        document.querySelector(`.grp-card[data-gid="${res.data.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setStatus('ok', `${t('sheet_sub_created', 'Stakeholder added')}: ${code} ${name}`);
      } catch (e) {
        err.textContent = Object.values(e.details || {}).join(' · ') || e.message;
        err.style.display = 'block';
      }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    document.getElementById('btnCreateSub').addEventListener('click', submit);
  }

  function deleteLine(kind, id) {
    confirmModal({
      title: t('sheet_delete_line', 'Delete this line'),
      message: t('sheet_confirm_delete_line', 'Delete this line?'),
      onConfirm: () => guard(async () => { await api.deleteSheetRow(pid, kind, id); await reload(); }),
    });
  }

  function deleteGroup(gid) {
    confirmModal({
      title: t('sheet_delete_group', 'Delete this group'),
      message: t('sheet_confirm_delete_group', 'Delete this group?'),
      onConfirm: () => guard(async () => { await api.deleteSheetRow(pid, 'groups', gid); await reload(); }),
    });
  }

  // ================================================================== custom columns ==================================================================

  function openColumnModal(band, existing) {
    const isEdit = !!existing;
    const b = existing ? existing.band : band;
    const types = [['text', 'sheet_col_type_text'], ['number', 'sheet_col_type_number'], ['percent', 'sheet_col_type_percent'], ['date', 'sheet_col_type_date'], ['select', 'sheet_col_type_select']];
    const canCount = b === 'input' || b === 'outcome';
    const body = `
      <form id="sheetColForm" class="stack" style="gap: var(--sp-md);">
        <div class="field"><label class="field-label">${t('sheet_col_label', 'Topic name')} *</label>
          <input class="input" name="label" required maxlength="100" value="${esc(existing?.label || '')}" /></div>
        <div class="form-grid">
          <div class="field"><label class="field-label">${t('sheet_col_type', 'Data type')}</label>
            <select class="input" name="data_type">${types.map(([v, k]) => `<option value="${v}" ${existing?.data_type === v ? 'selected' : ''}>${t(k, v)}</option>`).join('')}</select></div>
          ${canCount ? `<div class="field" id="countsWrap"><label class="field-label">${t('sheet_col_counts', 'Use in the calculation?')}</label>
            <select class="input" name="counts_toward">
              <option value="none" ${existing?.counts_toward === 'none' || !existing ? 'selected' : ''}>${t('sheet_col_counts_none', '')}</option>
              <option value="${b}" ${existing && existing.counts_toward !== 'none' ? 'selected' : ''}>${t(b === 'input' ? 'sheet_col_counts_input' : 'sheet_col_counts_outcome', '')}</option>
            </select></div>
          <div class="field" id="countInWrap"><label class="field-label">${t('sheet_col_count_in', 'Counts in year')}</label>
            <select class="input" name="count_in"><option value="y0" ${existing?.count_in !== 'y1' ? 'selected' : ''}>Y0</option><option value="y1" ${existing?.count_in === 'y1' ? 'selected' : ''}>Y1</option></select></div>` : ''}
        </div>
        <div class="field" id="optionsWrap" style="display:none;"><label class="field-label">${t('sheet_col_options', 'Choices (one per line)')}</label>
          <textarea class="input" name="options" rows="4">${esc((existing?.options || []).join('\n'))}</textarea></div>
        <p class="muted" style="font-size:0.75rem;">${t('sheet_formula_hint', '')}</p>
        <div id="sheetColError" class="alert alert-danger" style="display:none;"></div>
      </form>`;
    const footer = `
      ${isEdit ? `<button class="btn btn-secondary" id="btnDelCol" style="margin-right:auto; color: var(--negative);">${t('sheet_col_delete', 'Delete this topic')}</button>` : ''}
      <button class="btn btn-secondary" data-modal-close>${t('cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="btnSaveCol">${t('save', 'Save')}</button>`;
    openModal({ title: t('sheet_col_modal_title', 'Custom topic'), body, footer });

    const form = document.getElementById('sheetColForm');
    const sync = () => {
      const type = form.data_type.value;
      document.getElementById('optionsWrap').style.display = type === 'select' ? '' : 'none';
      const numeric = type === 'number' || type === 'percent';
      const cw = document.getElementById('countsWrap');
      const ciw = document.getElementById('countInWrap');
      if (cw) cw.style.display = numeric ? '' : 'none';
      if (ciw) ciw.style.display = numeric && form.counts_toward?.value !== 'none' ? '' : 'none';
    };
    form.data_type.addEventListener('change', sync);
    form.counts_toward?.addEventListener('change', sync);
    sync();

    document.getElementById('btnSaveCol').addEventListener('click', async () => {
      const err = document.getElementById('sheetColError');
      const type = form.data_type.value;
      const numeric = type === 'number' || type === 'percent';
      const data = { label: form.label.value.trim(), data_type: type };
      if (!isEdit) data.band = b;
      if (type === 'select') data.options = form.options.value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (canCount) {
        data.counts_toward = numeric ? form.counts_toward.value : 'none';
        data.count_in = form.count_in.value;
      }
      if (!data.label) {
        err.textContent = t('required', 'Please fill in required fields.');
        err.style.display = 'block';
        return;
      }
      try {
        if (isEdit) await api.updateSheetRow(pid, 'columns', existing.id, data);
        else await api.createSheetRow(pid, 'columns', data);
        closeModal();
        await reload();
      } catch (e) {
        err.textContent = Object.values(e.details || {}).join(' · ') || e.message;
        err.style.display = 'block';
      }
    });
    document.getElementById('btnDelCol')?.addEventListener('click', () => {
      confirmModal({
        title: t('sheet_col_delete', 'Delete this topic'),
        message: t('sheet_col_delete_confirm', ''),
        onConfirm: () => guard(async () => { await api.deleteSheetRow(pid, 'columns', existing.id); await reload(); }),
      });
    });
  }

  // ================================================================== saving a run ==================================================================

  async function saveRun() {
    await guard(async () => {
      const res = await api.calculateSheet(pid);
      setStatus('ok', `${t('sheet_saved_run', 'Calculation saved')} · SROI ${fmtRatio(res.data.result.sroi)}`);
    });
  }

  // ================================================================== plumbing ==================================================================

  async function reload() {
    ctx.sheet = (await api.getSheet(pid)).data;
    if (ctx.sheet.groups.length === 0 || !document.getElementById('sheetTable')) buildPage();
    else renderTable();
  }

  /** run a structural action, report failures in the status line */
  async function guard(fn) {
    setStatus('saving');
    try {
      await fn();
      // an action may have posted its own confirmation (e.g. "Calculation saved"): keep it
      if (document.getElementById('sheetStatus')?.dataset.state !== 'ok') setStatus('saved');
    } catch (err) {
      const detail = Object.values(err.details || {}).filter((x) => typeof x === 'string').join(' · ');
      setStatus('error', detail || err.message);
    }
  }

  function enqueue(fn) {
    ctx.chain = ctx.chain.then(fn, fn);
    return ctx.chain;
  }

  function setStatus(state, msg = '') {
    const el = document.getElementById('sheetStatus');
    if (!el) return;
    clearTimeout(ctx.statusTimer);
    el.dataset.state = state;
    el.textContent = state === 'saving' ? t('sheet_saving', 'Saving…') : state === 'saved' ? `✓ ${t('sheet_saved', 'Saved')}` : msg;
    if (state === 'saved' || state === 'ok') ctx.statusTimer = setTimeout(() => { el.textContent = ''; el.dataset.state = ''; }, state === 'ok' ? 6000 : 1800);
  }

  function captureScroll() {
    const w = document.getElementById('sheetWrap');
    return { l: w?.scrollLeft || 0, t: w?.scrollTop || 0, y: window.scrollY };
  }

  function restoreScroll(s) {
    const w = document.getElementById('sheetWrap');
    if (w) {
      w.scrollLeft = s.l;
      w.scrollTop = s.t;
    }
    window.scrollTo(0, s.y);
  }
}