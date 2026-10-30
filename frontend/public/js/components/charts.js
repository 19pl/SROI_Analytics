/**
 * SVG Visual Analytics Components
 * Renders Stakeholder Doughnut, Outcome Horizontal Bars, and Annual Trends without external chart dependencies
 */

import { formatBaht, formatBahtCompact } from '../utils/format.js';
import { escapeHtml } from '../utils/html.js';

const PALETTE = [
  '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6'
];

/**
 * 1. Stakeholder Value Breakdown (Doughnut Chart)
 */
export function renderStakeholderChart(stakeholders = []) {
  if (!stakeholders || stakeholders.length === 0) {
    return `<div class="muted" style="padding: 24px; text-align: center;">No stakeholder data available.</div>`;
  }

  const positiveShares = stakeholders.filter((s) => (s.positive_present_value || 0) > 0);
  const totalPositive = positiveShares.reduce((sum, s) => sum + s.positive_present_value, 0);

  if (totalPositive === 0) {
    return `<div class="muted" style="padding: 24px; text-align: center;">Total monetized stakeholder value is 0.</div>`;
  }

  // Calculate SVG arc paths
  const size = 180;
  const radius = 70;
  const cx = 90;
  const cy = 90;
  const strokeWidth = 24;

  let currentAngle = -Math.PI / 2;
  const slices = positiveShares.map((s, idx) => {
    const share = s.positive_present_value / totalPositive;
    const angle = share * 2 * Math.PI;
    const color = PALETTE[idx % PALETTE.length];

    // Circumference stroke dasharray trick
    const circumference = 2 * Math.PI * radius;
    const strokeDash = `${share * circumference} ${circumference}`;
    const strokeOffset = -((currentAngle + Math.PI / 2) / (2 * Math.PI)) * circumference;

    currentAngle += angle;

    return {
      name: s.name,
      value: s.positive_present_value,
      sharePct: Math.round(share * 100),
      color,
      strokeDash,
      strokeOffset,
    };
  });

  const legendHtml = slices
    .map(
      (s) => `
    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${s.color}; flex-shrink: 0;"></span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.name)}</span>
      </div>
      <span style="font-weight: 600; white-space: nowrap;">${s.sharePct}% <small class="muted">(${formatBahtCompact(s.value)})</small></span>
    </div>
  `,
    )
    .join('');

  return `
    <div style="display: flex; flex-wrap: wrap; gap: var(--sp-lg); align-items: center; justify-content: center;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex: none; max-width: 100%; height: auto;">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--surface-soft)" stroke-width="${strokeWidth}" />
        ${slices
          .map(
            (s) => `
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}"
            stroke-dasharray="${s.strokeDash}" stroke-dashoffset="${s.strokeOffset}"
            transform="rotate(-90 ${cx} ${cy})">
            <title>${escapeHtml(s.name)}: ${s.sharePct}% (${formatBaht(s.value)})</title>
          </circle>
        `,
          )
          .join('')}
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="var(--on-background)">
          ${positiveShares.length} Groups
        </text>
      </svg>
      <div style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 200px; min-width: 0;">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * 2. Outcome Valuation Breakdown (Horizontal Bar Chart)
 */
export function renderOutcomeBarChart(outcomeLines = []) {
  if (!outcomeLines || outcomeLines.length === 0) {
    return `<div class="muted" style="padding: 24px; text-align: center;">No monetized outcomes to display.</div>`;
  }

  const monetized = outcomeLines.filter((l) => l.included && l.totals?.present_value !== undefined);
  if (monetized.length === 0) {
    return `<div class="muted" style="padding: 24px; text-align: center;">No monetized outcomes included.</div>`;
  }

  const maxVal = Math.max(...monetized.map((l) => Math.abs(l.totals.present_value)), 1);

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${monetized
        .map((l) => {
          const pv = l.totals.present_value;
          const isNeg = pv < 0;
          const widthPct = Math.min(100, Math.max(3, (Math.abs(pv) / maxVal) * 100));

          return `
          <div class="hbar-row">
            <span class="hbar-label" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>
            <div class="hbar-track">
              <div class="hbar-fill ${isNeg ? 'hbar-fill-neg' : 'hbar-fill-pos'}" style="width: ${widthPct}%;"
                title="Gross: ${formatBaht(l.totals.gross)} | PV: ${formatBaht(pv)}"></div>
            </div>
            <span class="hbar-val" style="color: ${isNeg ? 'var(--negative)' : 'var(--positive)'};">
              ${isNeg ? '-' : ''}${formatBahtCompact(Math.abs(pv))}
            </span>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

/**
 * 3. Annual Investment vs Social Value (Grouped Trend Chart)
 */
export function renderAnnualTrendChart(annualData = []) {
  if (!annualData || annualData.length === 0) {
    return `<div class="muted" style="padding: 24px; text-align: center;">No annual projection data.</div>`;
  }

  const maxVal = Math.max(
    ...annualData.map((d) => Math.max(d.investment || 0, d.present_value || 0)),
    1,
  );

  return `
    <div style="display: flex; flex-direction: column; gap: var(--sp-md);">
      <div style="display: flex; gap: var(--sp-lg); font-size: 0.75rem; justify-content: flex-end;">
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 12px; height: 12px; background: var(--warning); border-radius: 2px;"></span> Investment Cost
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 12px; height: 12px; background: var(--primary); border-radius: 2px;"></span> Discounted Social Impact
        </span>
      </div>

      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 160px; padding-top: 10px; border-bottom: 1px solid var(--outline); gap: 12px; overflow-x: auto;">
        ${annualData
          .map((d) => {
            const invH = ((d.investment || 0) / maxVal) * 120;
            const pvH = ((d.present_value || 0) / maxVal) * 120;

            return `
            <div style="flex: 1 0 44px; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end;">
              <div style="display: flex; align-items: flex-end; gap: 4px; width: 100%; justify-content: center;">
                <div style="width: 14px; height: ${Math.max(2, invH)}px; background: var(--warning); border-radius: 3px 3px 0 0;"
                  title="Year ${d.year} Investment: ${formatBaht(d.investment)}"></div>
                <div style="width: 14px; height: ${Math.max(2, pvH)}px; background: var(--primary); border-radius: 3px 3px 0 0;"
                  title="Year ${d.year} Present Value: ${formatBaht(d.present_value)}"></div>
              </div>
              <span style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Yr ${d.year}</span>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}
