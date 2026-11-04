import { getState, loadReports, loadRuns } from '../store.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils/html.js';
import { formatBaht } from '../utils/format.js';
import { icons } from '../components/icons.js';
import { t, getLanguage } from '../i18n.js';
import { isGuest, renderGuestPage } from '../components/guestNotice.js';
import { showToast } from '../components/toast.js';

const PAGE_SIZE = 10;

export async function renderReports(root) {
  if (isGuest()) {
    renderGuestPage(root, 'reports');
    return;
  }
  const { project } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">
          ${t('alert_select_project_first', 'Please select a project from the Projects Workspace to view its reports.')}
        </p>
        <a href="#/projects" class="btn btn-primary btn-compact">
          ${t('nav_projects', 'Projects Workspace')}
        </a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="form-stack stack-xl">
      <!-- Header -->
      <div class="page-head">
        <div>
          <h1 class="page-head__title">
            ${isTh ? 'รายงานและประวัติการคำนวณ' : 'Reports & Calculation History'}
          </h1>
          <p class="page-head__sub">
            ${escapeHtml(project.name)} · ${
              isTh
                ? 'ประวัติการคำนวณ สำเนาแบบจำลอง และบันทึกการส่งออกรายงานทางการ'
                : 'Calculation history, model snapshots, and formal export records'
            }
          </p>
        </div>
        <div class="page-head__actions">
          <a class="btn btn-primary" href="#/wizard/step-6">
            ${isTh ? 'เปิดแดชบอร์ดการคำนวณ' : 'Open Calculator Dashboard'}
          </a>
        </div>
      </div>

      <!-- Published Reports Section -->
      <div class="panel">
        <div class="toolbar">
          <div>
            <h2 class="panel__title">
              ${isTh ? 'เอกสารรายงานผลกระทบที่เผยแพร่' : 'Published Impact Reports'}
            </h2>
            <p class="muted-sm">
              ${isTh ? 'รายงานฉบับสมบูรณ์และบทสรุปผู้บริหารที่ถูกสร้างไว้' : 'Formal reports generated for committees and funders'}
            </p>
          </div>
          <div class="cluster">
            <select class="input input--fixed" id="repFacultyFilter">
              <option value="">${isTh ? 'ทุกคณะ / หน่วยงาน' : 'All Faculties'}</option>
            </select>
            <input
              type="text"
              class="input input--fixed"
              id="repSearchInput"
              placeholder="${isTh ? 'ค้นหารายงาน...' : 'Search reports...'}"
              
            />
          </div>
        </div>

        <div id="reportsListTable">
          <div class="empty-state">
            <p class="empty-state__text">${t('loading', 'Loading reports...')}</p>
          </div>
        </div>

        <div class="toolbar stack-top-sm" id="reportsPagination" hidden>
          <span class="muted-sm" id="repPageInfo"></span>
          <div class="cluster">
            <button class="btn btn-secondary btn-compact" id="btnRepPrev">${isTh ? 'ก่อนหน้า' : 'Previous'}</button>
            <button class="btn btn-secondary btn-compact" id="btnRepNext">${isTh ? 'ถัดไป' : 'Next'}</button>
          </div>
        </div>
      </div>

      <!-- Calculation History Section -->
      <div class="panel">
        <div class="toolbar">
          <div>
            <h2 class="panel__title">
              ${isTh ? 'ประวัติการคำนวณ (Calculation History)' : 'Calculation History'}
            </h2>
            <p class="muted-sm">
              ${isTh ? 'บันทึกประวัติการคำนวณทุกรอบเพื่อความโปร่งใสและตรวจสอบย้อนกลับได้' : 'Traceable history of all execution runs and scenario states'}
            </p>
          </div>
          <div class="cluster">
            <select class="input input--fixed" id="runsFacultyFilter" >
              <option value="">${isTh ? 'ทุกคณะ / หน่วยงาน' : 'All Faculties'}</option>
            </select>
            <input
              type="text"
              class="input input--fixed"
              id="runsSearchInput"
              placeholder="${isTh ? 'ค้นหาประวัติการคำนวณ...' : 'Search calculation history...'}"
              
            />
          </div>
        </div>

        <div id="runsListTable">
          <div class="empty-state">
            <p class="empty-state__text">${t('loading', 'Loading calculation history...')}</p>
          </div>
        </div>

        <div class="toolbar stack-top-sm" id="runsPagination" hidden>
          <span class="muted-sm" id="runsPageInfo"></span>
          <div class="cluster">
            <button class="btn btn-secondary btn-compact" id="btnRunsPrev">${isTh ? 'ก่อนหน้า' : 'Previous'}</button>
            <button class="btn btn-secondary btn-compact" id="btnRunsNext">${isTh ? 'ถัดไป' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Fetch faculties to populate dropdowns
  let facultyList = [];
  try {
    const facRes = await api.getFaculties(project.organization_id || 1).catch(() => ({ data: [] }));
    facultyList = facRes?.data || [];
    const repFacSel = document.getElementById('repFacultyFilter');
    const runsFacSel = document.getElementById('runsFacultyFilter');
    facultyList.forEach((f) => {
      const opt1 = document.createElement('option');
      opt1.value = String(f.id);
      opt1.textContent = f.name;
      repFacSel?.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = String(f.id);
      opt2.textContent = f.name;
      runsFacSel?.appendChild(opt2);
    });
  } catch (e) {
    // ignore
  }

  // --- Reports logic ---
  let rawReports = [];
  let repPage = 1;

  function renderReportsTable() {
    const box = document.getElementById('reportsListTable');
    const pag = document.getElementById('reportsPagination');
    const info = document.getElementById('repPageInfo');
    const prevBtn = document.getElementById('btnRepPrev');
    const nextBtn = document.getElementById('btnRepNext');
    if (!box) return;

    const q = (document.getElementById('repSearchInput')?.value || '').toLowerCase().trim();
    const facId = document.getElementById('repFacultyFilter')?.value;

    const filtered = rawReports.filter((r) => {
      const matchQ =
        !q ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q));
      const matchFac = !facId || String(project.faculty_id) === String(facId);
      return matchQ && matchFac;
    });

    if (filtered.length === 0) {
      box.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">${isTh ? 'ไม่พบเอกสารรายงาน' : 'No reports found'}</p>
          <p class="empty-state__text">${isTh ? 'ไปที่ขั้นตอนที่ 6 (Dashboard) เพื่อสร้างรายงานฉบับแรก' : 'Generate reports in Step 6 Dashboard.'}</p>
        </div>
      `;
      if (pag) pag.hidden = true;
      return;
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (repPage > totalPages) repPage = totalPages;
    if (repPage < 1) repPage = 1;

    const startIdx = (repPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if (pag) pag.hidden = false;
    if (info) {
      info.textContent = isTh
        ? `แสดง ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} จากทั้งหมด ${filtered.length} รายการ (หน้า ${repPage}/${totalPages})`
        : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} of ${filtered.length} (Page ${repPage} of ${totalPages})`;
    }
    if (prevBtn) prevBtn.disabled = repPage <= 1;
    if (nextBtn) nextBtn.disabled = repPage >= totalPages;

    box.innerHTML = `
      <div class="table-container">
        <table class="table table--compact">
          <thead>
            <tr>
              <th>${t('col_report_title', 'Report Title')}</th>
              <th>${t('col_eval_type', 'Type')}</th>
              <th>${t('col_created', 'Created')}</th>
              <th>${t('col_export_formats', 'Export Formats')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems
              .map(
                (r) => `
              <tr>
                <td class="strong">${escapeHtml(r.title)}</td>
                <td><span class="status status--neutral">${escapeHtml(r.type)}</span></td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div class="cluster stack-xs">
                    <button class="btn btn-secondary btn-compact" data-dl-report="${r.id}" data-fmt="html">HTML</button>
                    <button class="btn btn-secondary btn-compact" data-dl-report="${r.id}" data-fmt="pdf">PDF</button>
                    <button class="btn btn-secondary btn-compact" data-dl-report="${r.id}" data-fmt="csv">CSV</button>
                  </div>
                </td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    box.querySelectorAll('[data-dl-report]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rId = Number(btn.dataset.dlReport);
        const fmt = btn.dataset.fmt;
        try {
          const blob = await api.exportReport(rId, fmt);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Report_${rId}.${fmt === 'html' ? 'html' : fmt}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          showToast(isTh ? 'ดาวน์โหลดสำเร็จ' : 'Download complete', 'success');
        } catch (err) {
          showToast(`Download failed: ${err.message}`, 'error');
        }
      });
    });
  }

  document.getElementById('repSearchInput')?.addEventListener('input', () => {
    repPage = 1;
    renderReportsTable();
  });
  document.getElementById('repFacultyFilter')?.addEventListener('change', () => {
    repPage = 1;
    renderReportsTable();
  });
  document.getElementById('btnRepPrev')?.addEventListener('click', () => {
    if (repPage > 1) {
      repPage--;
      renderReportsTable();
    }
  });
  document.getElementById('btnRepNext')?.addEventListener('click', () => {
    repPage++;
    renderReportsTable();
  });

  loadReports().then((res) => {
    rawReports = res || [];
    renderReportsTable();
  });

  // --- Calculation Runs logic ---
  let rawRuns = [];
  let runsPage = 1;

  function renderRunsTable() {
    const box = document.getElementById('runsListTable');
    const pag = document.getElementById('runsPagination');
    const info = document.getElementById('runsPageInfo');
    const prevBtn = document.getElementById('btnRunsPrev');
    const nextBtn = document.getElementById('btnRunsNext');
    if (!box) return;

    const q = (document.getElementById('runsSearchInput')?.value || '').toLowerCase().trim();
    const facId = document.getElementById('runsFacultyFilter')?.value;

    const filtered = rawRuns.filter((r) => {
      const matchQ =
        !q ||
        String(r.id).includes(q) ||
        (r.scenario_name && r.scenario_name.toLowerCase().includes(q)) ||
        (r.input_hash && r.input_hash.toLowerCase().includes(q));
      const matchFac = !facId || String(project.faculty_id) === String(facId);
      return matchQ && matchFac;
    });

    if (filtered.length === 0) {
      box.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">${isTh ? 'ไม่พบประวัติการคำนวณ' : 'No calculation history found'}</p>
          <p class="empty-state__text">${isTh ? 'กดปุ่มบันทึกผลคำนวณในหน้าแดชบอร์ดเพื่อสร้างประวัติรอบแรก' : 'Save calculation runs from the Step 6 Dashboard.'}</p>
        </div>
      `;
      if (pag) pag.hidden = true;
      return;
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (runsPage > totalPages) runsPage = totalPages;
    if (runsPage < 1) runsPage = 1;

    const startIdx = (runsPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if (pag) pag.hidden = false;
    if (info) {
      info.textContent = isTh
        ? `แสดง ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} จากทั้งหมด ${filtered.length} รายการ (หน้า ${runsPage}/${totalPages})`
        : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} of ${filtered.length} (Page ${runsPage} of ${totalPages})`;
    }
    if (prevBtn) prevBtn.disabled = runsPage <= 1;
    if (nextBtn) nextBtn.disabled = runsPage >= totalPages;

    box.innerHTML = `
      <div class="table-container">
        <table class="table table--compact">
          <thead>
            <tr>
              <th>${t('col_run_id', 'Run ID')}</th>
              <th>${t('col_scenario', 'Scenario')}</th>
              <th class="num">${t('col_sroi_ratio', 'SROI Ratio')}</th>
              <th class="num">${t('col_present_value', 'Present Value')}</th>
              <th class="num">${t('col_investment', 'Investment')}</th>
              <th>${t('col_hash', 'SHA-256 Hash')}</th>
              <th>${t('col_date', 'Date')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems
              .map(
                (run) => `
              <tr>
                <td class="strong">#${run.id}</td>
                <td><span class="status status--neutral">${escapeHtml(run.scenario_name || 'Base')}</span></td>
                <td class="num strong primary-text">
                  ${run.sroi_ratio !== null ? `${run.sroi_ratio.toFixed(2)} : 1` : '-'}
                </td>
                <td class="num">${project.currency} ${formatBaht(run.present_value)}</td>
                <td class="num">${project.currency} ${formatBaht(run.investment)}</td>
                <td class="muted-sm" title="${escapeHtml(run.input_hash)}">
                  <code>${run.input_hash ? run.input_hash.substring(0, 10) + '...' : '-'}</code>
                </td>
                <td>${new Date(run.created_at).toLocaleDateString()}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('runsSearchInput')?.addEventListener('input', () => {
    runsPage = 1;
    renderRunsTable();
  });
  document.getElementById('runsFacultyFilter')?.addEventListener('change', () => {
    runsPage = 1;
    renderRunsTable();
  });
  document.getElementById('btnRunsPrev')?.addEventListener('click', () => {
    if (runsPage > 1) {
      runsPage--;
      renderRunsTable();
    }
  });
  document.getElementById('btnRunsNext')?.addEventListener('click', () => {
    runsPage++;
    renderRunsTable();
  });

  loadRuns().then((res) => {
    rawRuns = res || [];
    renderRunsTable();
  });
}
