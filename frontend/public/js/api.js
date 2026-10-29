/**
 * Central API Client for ImpactValue SROI Backend
 * Communicates with PHP REST API on http://localhost:8000/api/v1
 */

const API_BASE =
  (typeof localStorage !== 'undefined' && localStorage.getItem('sroi_api_base_url')) ||
  window.API_BASE_URL ||
  'http://localhost:8000/api/v1';

let authToken = localStorage.getItem('sroi_auth_token') || null;
let currentUser = null;

try {
  const savedUser = localStorage.getItem('sroi_user');
  if (savedUser) currentUser = JSON.parse(savedUser);
} catch (e) {
  currentUser = null;
}

export function getAuthToken() {
  return authToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function setSession(token, user) {
  authToken = token;
  currentUser = user;
  if (token) {
    localStorage.setItem('sroi_auth_token', token);
  } else {
    localStorage.removeItem('sroi_auth_token');
  }
  if (user) {
    localStorage.setItem('sroi_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sroi_user');
  }
}

export function clearSession() {
  setSession(null, null);
}

/**
 * Core HTTP Request Wrapper
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE}. Please ensure the backend is running (php -S localhost:8000 -t public public/index.php).`,
    );
  }

  // Handle blob responses (e.g. PDF/CSV exports)
  if (options.responseType === 'blob') {
    if (!response.ok) {
      const errText = await response.text();
      let msg = 'Failed to export document';
      try {
        const j = JSON.parse(errText);
        msg = j.error?.message || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return response.blob();
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || `Request failed with status ${response.status}`);
    error.code = data.error?.code;
    error.details = data.error?.details || {};
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  // Generic methods
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),

  // Meta & Health
  health: () => request('/health'),
  meta: () => request('/meta'),

  // Auth
  register: (email, name, password) =>
    request('/auth/register', { method: 'POST', body: { email, name, password } }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  /**
   * Restore an existing authenticated session from localStorage.
   * If no valid token is found, returns null — the caller should redirect to login.
   * No credentials are ever stored in or read from source code.
   */
  ensureDemoSession: async () => {
    if (!authToken) {
      return null;
    }
    try {
      const me = await api.me();
      if (me?.data) {
        currentUser = me.data;
        setSession(authToken, currentUser);
        return me.data;
      }
    } catch (e) {
      // Token expired or invalid — clear and let caller redirect to login
      clearSession();
    }
    return null;
  },

  // Organizations
  getOrganizations: () => request('/organizations'),
  createOrganization: (name) => request('/organizations', { method: 'POST', body: { name } }),
  getOrgMembers: (orgId) => request(`/organizations/${orgId}/members`),
  createOrgProxy: (orgId, proxyData) =>
    request(`/organizations/${orgId}/proxies`, { method: 'POST', body: proxyData }),

  // Faculties
  getFaculties: (orgId) => request(`/organizations/${orgId}/faculties`),
  createFaculty: (orgId, data) =>
    request(`/organizations/${orgId}/faculties`, { method: 'POST', body: data }),
  getFaculty: (facultyId) => request(`/faculties/${facultyId}`),
  updateFaculty: (facultyId, data) =>
    request(`/faculties/${facultyId}`, { method: 'PATCH', body: data }),
  deleteFaculty: (facultyId) =>
    request(`/faculties/${facultyId}`, { method: 'DELETE' }),
  getFacultyDepartments: (facultyId) => request(`/faculties/${facultyId}/departments`),
  getFacultyReport: (facultyId) => request(`/faculties/${facultyId}/report`),

  // Departments
  createDepartment: (facultyId, data) =>
    request(`/faculties/${facultyId}/departments`, { method: 'POST', body: data }),
  getDepartment: (departmentId) => request(`/departments/${departmentId}`),
  updateDepartment: (departmentId, data) =>
    request(`/departments/${departmentId}`, { method: 'PATCH', body: data }),
  deleteDepartment: (departmentId) =>
    request(`/departments/${departmentId}`, { method: 'DELETE' }),

  // Financial Proxies Library
  getProxies: (category = '', query = '') => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (query) params.set('q', query);
    return request(`/proxies?${params.toString()}`);
  },

  // Projects CRUD
  getProjects: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.organization_id) params.set('organization_id', filters.organization_id);
    if (filters.faculty_id) params.set('faculty_id', filters.faculty_id);
    if (filters.department_id) params.set('department_id', filters.department_id);
    if (filters.deleted) params.set('deleted', '1');
    const qs = params.toString();
    return request(`/projects${qs ? '?' + qs : ''}`);
  },
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  updateProject: (id, data, changeReason = null) => {
    const headers = changeReason ? { 'X-Change-Reason': changeReason } : {};
    return request(`/projects/${id}`, { method: 'PATCH', body: data, headers });
  },
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  restoreProject: (id) => request(`/projects/${id}/restore`, { method: 'POST' }),
  getProjectAudit: (id) => request(`/projects/${id}/audit`),

  // Project Costs (Step 1)
  getCosts: (projectId) => request(`/projects/${projectId}/costs`),
  createCost: (projectId, data) =>
    request(`/projects/${projectId}/costs`, { method: 'POST', body: data }),
  updateCost: (projectId, costId, data) =>
    request(`/projects/${projectId}/costs/${costId}`, { method: 'PATCH', body: data }),
  deleteCost: (projectId, costId) =>
    request(`/projects/${projectId}/costs/${costId}`, { method: 'DELETE' }),
  getInvestmentSummary: (projectId) => request(`/projects/${projectId}/summary`),

  // Stakeholders (Step 2)
  getStakeholders: (projectId) => request(`/projects/${projectId}/stakeholders`),
  createStakeholder: (projectId, data) =>
    request(`/projects/${projectId}/stakeholders`, { method: 'POST', body: data }),
  updateStakeholder: (projectId, id, data) =>
    request(`/projects/${projectId}/stakeholders/${id}`, { method: 'PATCH', body: data }),
  deleteStakeholder: (projectId, id) =>
    request(`/projects/${projectId}/stakeholders/${id}`, { method: 'DELETE' }),

  // Outcomes (Step 3)
  getOutcomes: (projectId) => request(`/projects/${projectId}/outcomes`),
  createOutcome: (projectId, data) =>
    request(`/projects/${projectId}/outcomes`, { method: 'POST', body: data }),
  updateOutcome: (projectId, id, data, changeReason = null) => {
    const headers = changeReason ? { 'X-Change-Reason': changeReason } : {};
    return request(`/projects/${projectId}/outcomes/${id}`, { method: 'PATCH', body: data, headers });
  },
  deleteOutcome: (projectId, id) =>
    request(`/projects/${projectId}/outcomes/${id}`, { method: 'DELETE' }),

  // Adjustments & Year Projections (Step 4)
  getAdjustment: (projectId, outcomeId) =>
    request(`/projects/${projectId}/outcomes/${outcomeId}/adjustment`),
  saveAdjustment: (projectId, outcomeId, data) =>
    request(`/projects/${projectId}/outcomes/${outcomeId}/adjustment`, { method: 'PUT', body: data }),
  getYearProjections: (projectId, outcomeId) =>
    request(`/projects/${projectId}/outcomes/${outcomeId}/year-projections`),
  saveYearProjections: (projectId, outcomeId, projections) =>
    request(`/projects/${projectId}/outcomes/${outcomeId}/year-projections`, {
      method: 'PUT',
      body: { projections },
    }),

  // Evidence Attachments
  getEvidence: (projectId, entityType = null, entityId = null) => {
    let q = '';
    if (entityType) q += `?entity_type=${entityType}`;
    if (entityId) q += (q ? '&' : '?') + `entity_id=${entityId}`;
    return request(`/projects/${projectId}/evidence${q}`);
  },
  uploadEvidence: (projectId, formData) =>
    request(`/projects/${projectId}/evidence`, { method: 'POST', body: formData }),
  deleteEvidence: (projectId, id) =>
    request(`/projects/${projectId}/evidence/${id}`, { method: 'DELETE' }),

  // Calculation & Review (Step 5 & 6)
  getReview: (projectId) => request(`/projects/${projectId}/review`),
  getDashboard: (projectId, scenarioId = null) => {
    const q = scenarioId ? `?scenario_id=${scenarioId}` : '';
    return request(`/projects/${projectId}/dashboard${q}`);
  },
  calculateRun: (projectId, scenarioId = null) =>
    request(`/projects/${projectId}/calculate`, { method: 'POST', body: { scenario_id: scenarioId } }),
  getRuns: (projectId) => request(`/projects/${projectId}/runs`),
  getRun: (projectId, runId) => request(`/projects/${projectId}/runs/${runId}`),
  getScenarios: (projectId) => request(`/projects/${projectId}/scenarios`),
  createScenario: (projectId, data) =>
    request(`/projects/${projectId}/scenarios`, { method: 'POST', body: data }),
  getScenarioComparison: (projectId) => request(`/projects/${projectId}/scenario-comparison`),
  getSensitivity: (projectId) => request(`/projects/${projectId}/sensitivity`),

  // Reports & Exports
  getReports: (projectId) => request(`/projects/${projectId}/reports`),
  createReport: (projectId, runId, type = 'detailed', title = '') =>
    request(`/projects/${projectId}/reports`, {
      method: 'POST',
      body: { calculation_run_id: runId, type, title },
    }),
  getReport: (reportId) => request(`/reports/${reportId}`),
  exportReport: async (reportId, format = 'pdf', dataset = null) => {
    let q = `?format=${format}`;
    if (dataset) q += `&dataset=${dataset}`;
    return request(`/reports/${reportId}/export${q}`, { responseType: 'blob' });
  },
  shareReport: (reportId) => request(`/reports/${reportId}/share`, { method: 'POST' }),
  unshareReport: (reportId) => request(`/reports/${reportId}/share`, { method: 'DELETE' }),
};
