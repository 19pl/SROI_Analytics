import { icons } from './components/icons.js';
import { HOME_HASH } from './config/constants.js';
import { renderAbout } from './views/aboutView.js';
import { renderCalculator } from './views/calculatorView.js';
import { renderProjects } from './views/projectsView.js';

/**
 * รายการหน้า/เมนู (ลำดับในอาร์เรย์ = ลำดับเมนู และรายการแรกคือหน้า fallback)
 * เพิ่มหน้าใหม่: เพิ่มรายการที่นี่ แล้วสร้างไฟล์ใน views/
 */
export const routes = [
  { path: '#/about', label: 'SROI คืออะไร', icon: icons.info, render: renderAbout },
  { path: HOME_HASH, label: 'คำนวณ SROI', icon: icons.calculator, render: renderCalculator },
  { path: '#/projects', label: 'โครงการตัวอย่าง', icon: icons.folder, render: renderProjects },
];
