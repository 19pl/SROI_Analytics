import { icons } from './components/icons.js';
import { renderAbout } from './views/aboutView.js';
import { renderCalculator } from './views/calculatorView.js';
import { renderProjects } from './views/projectsView.js';
import { renderReports } from './views/reportsView.js';
import { renderAuth } from './views/authView.js';
import { renderOrg } from './views/orgView.js';
import { renderFacultyReport } from './views/facultyReportView.js';

export const routes = [
  { path: '#/projects', labelKey: 'nav_projects', label: 'Projects Workspace', icon: icons.folder, render: renderProjects },
  { path: '#/wizard/step-1', labelKey: 'nav_calculator', label: 'SROI Calculator', icon: icons.calculator, render: renderCalculator },
  { path: '#/org', labelKey: 'nav_org', label: 'Faculties & Depts', icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-3"></path><path d="M9 9v.01"></path><path d="M9 12v.01"></path><path d="M9 15v.01"></path><path d="M9 18v.01"></path></svg>`, render: renderOrg },
  { path: '#/reports', labelKey: 'nav_reports', label: 'Reports & Audit', icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`, render: renderReports },
  { path: '#/faculty-report', labelKey: 'nav_faculty_report', label: 'Faculty Report', hidden: true, icon: '', render: renderFacultyReport },
  { path: '#/about', labelKey: 'nav_about', label: 'Methodology & Principles', icon: icons.info, render: renderAbout },
  { path: '#/auth', labelKey: 'nav_auth', label: 'Account & Org', icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`, render: renderAuth },
];
