/**
 * Step 5: Calculation Review & Readiness Check
 * Guided, beginner-friendly experience for university employees.
 * Provides structured overview, actionable blocker resolution, scenario testing, and tornado analysis.
 * Fully bilingual (Thai & English).
 */

import { getState, setActiveScenario } from '../../store.js';
import { formatBaht } from '../../utils/format.js';
import { escapeHtml } from '../../utils/html.js';
import { icons } from '../../components/icons.js';
import { t, getLanguage } from '../../i18n.js';
import { wizardFooterHtml, attachWizardFooterEvents } from '../../components/wizardFooter.js';
import { openScenarioModal } from '../../components/scenarioModal.js';
import { getReadiness } from '../../utils/readiness.js';

export function renderStep5(container) {
  const {
    project,
    review,
    activeScenarioId,
    costs = [],
    stakeholders = [],
    outcomes = [],
    investmentSummary,
    scenarios = [],
  } = getState();
  const lang = getLanguage();
  const isTh = lang !== 'en';

  if (!project) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__title">${t('alert_select_project_first', 'Please select or create a project first.')}</p></div>`;
    return;
  }

  const rd = getReadiness(review);
  const isReady = rd.ready && [1, 2, 3, 4].every((n) => rd.isComplete(n));
  const blockers = rd.blockers;
  const warnings = rd.warnings;
  const summary = { total: investmentSummary?.total_investment ?? 0 };

  // Helper to determine step link for a blocker
  const getFixLink = (path = '') => {
    const p = String(path).toLowerCase();
    if (p.includes('discount'))
      return {
        step: 1,
        hash: '#/wizard/step-1',
        label: isTh ? 'ขั้นตอนที่ 1 (เงินลงทุน)' : 'Step 1 (Investment)',
      };
    if (p.includes('stakeholder') || p.includes('cost') || p.includes('investment'))
      return {
        step: 2,
        hash: '#/wizard/step-2',
        label: isTh ? 'ขั้นตอนที่ 2 (ผู้มีส่วนได้เสีย)' : 'Step 2 (Stakeholders)',
      };
    if (p.includes('outcome') || p.includes('proxy') || p.includes('quantity'))
      return {
        step: 3,
        hash: '#/wizard/step-3',
        label: isTh ? 'ขั้นตอนที่ 3 (ผลลัพธ์)' : 'Step 3 (Outcomes)',
      };
    if (p.includes('adjustment') || p.includes('deadweight') || p.includes('attribution'))
      return {
        step: 4,
        hash: '#/wizard/step-4',
        label: isTh ? 'ขั้นตอนที่ 4 (การปรับปรุง)' : 'Step 4 (Adjustments)',
      };
    return {
      step: 1,
      hash: '#/wizard/step-1',
      label: isTh ? 'ตรวจสอบข้อมูล' : 'Review Input',
    };
  };

  const firstBlocker = blockers[0];
  const firstFix = firstBlocker ? getFixLink(firstBlocker.path) : null;

  // Step status comes only from the shared readiness helper (same source as the stepper)
  const isStep1Ok = rd.isComplete(1);
  const isStep2Ok = rd.isComplete(2);
  const isStep3Ok = rd.isComplete(3);
  const isStep4Ok = rd.isComplete(4);
  const stepIssues = (n) => rd.step(n).issues;
  const firstIncomplete = [1, 2, 3, 4].find((n) => !rd.isComplete(n));
  const issueCount = rd.allIssues().length;

  container.innerHTML = `
    <div class="form-stack stack-lg">
      <!-- Readiness Banner -->
      <div class="panel ${isReady ? 'status--ok' : 'status--warn'}">
        <div class="toolbar">
          <div class="stack-xs">
            <div class="cluster">
              <span class="status ${isReady ? 'status--ok' : 'status--warn'}">
                ${isReady ? (isTh ? 'พร้อมคำนวณ' : 'Ready') : isTh ? 'ต้องระบุข้อมูลเพิ่ม' : 'Attention needed'}
              </span>
              <h2 class="panel__title">
                ${
                  isReady
                    ? isTh
                      ? 'ข้อมูลครบถ้วน พร้อมสำหรับการคำนวณ SROI'
                      : 'Ready to calculate'
                    : isTh
                      ? `พบ ${issueCount || blockers.length} รายการที่ต้องแก้ไขก่อนคำนวณ`
                      : `${issueCount || blockers.length} items need attention`
                }
              </h2>
            </div>
            <p class="muted-sm">
              ${
                isReady
                  ? isTh
                    ? 'ข้อมูลที่จำเป็นทั้งหมดได้รับการตรวจสอบแล้ว สามารถเลือกปุ่มคำนวณเพื่อดูแดชบอร์ดสรุปผลได้'
                    : 'All mandatory parameters are satisfied. You can proceed to view the calculation dashboard.'
                  : isTh
                    ? 'กรุณาแก้ไขรายการที่ยังไม่ครบถ้วนเพื่อให้ระบบสามารถคำนวณผลลัพธ์ได้อย่างถูกต้อง'
                    : 'Please resolve the following required inputs before generating final results.'
              }
            </p>
          </div>

          <div>
            ${
              isReady
                ? `
              <a class="btn btn-primary" href="#/wizard/step-6">
                ${isTh ? 'คำนวณผลลัพธ์ SROI' : 'Proceed to Dashboard'}
              </a>
            `
                : (firstIncomplete || firstFix)
                  ? `
              <a class="btn btn-primary" href="#/wizard/step-${firstIncomplete || firstFix.step}">
                ${isTh ? 'ไปที่รายการแรกที่ต้องแก้ไข' : 'Go to first missing item'} (${isTh ? 'ขั้นตอนที่' : 'Step'} ${firstIncomplete || firstFix.step})
              </a>
            `
                  : ''
            }
          </div>
        </div>

        ${
          !isReady && blockers.length === 0 && issueCount > 0
            ? `<div class="form-stack stack-xs stack-top-md">${rd
                .allIssues()
                .map(
                  (i) => `<div class="cluster cluster--space-between panel panel--soft">
                    <span class="strong">${escapeHtml(i.message)}</span>
                    <a href="#/wizard/step-${i.step}" class="btn btn-secondary btn-compact">${isTh ? 'ขั้นตอนที่' : 'Step'} ${i.step}</a>
                  </div>`,
                )
                .join('')}</div>`
            : ''
        }
        ${
          blockers.length > 0
            ? `
          <div class="form-stack stack-xs stack-top-md">
            ${blockers
              .map((b) => {
                const fix = getFixLink(b.path);
                return `
              <div class="cluster cluster--space-between panel panel--soft">
                <div class="cluster stack-sm">
                  <span class="status status--warn">${isTh ? 'จำเป็น' : 'Required'}</span>
                  <span class="strong">${escapeHtml(b.message)}</span>
                  <span class="muted-sm">(${escapeHtml(b.path)})</span>
                </div>
                <a href="${fix.hash}" class="btn btn-secondary btn-compact">
                  ${fix.label}
                </a>
              </div>
            `;
              })
              .join('')}
          </div>
        `
            : ''
        }

        ${
          warnings.length > 0
            ? `
          <details class="disclosure stack-top-md">
            <summary class="disclosure__summary">
              ${isTh ? `ข้อสังเกตและสมมติฐาน (${warnings.length} รายการ)` : `Methodology Notes & Warnings (${warnings.length})`}
            </summary>
            <div class="panel__hint form-stack stack-xs">
              ${warnings
                .map(
                  (w) => `
                <div class="muted-sm">• ${escapeHtml(w.message)}</div>
              `,
                )
                .join('')}
            </div>
          </details>
        `
            : ''
        }
      </div>

      <!-- Checklist Section -->
      <div class="panel">
        <h3 class="panel__title">
          ${isTh ? 'รายการตรวจสอบความพร้อมรายขั้นตอน' : 'Step-by-step Readiness Checklist'}
        </h3>

        <div class="form-stack stack-sm">
          <!-- Step 1: Project & Investment -->
          <div class="cluster cluster--space-between panel panel--soft">
            <div class="cluster stack-md">
              <span class="status ${isStep1Ok ? 'status--ok' : 'status--warn'}">
                ${isStep1Ok ? (isTh ? 'สมบูรณ์' : 'Complete') : isTh ? 'ต้องระบุข้อมูล' : 'Incomplete'}
              </span>
              <div>
                <strong class="strong">1. ${isTh ? 'โครงการและเงินลงทุน' : 'Project & Investment'}</strong>
                <span class="muted-sm">
                  ${
                    summary.total > 0
                      ? `${isTh ? 'งบประมาณรวม:' : 'Total Investment:'} ${formatBaht(summary.total)}`
                      : isTh
                        ? 'ยังไม่ได้บันทึกงบประมาณ'
                        : 'No investment entered'
                  }
                </span>
              </div>
            </div>
            <a href="#/wizard/step-2" class="btn btn-secondary btn-compact">
              ${isTh ? 'แก้ไข' : 'Edit'}
            </a>
          </div>

          <!-- Step 2: Stakeholders -->
          <div class="cluster cluster--space-between panel panel--soft">
            <div class="cluster stack-md">
              <span class="status ${isStep2Ok ? 'status--ok' : 'status--warn'}">
                ${isStep2Ok ? (isTh ? 'สมบูรณ์' : 'Complete') : isTh ? 'ต้องระบุข้อมูล' : 'Incomplete'}
              </span>
              <div>
                <strong class="strong">2. ${isTh ? 'ผู้มีส่วนได้ส่วนเสีย' : 'Stakeholders'}</strong>
                <span class="muted-sm">
                  ${stakeholders.length} ${isTh ? 'กลุ่มที่ระบุ' : 'groups defined'}
                </span>
              </div>
            </div>
            <a href="#/wizard/step-2" class="btn btn-secondary btn-compact">
              ${isTh ? 'แก้ไข' : 'Edit'}
            </a>
          </div>

          <!-- Step 3: Outcomes -->
          <div class="cluster cluster--space-between panel panel--soft">
            <div class="cluster stack-md">
              <span class="status ${isStep3Ok ? 'status--ok' : 'status--warn'}">
                ${isStep3Ok ? (isTh ? 'สมบูรณ์' : 'Complete') : isTh ? 'ต้องระบุข้อมูล' : 'Incomplete'}
              </span>
              <div>
                <strong class="strong">3. ${isTh ? 'ผลลัพธ์และตัวแทนทางการเงิน' : 'Outcomes & Proxies'}</strong>
                <span class="muted-sm">
                  ${outcomes.length} ${isTh ? 'ผลลัพธ์ที่ระบุ' : 'outcomes identified'}
                </span>
              </div>
            </div>
            <a href="#/wizard/step-3" class="btn btn-secondary btn-compact">
              ${isTh ? 'แก้ไข' : 'Edit'}
            </a>
          </div>

          <!-- Step 4: Adjustments -->
          <div class="cluster cluster--space-between panel panel--soft">
            <div class="cluster stack-md">
              <span class="status ${isStep4Ok ? 'status--ok' : 'status--warn'}">
                ${isStep4Ok ? (isTh ? 'สมบูรณ์' : 'Complete') : isTh ? 'ต้องระบุข้อมูล' : 'Incomplete'}
              </span>
              <div>
                <strong class="strong">4. ${isTh ? 'การปรับปรุงผลกระทบ' : 'Impact Adjustments'}</strong>
                <span class="muted-sm">
                  ${isStep4Ok ? (isTh ? 'ประเมินแล้วทุกผลลัพธ์' : 'All assessed') : escapeHtml(stepIssues(4)[0] || (isTh ? 'ยังมีช่องว่างที่ไม่ได้ประเมิน' : 'Pending assessment'))}
                </span>
              </div>
            </div>
            <a href="#/wizard/step-4" class="btn btn-secondary btn-compact">
              ${isTh ? 'แก้ไข' : 'Edit'}
            </a>
          </div>
        </div>
      </div>

      <!-- Scenarios Section (Collapsed in a disclosure) -->
      <details class="disclosure">
        <summary class="disclosure__summary">
          <span>${isTh ? 'แบบจำลองสถานการณ์และความอ่อนไหว (Scenarios)' : 'Alternative Scenarios & Sensitivity'}</span>
          <span class="muted-sm">${scenarios.length} ${isTh ? 'สถานการณ์' : 'scenarios'}</span>
        </summary>
        <div class="panel__hint form-stack stack-md">
          <div class="toolbar">
            <p class="muted-sm">
              ${
                isTh
                  ? 'สร้างแบบจำลองสถานการณ์ทางเลือกเพื่อทดสอบความอ่อนไหวของผลลัพธ์ (Sensitivity Testing)'
                  : 'Define sensitivity scenarios to stress-test your SROI under varying assumptions.'
              }
            </p>
            <button class="btn btn-secondary btn-compact" id="btnAddScenarioReview">
              ${icons.plus} ${isTh ? 'เพิ่มสถานการณ์' : 'Add Scenario'}
            </button>
          </div>

          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>${isTh ? 'ชื่อสถานการณ์' : 'Scenario'}</th>
                  <th>${isTh ? 'ประเภท' : 'Type'}</th>
                  <th>${isTh ? 'อัตราคิดลด override' : 'Discount Rate'}</th>
                  <th>${isTh ? 'สถานะ' : 'Status'}</th>
                  <th>${isTh ? 'การดำเนินการ' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="strong">${isTh ? 'กรณีฐาน (Base Case)' : 'Base Case (Current Project)'}</td>
                  <td><span class="status status--neutral">${isTh ? 'โครงการจริง' : 'Base'}</span></td>
                  <td>${project.discount_rate != null ? `${project.discount_rate}%` : '-'}</td>
                  <td>
                    ${
                      !activeScenarioId
                        ? `<span class="status status--ok">${isTh ? 'กำลังใช้งาน' : 'Active'}</span>`
                        : `<span class="status status--neutral">${isTh ? 'ไม่ได้เลือก' : 'Inactive'}</span>`
                    }
                  </td>
                  <td>
                    ${
                      activeScenarioId
                        ? `<button class="btn btn-ghost btn-compact-subtle" data-set-scenario="base">${isTh ? 'เปิดใช้' : 'Select'}</button>`
                        : '-'
                    }
                  </td>
                </tr>
                ${
                  scenarios.length === 0
                    ? `<tr><td colspan="5" class="empty-state">${isTh ? 'ยังไม่มีแบบจำลองสถานการณ์เสริม' : 'No alternative scenarios defined.'}</td></tr>`
                    : scenarios
                        .map((s) => {
                          const isActive = activeScenarioId === s.id;
                          const disc =
                            s.assumptions?.global?.discount_rate != null
                              ? `${(s.assumptions.global.discount_rate * 100).toFixed(1)}%`
                              : '-';
                          return `
                        <tr>
                          <td class="strong">${escapeHtml(s.name)}</td>
                          <td><span class="status status--neutral">${escapeHtml(s.kind)}</span></td>
                          <td>${disc}</td>
                          <td>
                            ${
                              isActive
                                ? `<span class="status status--ok">${isTh ? 'กำลังใช้งาน' : 'Active'}</span>`
                                : `<span class="status status--neutral">${isTh ? 'ไม่ได้เลือก' : 'Inactive'}</span>`
                            }
                          </td>
                          <td>
                            ${
                              !isActive
                                ? `<button class="btn btn-ghost btn-compact-subtle" data-set-scenario="${s.id}">${isTh ? 'เปิดใช้' : 'Select'}</button>`
                                : '-'
                            }
                          </td>
                        </tr>
                      `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <!-- Wizard Footer -->
      ${wizardFooterHtml(5, {
        canProceed: isReady,
        nextLabel: isTh
          ? 'คำนวณและดูแดชบอร์ดผลลัพธ์ (Step 6)'
          : 'Proceed to Results Dashboard (Step 6)',
      })}
    </div>
  `;

  document.getElementById('btnAddScenarioReview')?.addEventListener('click', () => {
    openScenarioModal({
      onSave: async () => {
        renderStep5(container);
      },
    });
  });

  container.querySelectorAll('[data-set-scenario]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.setScenario;
      const scenId = target === 'base' ? null : Number(target);
      await setActiveScenario(scenId);
      renderStep5(container);
    });
  });

  attachWizardFooterEvents(container);
}