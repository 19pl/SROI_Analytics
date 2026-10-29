/**
 * Reactive Project Store for ImpactValue SROI Web Calculator
 * Connected directly to the PHP REST API (Single Source of Truth)
 */

import { api } from './api.js';

let state = {
  project: null,
  costs: [],
  stakeholders: [],
  outcomes: [],
  investmentSummary: null,
  review: null,
  dashboard: null,
  scenarios: [],
  runs: [],
  reports: [],
  activeScenarioId: null,
  isLoading: false,
  error: null,
};

const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('Store subscriber error:', e);
    }
  });
}

export function getState() {
  return state;
}

export function getProject() {
  return state.project;
}

/**
 * Load complete project data from Backend API
 */
export async function loadProject(projectId) {
  state.isLoading = true;
  state.error = null;
  notify();

  try {
    const [pRes, cRes, sRes, oRes, scRes] = await Promise.all([
      api.getProject(projectId),
      api.getCosts(projectId),
      api.getStakeholders(projectId),
      api.getOutcomes(projectId),
      api.getScenarios(projectId),
    ]);

    state.project = pRes.data;
    state.costs = cRes.data || [];
    state.stakeholders = sRes.data || [];
    state.outcomes = oRes.data || [];
    state.scenarios = scRes.data || [];

    localStorage.setItem('sroi_active_project_id', String(projectId));

    // Refresh calculation previews concurrently
    await refreshCalculations();
  } catch (err) {
    state.error = err.message;
    console.error('Failed to load project:', err);
  } finally {
    state.isLoading = false;
    notify();
  }
}

/**
 * Refresh Live Calculation Data (Summary, Review, Dashboard)
 */
export async function refreshCalculations() {
  if (!state.project?.id) return;
  const pId = state.project.id;

  try {
    const [sumRes, revRes, dashRes] = await Promise.all([
      api.getInvestmentSummary(pId).catch(() => ({ data: null })),
      api.getReview(pId).catch(() => ({ data: null })),
      api.getDashboard(pId, state.activeScenarioId).catch(() => ({ data: null })),
    ]);

    state.investmentSummary = sumRes.data;
    state.review = revRes.data;
    state.dashboard = dashRes.data;
  } catch (e) {
    console.warn('Calculation refresh note:', e);
  }
  notify();
}

/**
 * Project Details Actions (Step 1)
 */
export async function updateProject(changes, changeReason = null) {
  if (!state.project?.id) return;
  const res = await api.updateProject(state.project.id, changes, changeReason);
  state.project = { ...state.project, ...res.data };
  await refreshCalculations();
  return state.project;
}

export async function addCost(costData) {
  if (!state.project?.id) return;
  const res = await api.createCost(state.project.id, costData);
  state.costs.push(res.data);
  await refreshCalculations();
  return res.data;
}

export async function updateCost(costId, changes) {
  if (!state.project?.id) return;
  const res = await api.updateCost(state.project.id, costId, changes);
  const idx = state.costs.findIndex((c) => c.id === costId);
  if (idx !== -1) state.costs[idx] = res.data;
  await refreshCalculations();
  return res.data;
}

export async function removeCost(costId) {
  if (!state.project?.id) return;
  await api.deleteCost(state.project.id, costId);
  state.costs = state.costs.filter((c) => c.id !== costId);
  await refreshCalculations();
}

/**
 * Stakeholder Actions (Step 2)
 */
export async function addStakeholder(data) {
  if (!state.project?.id) return;
  const res = await api.createStakeholder(state.project.id, data);
  state.stakeholders.push(res.data);
  await refreshCalculations();
  return res.data;
}

export async function updateStakeholder(id, changes) {
  if (!state.project?.id) return;
  const res = await api.updateStakeholder(state.project.id, id, changes);
  const idx = state.stakeholders.findIndex((s) => s.id === id);
  if (idx !== -1) state.stakeholders[idx] = res.data;
  await refreshCalculations();
  return res.data;
}

export async function removeStakeholder(id) {
  if (!state.project?.id) return;
  await api.deleteStakeholder(state.project.id, id);
  state.stakeholders = state.stakeholders.filter((s) => s.id !== id);
  await refreshCalculations();
}

/**
 * Outcome Actions (Step 3)
 */
export async function addOutcome(data) {
  if (!state.project?.id) return;
  const res = await api.createOutcome(state.project.id, data);
  state.outcomes.push(res.data);
  await refreshCalculations();
  return res.data;
}

export async function updateOutcome(id, changes, changeReason = null) {
  if (!state.project?.id) return;
  const res = await api.updateOutcome(state.project.id, id, changes, changeReason);
  const idx = state.outcomes.findIndex((o) => o.id === id);
  if (idx !== -1) state.outcomes[idx] = res.data;
  await refreshCalculations();
  return res.data;
}

export async function removeOutcome(id) {
  if (!state.project?.id) return;
  await api.deleteOutcome(state.project.id, id);
  state.outcomes = state.outcomes.filter((o) => o.id !== id);
  await refreshCalculations();
}

/**
 * Impact Adjustment Actions (Step 4)
 */
export async function saveAdjustment(outcomeId, adjustmentData) {
  if (!state.project?.id) return;
  const res = await api.saveAdjustment(state.project.id, outcomeId, adjustmentData);
  const outcome = state.outcomes.find((o) => o.id === outcomeId);
  if (outcome) outcome.adjustment = res.data;
  await refreshCalculations();
  return res.data;
}

export async function saveYearProjections(outcomeId, projections) {
  if (!state.project?.id) return;
  const res = await api.saveYearProjections(state.project.id, outcomeId, projections);
  await refreshCalculations();
  return res.data;
}

/**
 * Scenario Actions (Step 5)
 */
export async function setActiveScenario(scenarioId) {
  state.activeScenarioId = scenarioId;
  await refreshCalculations();
}

export async function addScenario(data) {
  if (!state.project?.id) return;
  const res = await api.createScenario(state.project.id, data);
  state.scenarios.push(res.data);
  notify();
  return res.data;
}

/**
 * Execution & Reporting Actions (Step 6)
 */
export async function runCalculation(scenarioId = null) {
  if (!state.project?.id) return;
  const res = await api.calculateRun(state.project.id, scenarioId);
  await loadRuns();
  return res.data;
}

export async function loadRuns() {
  if (!state.project?.id) return;
  const res = await api.getRuns(state.project.id);
  state.runs = res.data || [];
  notify();
  return state.runs;
}

export async function loadReports() {
  if (!state.project?.id) return;
  const res = await api.getReports(state.project.id);
  state.reports = res.data || [];
  notify();
  return state.reports;
}

export async function createReport(runId, type = 'detailed', title = '') {
  if (!state.project?.id) return;
  const res = await api.createReport(state.project.id, runId, type, title);
  await loadReports();
  return res.data;
}
