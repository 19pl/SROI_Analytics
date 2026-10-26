// state ของโครงการที่กำลังคำนวณ (อยู่ในหน่วยความจำ)
import { mockProjects } from './data/mockProjects.js';
import { calculateSroi } from './utils/sroi.js';

let scenario = structuredClone(mockProjects[0]);
let outcomeSeq = 0;

const createOutcomeId = () => `outcome-${Date.now()}-${outcomeSeq++}`;

const createEmptyOutcome = () => ({
  id: createOutcomeId(),
  name: 'ผลลัพธ์ใหม่',
  stakeholder: '',
  quantity: 0,
  proxyValue: 0,
  deadweight: 0,
  attribution: 0,
  dropOff: 0,
});

const findOutcome = (id) => scenario.outcomes.find((outcome) => outcome.id === id);

// ---- อ่านค่า ----
export const getScenario = () => scenario;
export const getResult = () => calculateSroi(scenario);

// ---- แก้ไขค่า ----
export const loadScenario = (project) => {
  scenario = structuredClone(project);
};
export const patchScenario = (changes) => Object.assign(scenario, changes);

export const addOutcome = () => scenario.outcomes.push(createEmptyOutcome());
export const updateOutcome = (id, changes) => Object.assign(findOutcome(id), changes);
export const removeOutcome = (id) => {
  scenario.outcomes = scenario.outcomes.filter((outcome) => outcome.id !== id);
};
