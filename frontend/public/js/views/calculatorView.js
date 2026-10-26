import {
  addOutcome,
  getResult,
  getScenario,
  patchScenario,
  removeOutcome,
  updateOutcome,
} from '../store.js';
import { PROJECT_LIMITS } from '../config/constants.js';
import { clamp } from '../utils/math.js';
import { formatBaht } from '../utils/format.js';
import { outcomeTableCard, renderOutcomeRows } from './calculator/outcomeTable.js';
import { projectFormCard } from './calculator/projectForm.js';
import { summaryHtml } from './calculator/summaryPanel.js';
import { yearlyChartCard } from './calculator/yearlyChart.js';

const pageHtml = (scenario) => `<div>
  <h1 class="page-title">คำนวณ SROI</h1>
  <p class="muted page-sub" id="scenarioName"></p>
  <div class="calc-grid">
    <div class="stack">
      ${projectFormCard(scenario)}
      ${outcomeTableCard()}
    </div>
    <div class="stack sticky">
      <div id="summary"></div>
      <div id="chart"></div>
    </div>
  </div>
</div>`;

/** หน้าเครื่องคำนวณ: วาดโครงหน้าครั้งเดียว แล้วอัปเดตเฉพาะส่วนที่เปลี่ยนเมื่อผู้ใช้แก้ค่า */
export function renderCalculator(root) {
  root.innerHTML = pageHtml(getScenario());
  const page = root.firstElementChild;

  const rowsBody = page.querySelector('#outcomeBody');
  const scenarioName = page.querySelector('#scenarioName');
  const summary = page.querySelector('#summary');
  const chart = page.querySelector('#chart');

  const renderRows = () => renderOutcomeRows(rowsBody, getScenario().outcomes);

  // อัปเดตเฉพาะส่วนที่ขึ้นกับผลคำนวณ เพื่อไม่ให้ช่องที่กำลังพิมพ์เสียโฟกัส
  const updateResults = () => {
    const scenario = getScenario();
    const result = getResult();

    scenarioName.textContent = scenario.name;
    result.rows.forEach(({ outcome, presentValue }) => {
      const cell = page.querySelector(`tr[data-id="${outcome.id}"] [data-pv]`);
      if (cell) cell.textContent = formatBaht(presentValue);
    });
    summary.innerHTML = summaryHtml(scenario, result);
    chart.innerHTML = yearlyChartCard(result);
  };

  const refreshAll = () => {
    renderRows();
    updateResults();
  };

  /** ช่องข้อมูลโครงการ (data-field): ชื่อเป็นข้อความ ที่เหลือเป็นตัวเลขที่ถูกตัดตามขอบเขต */
  const handleProjectInput = (input) => {
    const key = input.dataset.field;
    const { min, max } = PROJECT_LIMITS[key] ?? {};
    const value = key === 'name' ? input.value : clamp(Number(input.value) || 0, min, max);
    patchScenario({ [key]: value });
  };

  /** ช่องในตารางผลลัพธ์ (data-outcome): ตัวเลขถูกตัดตาม attribute max ของช่องนั้น */
  const handleOutcomeInput = (input, outcomeId) => {
    const key = input.dataset.outcome;
    const value =
      input.type === 'number' ? clamp(Number(input.value) || 0, 0, Number(input.max)) : input.value;
    updateOutcome(outcomeId, { [key]: value });
  };

  page.addEventListener('input', ({ target }) => {
    const outcomeId = target.closest('tr')?.dataset.id;

    if (target.dataset.field) handleProjectInput(target);
    else if (target.dataset.outcome && outcomeId) handleOutcomeInput(target, outcomeId);
    else return;

    updateResults();
  });

  page.addEventListener('click', ({ target }) => {
    if (target.closest('[data-add]')) {
      addOutcome();
      refreshAll();
      return;
    }

    const removeButton = target.closest('[data-remove]');
    if (removeButton) {
      removeOutcome(removeButton.closest('tr').dataset.id);
      refreshAll();
    }
  });

  refreshAll();
}
