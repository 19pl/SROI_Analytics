// state ของโครงการที่กำลังคำนวณ (อยู่ในหน่วยความจำ)
import { mockProjects } from './data/mockProjects.js';
import { calculateSroi } from './utils/sroi.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
let scenario = clone(mockProjects[0]);

export const getScenario = () => scenario;
export const getResult = () => calculateSroi(scenario);
export const loadScenario = (s) => { scenario = clone(s); };
export const patchScenario = (p) => Object.assign(scenario, p);
export const updateOutcome = (id, p) => Object.assign(scenario.outcomes.find((x) => x.id === id), p);
export const addOutcome = () =>
  scenario.outcomes.push({ id: String(Date.now()), name: 'ผลลัพธ์ใหม่', stakeholder: '', quantity: 0, proxyValue: 0, deadweight: 0, attribution: 0, dropOff: 0 });
export const removeOutcome = (id) => { scenario.outcomes = scenario.outcomes.filter((x) => x.id !== id); };
