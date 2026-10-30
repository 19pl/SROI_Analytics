/**
 * Sheet mode — enter and calculate an SROI plan the way the customer's Excel workbooks do.
 *
 * One page; each group is a card whose sections are stacked vertically (no sideways scrolling across the whole sheet):
 *   Stakeholder → Inputs → Outcomes → Valuation → Adjustment
 * Number cells accept formulas (=63999000/20). The backend is authoritative: every save is validated and the totals
 * shown here are the engine's result, never computed in the browser.
 * Users can add their own topics ("custom columns") to any band, and rows (lines / groups) anywhere.
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
  { k: 'note', l: 'sheet_col_note', type: 'long', w: 170 },
  { k: 'activity', l: 'sheet_col_activity', type: 'long', w: 190 },
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
const OUT_DESC = OUT.filter((c) => ['dimension', 'beneficiary', 'outcome', 'quantity_text', 'weight', 'indicator'].includes(c.k));
const OUT_VAL = OUT.filter((c) => ['valuation_method', 'y0_raw', 'y1_raw', 'gross_total', 'source'].includes(c.k));
const ACT_W = 76; // line action column (delete / include)
const CUSTOM_W = 170;

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
  const ctx = { pid, sheet: null, readOnly: true, chain: Promise.resolve(), statusTimer: null };

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
        <div class="sheet-summary" id="sheetSummary"></div>
        <details class="sheet-issues" id="sheetIssues"></details>
        <div class="sheet-groups" id="sheetTable"></div>
        <div class="sheet-foot">
          ${ctx.readOnly ? `<span class="muted">${t('sheet_read_only', '')}</span>` : `<button class="btn btn-secondary" id="btnAddGroup">${t('sheet_add_group', '+ Group')}</button>`}
          <span class="muted" style="font-size: 0.75rem;">${t('sheet_formula_note', '')}</span>
        </div>
      </div>`;
    bindScope();
    bindTable(document.getElementById('sheetTable')); // delegated listeners: bound once, the rows inside are re-rendered freely
    renderTable();
    document.getElementById('btnAddGroup')?.addEventListener('click', () => addGroup(null));
  }

  function scopeHtml(p) {
    const months = [['', t('scope_full_year', 'Full year')], ['6', t('scope_6_months', '6 months')], ['9', t('scope_9_months', '9 months')], ['12', t('scope_12_months', '12 months')]];
    const dis = ctx.readOnly ? 'disabled' : '';
    return `
      <div class="card sheet-scope">
        <div class="card-head" style="margin-bottom: var(--sp-sm);">
          <div>
            <h2 class="card-title">${esc(p.name)} <span class="badge badge-integrated">${t('sheet_badge', 'Sheet')}</span></h2>
            <p class="muted" style="font-size: 0.8125rem;">${t('sheet_subtitle', '')}</p>
          </div>
          <span class="sheet-status" id="sheetStatus" role="status" aria-live="polite"></span>
        </div>
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
      </div>`;
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

  // Layout: one card per group. Inside a card the sections are stacked top to bottom
  // (Stakeholder → Inputs → Outcomes → Valuation → Adjustment); each section is its own small table that fits the screen.

  function renderTable() {
    const root2 = document.getElementById('sheetTable');
    if (!root2) return;
    const keep = captureScroll();
    const s = ctx.sheet;
    const tops = s.groups.filter((g) => g.parent_id === null);
    root2.innerHTML = tops
      .map((g) => groupBlock(g, 0) + s.groups.filter((c) => c.parent_id === g.id).map((c) => groupBlock(c, 1)).join(''))
      .join('');
    root2.querySelectorAll('.sc-long').forEach(autosize);
    restoreScroll(keep);
    applyResult();
  }

  function hintOf(c) {
    const adj = c.k === 'adj_y0' || c.k === 'adj_y1' ? ` <span class="hint" title="${esc(t('sheet_adj_hint', ''))}">ⓘ</span>` : '';
    const fx = c.type === 'raw' ? ` <span class="hint" title="${esc(t('sheet_formula_hint', ''))}">ƒ</span>` : '';
    return adj + fx;
  }
  function th(c) {
    return `<th style="min-width:${c.w}px">${t(c.l, c.k)}${hintOf(c)}</th>`;
  }
  function thCustom(c) {
    const sigma = c.counts_toward !== 'none' ? ` <span class="hint" title="${esc(t('sheet_col_counts', ''))}">Σ</span>` : '';
    const edit = ctx.readOnly ? '' : ` <button class="sheet-editcol" data-editcol="${c.id}" title="${t('sheet_col_modal_title', 'Custom topic')}">✎</button>`;
    return `<th class="custom" style="min-width:${CUSTOM_W}px">${esc(c.label)}${sigma}${edit}</th>`;
  }

  function secHead(cls, title, band, extra = '') {
    const addBtn = band && !ctx.readOnly ? `<button class="sheet-addcol" data-addcol="${band}" title="${t('sheet_add_column', 'Add topic')}">＋ ${t('sheet_add_column', 'Add topic')}</button>` : '';
    return `<div class="sec-head ${cls}"><h3>${title}</h3><span class="sec-tools">${addBtn}${extra}</span></div>`;
  }

  function emptyRow(span, msg) {
    return `<tr><td class="sheet-none" colspan="${span}">${msg}</td></tr>`;
  }

  /** a row label that follows the outcome / input name so the tables below stay readable */
  function refCell(r, n, field) {
    return `<td class="ref"><span class="ref-n">${n}</span><span class="ref-t" data-ref="${field}:${r.id}">${esc(r[field] || '')}</span></td>`;
  }

  function groupBlock(g, level) {
    const s = ctx.sheet;
    const ins = s.inputs.filter((r) => r.group_id === g.id);
    const outs = s.outcomes.filter((r) => r.group_id === g.id);
    const ro = ctx.readOnly;
    const cs = customCols('stakeholder');
    const ci = customCols('input');
    const co = customCols('outcome');
    const btn = (act, label) => (ro ? '' : `<button class="btn btn-secondary sheet-mini" data-act="${act}" data-gid="${g.id}">${label}</button>`);

    const head = `<header class="grp-head">
      <input class="sc grp-code" data-kind="groups" data-id="${g.id}" data-field="code" value="${esc(g.code || '')}" placeholder="S?" ${ro ? 'disabled' : ''} />
      <input class="sc grp-name" data-kind="groups" data-id="${g.id}" data-field="name" value="${esc(g.name)}" ${ro ? 'disabled' : ''} />
      <span class="grp-sum"><span>${t('sheet_group_total_in', 'Input')} <b data-gsum="${g.id}:in">–</b></span><span>${t('sheet_group_total_out', 'Outcome')} <b data-gsum="${g.id}:out">–</b></span></span>
      <span class="grp-actions">
        ${level === 0 ? btn('add-sub', t('sheet_add_subgroup', '+ Sub-group')) : ''}
        ${ro ? '' : `<button class="btn-icon sheet-del" data-act="del-group" data-gid="${g.id}" title="${esc(t('sheet_delete_group', ''))}">×</button>`}
      </span></header>`;

    // ---- 1. stakeholder: a small form, labels above the fields ----
    const field = (c) => `<div class="stk-field${c.type === 'long' ? ' wide' : ''}"><label>${t(c.l, c.k)}${hintOf(c)}</label>${cellHtml(c, g, 'groups')}</div>`;
    const fieldCustom = (c) => `<div class="stk-field wide"><label>${esc(c.label)}${ro ? '' : ` <button class="sheet-editcol" data-editcol="${c.id}" title="${t('sheet_col_modal_title', 'Custom topic')}">✎</button>`}</label>${customCell(c, g, 'groups')}</div>`;
    const stk = `<section class="sec b-stk">
      ${secHead('b-stk', t('sheet_band_stakeholder', 'Stakeholder'), 'stakeholder')}
      <div class="stk-grid">${STK.map(field).join('')}${cs.map(fieldCustom).join('')}</div></section>`;

    // ---- 2. inputs ----
    const inSpan = INP.length + ci.length + 1;
    const inRows = ins.length
      ? ins.map((r) => `<tr>${INP.map((c) => `<td class="cell inp${c.type === 'calc' ? ' num' : ''}">${cellHtml(c, r, 'inputs')}</td>`).join('')}${ci.map((c) => `<td class="cell inp custom">${customCell(c, r, 'inputs')}</td>`).join('')}${actCell(r, 'inputs')}</tr>`).join('')
      : emptyRow(inSpan, t('sheet_no_inputs', 'No input lines yet'));
    const inputs = `<section class="sec b-inp">
      ${secHead('b-inp', t('sheet_band_input', 'Inputs'), 'input', btn('add-input', t('sheet_add_input', '+ Input')))}
      <div class="tbl-wrap"><table class="sheet-table"><thead><tr>${INP.map(th).join('')}${ci.map(thCustom).join('')}<th style="min-width:${ACT_W}px"></th></tr></thead><tbody>${inRows}</tbody></table></div></section>`;

    // ---- 3. outcomes (what changed) ----
    const descSpan = OUT_DESC.length + co.length + 1;
    const descRows = outs.length
      ? outs.map((r) => `<tr>${OUT_DESC.map((c) => `<td class="cell out">${cellHtml(c, r, 'outcomes')}</td>`).join('')}${co.map((c) => `<td class="cell out custom">${customCell(c, r, 'outcomes')}</td>`).join('')}${actCell(r, 'outcomes')}</tr>`).join('')
      : emptyRow(descSpan, t('sheet_no_outcomes', 'No outcome lines yet'));
    const outcomes = `<section class="sec b-out">
      ${secHead('b-out', t('sheet_sec_outcome', 'Outcomes'), 'outcome', btn('add-outcome', t('sheet_add_outcome', '+ Outcome')))}
      <div class="tbl-wrap"><table class="sheet-table"><thead><tr>${OUT_DESC.map(th).join('')}${co.map(thCustom).join('')}<th style="min-width:${ACT_W}px"></th></tr></thead><tbody>${descRows}</tbody></table></div></section>`;

    // ---- 4 + 5. valuation and adjustment: one row per outcome, labelled with the outcome name ----
    let valuation = '';
    let adjust = '';
    if (outs.length) {
      const valRows = outs.map((r, i) => `<tr>${refCell(r, i + 1, 'outcome')}${OUT_VAL.map((c) => `<td class="cell out${c.type === 'calc' ? ' num' : ''}">${cellHtml(c, r, 'outcomes')}</td>`).join('')}</tr>`).join('');
      valuation = `<section class="sec b-val">
        ${secHead('b-out', t('sheet_band_valuation', 'Valuation'), null)}
        <div class="tbl-wrap"><table class="sheet-table"><thead><tr><th style="min-width:220px">${t('sheet_col_outcome', 'Outcome')}</th>${OUT_VAL.map(th).join('')}</tr></thead><tbody>${valRows}</tbody></table></div></section>`;
      const adjRows = outs.map((r, i) => `<tr>${refCell(r, i + 1, 'outcome')}${ADJ.map((c) => `<td class="cell adj${c.type === 'calc' ? ' num' : ''}">${cellHtml(c, r, 'outcomes')}</td>`).join('')}</tr>`).join('');
      adjust = `<section class="sec b-adj">
        ${secHead('b-adj', t('sheet_band_adjust', 'Adjustment'), null)}
        <div class="tbl-wrap"><table class="sheet-table"><thead><tr><th style="min-width:220px">${t('sheet_col_outcome', 'Outcome')}</th>${ADJ.map(th).join('')}</tr></thead><tbody>${adjRows}</tbody></table></div></section>`;
    }

    return `<article class="grp-card lvl-${level}" data-gid="${g.id}">${head}${stk}${inputs}${outcomes}${valuation}${adjust}</article>`;
  }

  function actCell(r, kind) {
    if (ctx.readOnly) return `<td class="cell act"></td>`;
    return `<td class="cell act">
      <label class="sheet-inc" title="${esc(t('sheet_include', ''))}"><input type="checkbox" data-kind="${kind}" data-id="${r.id}" data-field="include_in_total" ${r.include_in_total ? 'checked' : ''} /></label>
      <button class="btn-icon sheet-del" data-act="del-line" data-kind="${kind}" data-id="${r.id}" title="${esc(t('sheet_delete_line', ''))}">×</button>
    </td>`;
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
        return `<input class="sc sc-raw" type="text" inputmode="decimal" autocomplete="off" ${base} value="${esc(v ?? '')}" ${dis} /><div class="calc" data-calc="${kind}:${row.id}:${c.calc}"></div>`;
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
    });

    table.addEventListener('click', (e) => {
      const add = e.target.closest('[data-addcol]');
      if (add) return openColumnModal(add.dataset.addcol, null);
      const edit = e.target.closest('[data-editcol]');
      if (edit) return openColumnModal(null, ctx.sheet.columns.find((c) => String(c.id) === edit.dataset.editcol));
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const gid = Number(b.dataset.gid);
      switch (b.dataset.act) {
        case 'add-input': return addLine('inputs', gid, 'resource');
        case 'add-outcome': return addLine('outcomes', gid, 'outcome');
        case 'add-sub': return addGroup(gid);
        case 'del-line': return deleteLine(b.dataset.kind, b.dataset.id);
        case 'del-group': return deleteGroup(gid);
      }
    });
  }

  function autosize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, 220) + 'px';
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

  async function addGroup(parentId) {
    await guard(async () => {
      const siblings = ctx.sheet.groups.filter((g) => g.parent_id === parentId);
      const parent = parentId ? ctx.sheet.groups.find((g) => g.id === parentId) : null;
      const code = parent ? `${parent.code || 'S'}.${siblings.length + 1}` : `S${siblings.length + 1}`;
      const res = await api.createSheetRow(pid, 'groups', { parent_id: parentId, code, name: t('sheet_new_group', 'New group') });
      await reload();
      const first = document.querySelector(`[data-kind="groups"][data-id="${res.data.id}"][data-field="name"]`);
      first?.focus();
      first?.select?.();
    });
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
