import { icons } from './components/ui.js';
import { renderCalculator } from './views/calculatorView.js';
import { renderProjects } from './views/projectsView.js';
import { renderAbout } from './views/aboutView.js';

/** เพิ่มหน้าใหม่: เพิ่มรายการที่นี่ แล้วสร้างไฟล์ใน views/ */
export const routes = [
  { path: '#/about', label: 'SROI คืออะไร', icon: icons.info, render: renderAbout },
  { path: '#/', label: 'เครื่องคำนวณ SROI', icon: icons.calculator, render: renderCalculator },
  { path: '#/projects', label: 'โครงการตัวอย่าง', icon: icons.folder, render: renderProjects },
];
