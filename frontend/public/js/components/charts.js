/**
 * SVG Visual Analytics Components
 * Renders Stakeholder Doughnut, Outcome Performance, and Annual Break-Even Trends
 */

import { formatBaht, formatBahtCompact } from '../utils/format.js';
import { escapeHtml } from '../utils/html.js';

export const PALETTE = [
  '#2563EB', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

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

/**
 * 1. Stakeholder Value Breakdown (Interactive SVG Donut Chart)
 */
export function renderStakeholderChart(stakeholders = []) {
  if (!stakeholders || stakeholders.length === 0) {
    return `
      <div class="empty-state" style="padding: var(--sp-lg); text-align: center;">
        <span class="muted-sm">ยังไม่มีข้อมูลผู้มีส่วนได้เสียสำหรับแสดงผล</span>
      </div>`;
  }

  // Normalize positive values across possible schema variants
  const positiveShares = stakeholders
    .map((s) => {
      const val = Number(
        s.positive_present_value ?? s.net_present_value ?? s.present_value ?? s.value ?? 0,
      );
      return {
        name: s.name || s.stakeholder_name || 'ผู้มีส่วนได้เสีย',
        value: Math.max(0, val),
        original: s,
      };
    })
    .filter((s) => s.value > 0);

  const totalPositive = positiveShares.reduce((sum, s) => sum + s.value, 0);

  if (totalPositive === 0) {
    return `
      <div class="empty-state" style="padding: var(--sp-lg); text-align: center;">
        <span class="muted-sm">มูลค่าผลตอบแทนทางสังคมรวมยังเป็น 0 บาท</span>
      </div>`;
  }

  const cx = 90;
  const cy = 90;
  const rOuter = 78;
  const rInner = 50;

  let currentAngle = -Math.PI / 2;
  const slices = positiveShares.map((s, idx) => {
    const share = s.value / totalPositive;
    const angle = share * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const pathD = describeDonutArc(cx, cy, rInner, rOuter, startAngle, endAngle);
    const color = PALETTE[idx % PALETTE.length];
    const sharePct = (share * 100).toFixed(1);

    return {
      name: s.name,
      value: s.value,
      sharePct,
      color,
      pathD,
    };
  });

  const legendHtml = slices
    .map(
      (s) => `
    <div class="stk-legend-item" style="display: flex; flex-direction: column; gap: 4px; padding: 6px 10px; background: var(--surface-soft); border-radius: var(--radius-sm); border-left: 3px solid ${s.color};">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span class="strong" style="font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(s.name)}">
          ${escapeHtml(s.name)}
        </span>
        <span class="status status--neutral" style="font-size: 0.7rem; font-weight: 700; flex-shrink: 0;">${s.sharePct}%</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--muted);">
        <span>มูลค่าผลประโยชน์ (PV)</span>
        <span class="strong" style="color: var(--on-background); font-family: var(--font-mono, monospace);">${formatBahtCompact(s.value)}</span>
      </div>
      <div style="height: 3px; background: var(--outline); border-radius: 2px; overflow: hidden; margin-top: 2px;">
        <div style="width: ${s.sharePct}%; height: 100%; background: ${s.color};"></div>
      </div>
    </div>
  `,
    )
    .join('');

  return `
    <div class="donut-chart-container" style="display: grid; grid-template-columns: minmax(180px, 200px) 1fr; gap: var(--sp-lg); align-items: center; width: 100%;">
      <div style="position: relative; display: flex; justify-content: center; align-items: center;">
        <svg width="180" height="180" viewBox="0 0 180 180" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));">
          <!-- Background track -->
          <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="var(--outline)" stroke-width="${rOuter - rInner}" />
          <!-- Slices -->
          ${slices
            .map(
              (s) => `
            <path d="${s.pathD}" fill="${s.color}" stroke="var(--surface)" stroke-width="2" class="donut-segment" style="transition: opacity 150ms ease; cursor: pointer;">
              <title>${escapeHtml(s.name)}: ${s.sharePct}% (${formatBaht(s.value)} บาท)</title>
            </path>
          `,
            )
            .join('')}
          <!-- Center cutout labels -->
          <circle cx="${cx}" cy="${cy}" r="${rInner - 2}" fill="var(--surface)" />
          <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="10" font-weight="500" fill="var(--muted)">ผลกระทบรวม (PV)</text>
          <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--on-background)">${formatBahtCompact(totalPositive)}</text>
        </svg>
      </div>
      <div class="stk-legend-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px;">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * 2. Outcomes Impact Leaderboard
 */
export function renderOutcomeBarChart(outcomeLines = []) {
  if (!outcomeLines || outcomeLines.length === 0) {
    return `<div class="empty-state" style="padding: var(--sp-md); text-align: center;"><span class="muted-sm">ไม่มีข้อมูลผลลัพธ์</span></div>`;
  }

  const monetized = outcomeLines.filter(
    (l) => l.included && (l.present_value ?? l.totals?.present_value) !== undefined,
  );

  if (monetized.length === 0) {
    return `<div class="empty-state" style="padding: var(--sp-md); text-align: center;"><span class="muted-sm">ไม่มีผลลัพธ์ที่รวมในการคำนวณ</span></div>`;
  }

  const sorted = [...monetized].sort((a, b) => {
    const valA = a.present_value ?? a.totals?.present_value ?? 0;
    const valB = b.present_value ?? b.totals?.present_value ?? 0;
    return valB - valA;
  });

  const maxVal = Math.max(
    ...sorted.map((l) => Math.abs(l.present_value ?? l.totals?.present_value ?? 0)),
    1,
  );
  const totalVal = sorted.reduce(
    (sum, l) => sum + Math.max(0, l.present_value ?? l.totals?.present_value ?? 0),
    0,
  );

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${sorted
        .slice(0, 6)
        .map((l, idx) => {
          const pv = l.present_value ?? l.totals?.present_value ?? 0;
          const isNeg = pv < 0;
          const widthPct = Math.min(100, Math.max(4, (Math.abs(pv) / maxVal) * 100));
          const sharePct = totalVal > 0 ? ((pv / totalVal) * 100).toFixed(1) : 0;
          const netRetentionPct = Math.round((l.adjustment_factor ?? 1) * 100);

          return `
          <div class="impact-card" style="padding: 8px 12px; background: var(--surface); border: 1px solid var(--outline); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <span class="badge ${idx === 0 ? 'badge-primary' : 'badge-neutral'}" style="width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.6875rem; font-weight: 700;">#${idx + 1}</span>
                <span class="strong" style="font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(l.outcome_name || l.name)}">
                  ${escapeHtml(l.outcome_name || l.name)}
                </span>
                ${l.stakeholder_name ? `<span class="status status--neutral" style="font-size: 0.6875rem; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(l.stakeholder_name)}</span>` : ''}
              </div>
              <div style="display: flex; align-items: baseline; gap: 6px; flex-shrink: 0;">
                <span class="strong ${isNeg ? 'val--negative' : 'val--positive'}" style="font-size: 0.875rem; font-family: var(--font-mono, monospace);">
                  ${isNeg ? '-' : ''}${formatBahtCompact(Math.abs(pv))}
                </span>
                <span class="muted-sm" style="font-size: 0.6875rem;">(${sharePct}%)</span>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="flex: 1; height: 6px; background: var(--surface-soft); border-radius: 3px; overflow: hidden; border: 1px solid var(--outline);">
                <div style="width: ${widthPct}%; height: 100%; background: ${isNeg ? 'var(--negative)' : 'var(--positive)'}; border-radius: 3px;"></div>
              </div>
              <span class="muted-sm" style="font-size: 0.6875rem; flex-shrink: 0;" title="คงเหลือหลังหัก Deadweight, Attribution, Displacement">
                สุทธิ: <strong>${netRetentionPct}%</strong>
              </span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

/**
 * 3. Annual Journey & Break-Even Timeline
 */
export function renderAnnualTrendChart(annualData = []) {
  if (!annualData || annualData.length === 0) {
    return `<div class="empty-state" style="padding: var(--sp-md); text-align: center;"><span class="muted-sm">ไม่มีข้อมูลคาดการณ์รายปี</span></div>`;
  }

  // Calculate cumulative position to find break-even year
  let breakEvenYear = null;
  annualData.forEach((d) => {
    const cImpact = d.cumulative_present_value ?? 0;
    const cInv = d.cumulative_investment ?? 0;
    if (breakEvenYear === null && d.year > 0 && cImpact >= cInv && cInv > 0) {
      breakEvenYear = d.year;
    }
  });

  const maxVal = Math.max(
    ...annualData.map((d) =>
      Math.max(d.investment || 0, d.present_value || 0, d.cumulative_present_value || 0),
    ),
    1,
  );

  return `
    <div style="display: flex; flex-direction: column; gap: var(--sp-md);">
      <!-- Timeline Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--sp-sm);">
        ${annualData
          .map((d) => {
            const isY0 = d.year === 0;
            const isBE = d.year === breakEvenYear;
            const inv = d.investment || 0;
            const pv = d.present_value || 0;
            const cNet = (d.cumulative_present_value || 0) - (d.cumulative_investment || 0);

            return `
            <div style="padding: var(--sp-sm); background: ${isBE ? 'var(--primary-soft)' : 'var(--surface)'}; border: 1px solid ${isBE ? 'var(--primary)' : 'var(--outline)'}; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px; position: relative;">
              ${isBE ? `<span class="badge badge-primary" style="position: absolute; top: -8px; right: 8px; font-size: 0.625rem; font-weight: 700;">★ คุ้มทุน (Payback)</span>` : ''}
              <div class="strong" style="font-size: 0.75rem; color: ${isBE ? 'var(--primary)' : 'var(--muted)'};">
                ${isY0 ? 'Year 0 (งบตั้งต้น)' : `Year ${d.year} (ปีที่ ${d.year})`}
              </div>
              <div style="font-size: 0.6875rem; color: var(--muted); display: flex; justify-content: space-between;">
                <span>ลงทุน:</span>
                <span style="font-weight: 600; color: var(--on-background);">${formatBahtCompact(inv)}</span>
              </div>
              <div style="font-size: 0.6875rem; color: var(--muted); display: flex; justify-content: space-between;">
                <span>ผลตอบแทน (PV):</span>
                <span class="val--positive strong">${formatBahtCompact(pv)}</span>
              </div>
              <div style="font-size: 0.6875rem; border-top: 1px dashed var(--outline); padding-top: 4px; margin-top: 2px; display: flex; justify-content: space-between;">
                <span>สะสมสุทธิ:</span>
                <span class="strong ${cNet >= 0 ? 'val--positive' : 'val--negative'}">
                  ${cNet > 0 ? '+' : ''}${formatBahtCompact(cNet)}
                </span>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>

      <!-- Comparative Bar Visual -->
      <div style="background: var(--surface-soft); border-radius: var(--radius-md); padding: var(--sp-md); border: 1px solid var(--outline);">
        <div style="display: flex; gap: var(--sp-lg); font-size: 0.75rem; justify-content: flex-end; margin-bottom: var(--sp-sm);">
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 10px; height: 10px; background: var(--warning); border-radius: 2px;"></span> เงินลงทุน (Investment)
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 10px; height: 10px; background: var(--primary); border-radius: 2px;"></span> ผลตอบแทนทางสังคมคิดลด (PV)
          </span>
        </div>

        <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 140px; border-bottom: 1px solid var(--outline); gap: 8px; padding-top: 10px;">
          ${annualData
            .map((d) => {
              const invH = Math.max(3, ((d.investment || 0) / maxVal) * 110);
              const pvH = Math.max(3, ((d.present_value || 0) / maxVal) * 110);

              return `
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px;">
                <div style="display: flex; align-items: flex-end; gap: 4px; justify-content: center; width: 100%;">
                  <div style="width: 14px; height: ${invH}px; background: var(--warning); border-radius: 3px 3px 0 0;" title="Year ${d.year} ลงทุน: ${formatBaht(d.investment || 0)}"></div>
                  <div style="width: 14px; height: ${pvH}px; background: var(--primary); border-radius: 3px 3px 0 0;" title="Year ${d.year} ผลกระทบ: ${formatBaht(d.present_value || 0)}"></div>
                </div>
                <span style="font-size: 0.6875rem; color: var(--muted); margin-top: 4px;">Yr ${d.year}</span>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}
