import { badge, card } from '../components/ui.js';
import { HOME_HASH } from '../config/constants.js';
import { mockProjects } from '../data/mockProjects.js';
import { loadScenario } from '../store.js';
import { escapeHtml } from '../utils/html.js';
import { formatBaht, formatRatio } from '../utils/format.js';
import { calculateSroi } from '../utils/sroi.js';

const projectRow = (project, index) => `<tr>
  <td class="strong">${escapeHtml(project.name)}</td>
  <td>${badge(project.status)}</td>
  <td class="num">${formatBaht(project.investment)}</td>
  <td class="num">${project.years} ปี</td>
  <td class="num strong">${formatRatio(calculateSroi(project).ratio)}</td>
  <td class="num">
    <button class="btn btn-primary" data-open="${index}">เปิดในเครื่องคำนวณ</button>
  </td>
</tr>`;

const projectsTable = () => `<div class="table-wrap">
  <table class="table">
    <thead>
      <tr>
        <th>โครงการ</th>
        <th>สถานะ</th>
        <th class="num">เงินลงทุน</th>
        <th class="num">ระยะเวลา</th>
        <th class="num">SROI</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${mockProjects.map(projectRow).join('')}
    </tbody>
  </table>
</div>`;

/** หน้ารายการโครงการตัวอย่าง: กดปุ่มเพื่อโหลดโครงการไปที่เครื่องคำนวณ */
export function renderProjects(root) {
  root.innerHTML = `<div>
    <h1 class="page-title">โครงการตัวอย่าง</h1>
    <p class="muted page-sub">เลือกโครงการเพื่อโหลดข้อมูลไปคำนวณและปรับค่าต่อได้</p>
    ${card({ body: projectsTable() })}
  </div>`;

  root.firstElementChild.addEventListener('click', ({ target }) => {
    const openButton = target.closest('[data-open]');
    if (!openButton) return;

    loadScenario(mockProjects[Number(openButton.dataset.open)]);
    location.hash = HOME_HASH;
  });
}
