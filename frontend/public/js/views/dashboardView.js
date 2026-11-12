/**
 * University-wide NU SROI Dashboard View
 *
 * Provides a high-level executive overview of Naresuan University's
 * social impact, total investment, overall SROI, faculty rankings,
 * impact breakdown (economic, social, environmental), and trends.
 */

import { api } from '../api.js';
import { loadProject } from '../store.js';
import { formatBaht, formatBahtCompact } from '../utils/format.js';
import { escapeHtml } from '../utils/html.js';
import { icons } from '../components/icons.js';
import { t, getLanguage } from '../i18n.js';

// SVG Arc Math Helper for Donut
function polarToCartesian(cx, cy, r, angleRad) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeDonutArc(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const isFull = endAngle - startAngle >= 2 * Math.PI - 0.001;
  if (isFull) {
    const mid = startAngle + Math.PI;
    return `${describeDonutArc(cx, cy, rInner, rOuter, startAngle, mid)} ${describeDonutArc(cx, cy, rInner, rOuter, mid, endAngle)}`;
  }
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export async function renderDashboard(root) {
  const lang = getLanguage();
  const isTh = lang !== 'en';
  const L = (th, en) => (isTh ? th : en);

  let currentYear = 'all';
  let currentFaculty = 'all';
  let trendMode = 'yearly'; // 'yearly' | 'monthly'

  root.innerHTML = `
    <div class="form-stack stack-lg" id="orgDashRoot">
      <div class="empty-state" style="padding: 40px; text-align: center;">
        <span class="muted-sm">${L('กำลังโหลดข้อมูลแดชบอร์ดภาพรวม...', 'Loading university dashboard...')}</span>
      </div>
    </div>
  `;

  async function loadAndRender() {
    try {
      const res = await api.getOrgDashboard({
        fiscal_year: currentYear,
        faculty_id: currentFaculty,
      });
      const data = res?.data || {};
      renderContent(data);
    } catch (err) {
      root.innerHTML = `
        <div class="panel status--warn">
          <div class="strong">${L('เกิดข้อผิดพลาดในการโหลดแดชบอร์ด', 'Failed to load dashboard')}</div>
          <div class="muted-sm">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  function renderContent(data) {
    const kpis = data.kpis || {
      total_investment: 0,
      total_social_value: 0,
      overall_sroi: 0,
      total_projects: 0,
      completed_projects: 0,
    };
    const breakdown = data.breakdown || {};
    const faculties = data.faculties || [];
    const topProjects = data.top_projects || [];
    const trends = data.trends || { yearly: [], monthly: [] };
    const activities = data.recent_activity || [];
    const filterOptions = data.filter_options || { years: [], faculties: [] };

    // Format Year Option Labels (e.g. 2026 -> ปีงบประมาณ 2569 / FY 2026)
    const formatYearLabel = (y) => {
      const numY = Number(y);
      return isTh ? `ปีงบประมาณ ${numY + 543}` : `FY ${numY}`;
    };

    root.innerHTML = `
      <div class="form-stack stack-lg" id="dashContent">
        <!-- =============================================================== -->
        <!-- A. HEADER & FILTERS                                             -->
        <!-- =============================================================== -->
        <div class="dash-header">
          <div class="dash-title-group">
            <div class="cluster stack-xs" style="margin-bottom: 2px;">
              <span class="status status--neutral">มหาวิทยาลัยนเรศวร (Naresuan University)</span>
              <span class="status status--ok" style="font-size: 0.7rem;">${L('ภาพรวมองค์กร', 'Institutional Overview')}</span>
            </div>
            <h1>${L('แดชบอร์ดภาพรวม SROI', 'SROI Impact Dashboard')}</h1>
            <p class="dash-subtitle">
              ${L(
                'ภาพรวมผลตอบแทนทางสังคมจากการลงทุนและผลการดำเนินงานระดับมหาวิทยาลัย',
                'Overview of organizational social return and impact performance.',
              )}
            </p>
          </div>

          <!-- Dynamic Filters -->
          <div class="dash-filters">
            <!-- Fiscal Year Filter -->
            <div class="dash-filter-item">
              <span class="dash-filter-label">${L('ปีงบประมาณ:', 'Fiscal Year:')}</span>
              <select class="dash-select" id="filterFiscalYear">
                <option value="all" ${currentYear === 'all' ? 'selected' : ''}>${L('ทุกปีงบประมาณ', 'All Fiscal Years')}</option>
                ${filterOptions.years
                  .map(
                    (y) => `
                  <option value="${y}" ${String(currentYear) === String(y) ? 'selected' : ''}>
                    ${formatYearLabel(y)}
                  </option>`,
                  )
                  .join('')}
              </select>
            </div>

            <!-- Faculty Filter -->
            <div class="dash-filter-item">
              <span class="dash-filter-label">${L('ส่วนงาน/คณะ:', 'Faculty:')}</span>
              <select class="dash-select" id="filterFaculty">
                <option value="all" ${currentFaculty === 'all' ? 'selected' : ''}>${L('ทุกคณะและหน่วยงาน', 'All Faculties')}</option>
                ${filterOptions.faculties
                  .map(
                    (f) => `
                  <option value="${f.id}" ${String(currentFaculty) === String(f.id) ? 'selected' : ''}>
                    ${escapeHtml(f.name)}
                  </option>`,
                  )
                  .join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- =============================================================== -->
        <!-- B. KEY PERFORMANCE INDICATORS (4 PRIMARY CARDS)                 -->
        <!-- =============================================================== -->
        <div class="dash-kpi-grid">
          <!-- 1. Total Investment -->
          <div class="dash-kpi-card">
            <div class="dash-kpi-head">
              <span class="dash-kpi-label">${L('เงินลงทุนรวม', 'Total Investment')}</span>
              <div class="dash-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8"/></svg>
              </div>
            </div>
            <div class="dash-kpi-value">${formatBahtCompact(kpis.total_investment)}</div>
            <div class="dash-kpi-foot">
              ${L('งบประมาณลงทุนรวมทุกโครงการ', 'Total capital invested across projects')}
            </div>
          </div>

          <!-- 2. Total Social Value -->
          <div class="dash-kpi-card">
            <div class="dash-kpi-head">
              <span class="dash-kpi-label">${L('มูลค่าผลกระทบทางสังคมรวม', 'Total Social Value')}</span>
              <div class="dash-kpi-icon" style="color: var(--positive);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
            </div>
            <div class="dash-kpi-value dash-kpi-value--positive">${formatBahtCompact(kpis.total_social_value)}</div>
            <div class="dash-kpi-foot">
              ${L('มูลค่าผลตอบแทนทางสังคมคิดลดสุทธิ (PV)', 'Total discounted social value generated')}
            </div>
          </div>

          <!-- 3. Overall SROI -->
          <div class="dash-kpi-card dash-kpi-card--highlight">
            <div class="dash-kpi-head">
              <span class="dash-kpi-label">${L('อัตราส่วน SROI ภาพรวม', 'Overall SROI')}</span>
              <div class="dash-kpi-icon" style="color: var(--primary);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
            </div>
            <div class="dash-kpi-value dash-kpi-value--primary">
              ${kpis.overall_sroi > 0 ? `${kpis.overall_sroi.toFixed(2)} : 1` : '-'}
            </div>
            <div class="dash-kpi-foot">
              ${
                kpis.overall_sroi > 0
                  ? isTh
                    ? `ลงทุนทุก ฿1 สร้างผลตอบแทนทางสังคม ฿${kpis.overall_sroi.toFixed(2)}`
                    : `Every ฿1 invested generates ฿${kpis.overall_sroi.toFixed(2)} in social value`
                  : L('รอการประเมินโครงการ', 'Pending evaluations')
              }
            </div>
          </div>

          <!-- 4. Total Projects -->
          <div class="dash-kpi-card">
            <div class="dash-kpi-head">
              <span class="dash-kpi-label">${L('โครงการทั้งหมด', 'Total Projects')}</span>
              <div class="dash-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
            </div>
            <div class="dash-kpi-value">${kpis.total_projects} <small style="font-size: 0.875rem; font-weight: normal; color: var(--muted);">${L('โครงการ', 'projects')}</small></div>
            <div class="dash-kpi-foot">
              <span class="badge badge-ok">${kpis.completed_projects} ${L('ประเมินสมบูรณ์', 'completed')}</span>
              ${kpis.draft_projects > 0 ? `<span class="badge badge-neutral">${kpis.draft_projects} ${L('แบบร่าง', 'drafts')}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- =============================================================== -->
        <!-- C & D. PERFORMANCE TREND & SOCIAL VALUE BREAKDOWN (2 COLUMNS)   -->
        <!-- =============================================================== -->
        <div class="dash-row-2col">
          <!-- C. SROI PERFORMANCE TREND -->
          <div class="panel">
            <div class="cluster stack-between" style="margin-bottom: var(--sp-sm);">
              <div>
                <h3 class="panel__title" style="margin: 0;">${L('แนวโน้มผลตอบแทนทางสังคม (SROI Trend)', 'SROI Performance Trend')}</h3>
                <span class="muted-sm">${L('การเปรียบเทียบการลงทุนและมูลค่าผลกระทบตามช่วงเวลา', 'Investment vs Social Value over time')}</span>
              </div>
              <!-- Yearly / Monthly View Switcher -->
              <div class="cluster stack-xs">
                <button type="button" class="btn btn-compact ${trendMode === 'yearly' ? 'btn-primary' : 'btn-secondary'}" id="btnTrendYearly">
                  ${L('รายปี', 'Yearly')}
                </button>
                <button type="button" class="btn btn-compact ${trendMode === 'monthly' ? 'btn-primary' : 'btn-secondary'}" id="btnTrendMonthly">
                  ${L('รายเดือน', 'Monthly')}
                </button>
              </div>
            </div>

            <!-- Trend Chart Container -->
            <div id="trendChartBox" style="min-height: 220px;">
              ${renderTrendChart(trends[trendMode] || [], isTh)}
            </div>
          </div>

          <!-- D. SOCIAL VALUE BREAKDOWN (DONUT PILLARS) -->
          <div class="panel">
            <div class="cluster stack-between" style="margin-bottom: var(--sp-sm);">
              <div>
                <h3 class="panel__title" style="margin: 0;">${L('การกระจายตัวของคุณค่าทางสังคม (Value Breakdown)', 'Social Value Breakdown')}</h3>
                <span class="muted-sm">${L('สัดส่วนผลกระทบ 3 เสาหลัก: เศรษฐกิจ สังคม และสิ่งแวดล้อม', 'Distribution across Economic, Social, and Environmental impact')}</span>
              </div>
              <span class="badge badge-primary">3 Pillars</span>
            </div>

            <!-- Donut Chart & Legend -->
            <div class="pillar-donut-box">
              ${renderPillarDonut(breakdown, isTh)}
            </div>
          </div>
        </div>

        <!-- =============================================================== -->
        <!-- E & F. FACULTY PERFORMANCE & TOP PROJECTS                       -->
        <!-- =============================================================== -->
        <div class="dash-row-2col">
          <!-- E. FACULTY PERFORMANCE COMPARISON -->
          <div class="panel">
            <div class="cluster stack-between" style="margin-bottom: var(--sp-sm);">
              <div>
                <h3 class="panel__title" style="margin: 0;">${L('การเปรียบเทียบผลงานระดับคณะ (Faculty Performance)', 'Faculty Comparison')}</h3>
                <span class="muted-sm">${L('ผลตอบแทนทางสังคมและงบลงทุนจำแนกตามคณะ/ส่วนงาน', 'Social value and investment scale across faculties')}</span>
              </div>
              <a href="#/org" class="btn btn-secondary btn-compact">${L('จัดการโครงสร้าง', 'Org Settings')}</a>
            </div>

            <div class="fac-rank-list">
              ${
                faculties.length === 0
                  ? `<div class="empty-state"><span class="muted-sm">${L('ไม่มีข้อมูลคณะสำหรับตัวกรองนี้', 'No faculty data')}</span></div>`
                  : faculties
                      .map((f, idx) => {
                        const maxVal = Math.max(...faculties.map((x) => x.total_social_value), 1);
                        const pctBar = Math.min(
                          100,
                          Math.max(4, (f.total_social_value / maxVal) * 100),
                        );
                        return `
                    <div class="fac-rank-card">
                      <div class="fac-rank-row">
                        <div class="fac-rank-left">
                          <span class="fac-rank-num ${idx === 0 && f.total_social_value > 0 ? 'is-top' : ''}">${idx + 1}</span>
                          <div>
                            <div class="fac-rank-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                            <span class="muted-sm" style="font-size: 0.75rem;">${f.project_count} ${L('โครงการ', 'projects')} · ลงทุน ${formatBahtCompact(f.total_investment)}</span>
                          </div>
                        </div>
                        <div class="fac-rank-right">
                          <div style="text-align: right;">
                            <div class="val--positive strong" style="font-size: 0.875rem; font-family: var(--font-mono, monospace);">${formatBahtCompact(f.total_social_value)}</div>
                            <span class="status status--neutral" style="font-size: 0.6875rem;">SROI ${f.sroi_ratio > 0 ? `${f.sroi_ratio.toFixed(2)}:1` : '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div style="height: 4px; background: var(--surface-soft); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pctBar}%; height: 100%; background: var(--primary); border-radius: 2px;"></div>
                      </div>
                    </div>
                  `;
                      })
                      .join('')
              }
            </div>
          </div>

          <!-- F. TOP PERFORMING PROJECTS -->
          <div class="panel">
            <div class="cluster stack-between" style="margin-bottom: var(--sp-sm);">
              <div>
                <h3 class="panel__title" style="margin: 0;">${L('โครงการสร้างคุณค่าสูงสุด (Top 5 Projects)', 'Top Performing Projects')}</h3>
                <span class="muted-sm">${L('โครงการที่มีผลตอบแทนทางสังคมคิดลดสูงสุด 5 อันดับแรก', 'Ranked by adjusted social value')}</span>
              </div>
              <a href="#/projects" class="btn btn-secondary btn-compact">${L('ดูทั้งหมด', 'View All')}</a>
            </div>

            <div class="table-wrap">
              <table class="top-proj-table">
                <thead>
                  <tr>
                    <th>${L('โครงการและหน่วยงาน', 'Project & Owner')}</th>
                    <th class="num">${L('เงินลงทุน', 'Investment')}</th>
                    <th class="num">${L('คุณค่าทางสังคม', 'Social Value')}</th>
                    <th class="num">${L('SROI', 'SROI')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    topProjects.length === 0
                      ? `<tr><td colspan="4" class="empty-state">${L('ยังไม่มีโครงการที่ประเมินเสร็จสมบูรณ์', 'No completed projects yet')}</td></tr>`
                      : topProjects
                          .map(
                            (p) => `
                      <tr class="top-proj-row" data-open-project="${p.id}" title="${L('คลิกเพื่อเปิดโครงการ', 'Click to open project')}">
                        <td>
                          <div class="strong" style="color: var(--primary);">${escapeHtml(p.name)}</div>
                          <span class="muted-sm">${escapeHtml(p.owner_name || p.faculty_name || '-')}</span>
                        </td>
                        <td class="num">${formatBahtCompact(p.total_investment)}</td>
                        <td class="num val--positive strong">${formatBahtCompact(p.total_social_value)}</td>
                        <td class="num strong">
                          <span class="status status--ok" style="font-size: 0.75rem;">${p.sroi_ratio.toFixed(2)}:1</span>
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
        </div>

        <!-- =============================================================== -->
        <!-- G. RECENT ACTIVITY LIST                                         -->
        <!-- =============================================================== -->
        <div class="panel">
          <div class="cluster stack-between" style="margin-bottom: var(--sp-sm);">
            <div>
              <h3 class="panel__title" style="margin: 0;">${L('กิจกรรมและการประเมินล่าสุด (Recent Activity)', 'Recent Activity')}</h3>
              <span class="muted-sm">${L('บันทึกการคำนวณและปรับปรุงข้อมูลโครงการล่าสุด', 'Latest SROI calculations and evaluations')}</span>
            </div>
            <span class="status status--neutral">${activities.length} ${L('รายการล่าสุด', 'recent events')}</span>
          </div>

          <div class="activity-list">
            ${
              activities.length === 0
                ? `<div class="empty-state"><span class="muted-sm">${L('ยังไม่มีประวัติกิจกรรมล่าสุด', 'No recent activity')}</span></div>`
                : activities
                    .map(
                      (a) => `
                <div class="activity-item">
                  <div class="activity-meta">
                    <div class="activity-title">
                      <span class="strong" style="color: var(--on-background);">${escapeHtml(a.title)}:</span>
                      <a href="#/wizard/step-1" class="underline" data-open-project="${a.project_id}">${escapeHtml(a.project_name)}</a>
                    </div>
                    <span class="activity-sub">${new Date(a.created_at).toLocaleDateString(isTh ? 'th-TH' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span class="badge badge-primary" style="font-family: var(--font-mono, monospace); font-weight: 700;">
                    SROI ${a.sroi_ratio.toFixed(2)}:1
                  </span>
                </div>
              `,
                    )
                    .join('')
            }
          </div>
        </div>
      </div>
    `;

    // Bind Filter Events
    const selYear = document.getElementById('filterFiscalYear');
    selYear?.addEventListener('change', (e) => {
      currentYear = e.target.value;
      loadAndRender();
    });

    const selFac = document.getElementById('filterFaculty');
    selFac?.addEventListener('change', (e) => {
      currentFaculty = e.target.value;
      loadAndRender();
    });

    // Trend Switcher Buttons
    document.getElementById('btnTrendYearly')?.addEventListener('click', () => {
      trendMode = 'yearly';
      const box = document.getElementById('trendChartBox');
      if (box) box.innerHTML = renderTrendChart(trends.yearly || [], isTh);
      document.getElementById('btnTrendYearly')?.classList.add('btn-primary');
      document.getElementById('btnTrendYearly')?.classList.remove('btn-secondary');
      document.getElementById('btnTrendMonthly')?.classList.add('btn-secondary');
      document.getElementById('btnTrendMonthly')?.classList.remove('btn-primary');
    });

    document.getElementById('btnTrendMonthly')?.addEventListener('click', () => {
      trendMode = 'monthly';
      const box = document.getElementById('trendChartBox');
      if (box) box.innerHTML = renderTrendChart(trends.monthly || [], isTh);
      document.getElementById('btnTrendMonthly')?.classList.add('btn-primary');
      document.getElementById('btnTrendMonthly')?.classList.remove('btn-secondary');
      document.getElementById('btnTrendYearly')?.classList.add('btn-secondary');
      document.getElementById('btnTrendYearly')?.classList.remove('btn-primary');
    });

    // Project Clickable Handlers
    root.querySelectorAll('[data-open-project]').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        const pId = Number(el.dataset.openProject);
        if (pId) {
          await loadProject(pId);
          window.location.hash = '#/wizard/step-1';
        }
      });
    });
  }

  await loadAndRender();
}

/**
 * Pillar Donut Chart Renderer (Economic, Social, Environmental)
 */
function renderPillarDonut(breakdown, isTh) {
  const pillars = [
    { key: 'economic', ...breakdown.economic },
    { key: 'social', ...breakdown.social },
    { key: 'environmental', ...breakdown.environmental },
  ];

  const total = breakdown.total || 0;
  if (total === 0) {
    return `<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;"><span class="muted-sm">${isTh ? 'ไม่มีข้อมูลผลกระทบสำหรับแสดงผล' : 'No breakdown data'}</span></div>`;
  }

  const cx = 85;
  const cy = 85;
  const rOuter = 72;
  const rInner = 46;

  let currentAngle = -Math.PI / 2;
  const slices = pillars.map((p) => {
    const share = total > 0 ? p.value / total : 0;
    const angle = share * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const pathD = describeDonutArc(cx, cy, rInner, rOuter, startAngle, endAngle);
    return { ...p, pathD };
  });

  const legendHtml = slices
    .map(
      (s) => `
    <div class="pillar-item" style="border-left-color: ${s.color};">
      <div class="pillar-item-head">
        <span class="pillar-item-title">${escapeHtml(s.label)}</span>
        <span class="pillar-item-pct" style="color: ${s.color};">${s.percentage}%</span>
      </div>
      <div class="pillar-item-amount">
        <span>${isTh ? 'มูลค่าคิดลดสุทธิ' : 'Discounted PV'}</span>
        <strong style="color: var(--on-background);">${formatBahtCompact(s.value)}</strong>
      </div>
      <div style="height: 3px; background: var(--outline); border-radius: 2px; overflow: hidden; margin-top: 2px;">
        <div style="width: ${s.percentage}%; height: 100%; background: ${s.color};"></div>
      </div>
    </div>
  `,
    )
    .join('');

  return `
    <div style="display: flex; justify-content: center; align-items: center;">
      <svg width="170" height="170" viewBox="0 0 170 170" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));">
        <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="var(--outline)" stroke-width="${rOuter - rInner}" />
        ${slices
          .map(
            (s) => `
          <path d="${s.pathD}" fill="${s.color}" stroke="var(--surface)" stroke-width="2" class="donut-segment">
            <title>${escapeHtml(s.label)}: ${s.percentage}% (฿${formatBaht(s.value)})</title>
          </path>
        `,
          )
          .join('')}
        <circle cx="${cx}" cy="${cy}" r="${rInner - 2}" fill="var(--surface)" />
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="9" font-weight="500" fill="var(--muted)">Social PV</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--on-background)">${formatBahtCompact(total)}</text>
      </svg>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
      ${legendHtml}
    </div>
  `;
}

/**
 * Performance Trend Line / Bar Chart Renderer
 */
function renderTrendChart(trendData = [], isTh) {
  if (!trendData || trendData.length === 0) {
    return `<div class="empty-state" style="padding: 30px;"><span class="muted-sm">${isTh ? 'ไม่มีข้อมูลแนวโน้มตามช่วงเวลาที่เลือก' : 'No trend data for selected range'}</span></div>`;
  }

  const maxVal = Math.max(
    ...trendData.map((d) => Math.max(d.investment || 0, d.social_value || 0)),
    1,
  );

  return `
    <div style="display: flex; flex-direction: column; gap: var(--sp-md); padding-top: var(--sp-sm);">
      <div style="display: flex; justify-content: flex-end; gap: var(--sp-lg); font-size: 0.75rem;">
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 10px; height: 10px; background: var(--warning); border-radius: 2px;"></span>
          ${isTh ? 'เงินลงทุน (Investment)' : 'Investment'}
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 10px; height: 10px; background: var(--primary); border-radius: 2px;"></span>
          ${isTh ? 'ผลตอบแทนทางสังคม (Social Value)' : 'Social Value'}
        </span>
      </div>

      <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 140px; border-bottom: 1px solid var(--outline); padding-top: 10px; gap: 12px;">
        ${trendData
          .map((d) => {
            const invH = Math.max(3, ((d.investment || 0) / maxVal) * 110);
            const pvH = Math.max(3, ((d.social_value || 0) / maxVal) * 110);

            return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px;">
              <div style="display: flex; align-items: flex-end; gap: 4px; justify-content: center; width: 100%;">
                <div style="width: 16px; height: ${invH}px; background: var(--warning); border-radius: 3px 3px 0 0;"
                  title="${d.period} - ลงทุน: ฿${formatBaht(d.investment || 0)}"></div>
                <div style="width: 16px; height: ${pvH}px; background: var(--primary); border-radius: 3px 3px 0 0;"
                  title="${d.period} - สังคม: ฿${formatBaht(d.social_value || 0)} (SROI ${d.sroi_ratio}:1)"></div>
              </div>
              <span style="font-size: 0.6875rem; color: var(--muted); margin-top: 4px; white-space: nowrap;">
                ${d.period}
              </span>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}
