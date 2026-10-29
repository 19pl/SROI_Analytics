import { icons } from './components/icons.js';
import { renderAbout } from './views/aboutView.js';
import { renderCalculator } from './views/calculatorView.js';
import { renderProjects } from './views/projectsView.js';
import { renderReports } from './views/reportsView.js';
import { renderAuth } from './views/authView.js';

export const routes = [
  { path: '#/projects', label: 'Projects Workspace', icon: icons.folder, render: renderProjects },
  { path: '#/wizard/step-1', label: 'SROI Calculator', icon: icons.calculator, render: renderCalculator },
  { path: '#/reports', label: 'Reports & Audit', icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`, render: renderReports },
  { path: '#/about', label: 'Methodology & Principles', icon: icons.info, render: renderAbout },
  { path: '#/auth', label: 'Account & Org', icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`, render: renderAuth },
];
