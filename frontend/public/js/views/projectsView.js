import { badge, card } from '../components/ui.js';
import { mockProjects } from '../data/mockProjects.js';
import { loadScenario } from '../store.js';
import { calculateSroi, escapeHtml, formatBaht, formatRatio } from '../utils/sroi.js';

export function renderProjects(root) {
  root.innerHTML = `<div>
    <h1 class="page-title">โครงการตัวอย่าง</h1>
    <p class="muted page-sub">เลือกโครงการเพื่อโหลดข้อมูลไปคำนวณและปรับค่าต่อได้</p>
    ${card({ body: `<div class="table-wrap"><table class="table"><thead><tr>
      <th>โครงการ</th><th>สถานะ</th><th class="num">เงินลงทุน</th><th class="num">ระยะเวลา</th><th class="num">SROI</th><th></th></tr></thead><tbody>
      ${mockProjects.map((p, i) => `<tr>
        <td class="strong">${escapeHtml(p.name)}</td><td>${badge(p.status)}</td>
        <td class="num">${formatBaht(p.investment)}</td><td class="num">${p.years} ปี</td>
        <td class="num strong">${formatRatio(calculateSroi(p).ratio)}</td>
        <td class="num"><button class="btn btn-primary" data-open="${i}">เปิดในเครื่องคำนวณ</button></td></tr>`).join('')}
      </tbody></table></div>` })}</div>`;

  root.firstElementChild.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    loadScenario(mockProjects[Number(b.dataset.open)]);
    location.hash = '#/';
  });
}
