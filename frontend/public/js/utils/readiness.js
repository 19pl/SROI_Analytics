/**
 * Single source of truth for wizard readiness.
 * Reads the real GET /projects/:id/review shape:
 *   { ready_to_calculate, errors[{code,message,path}], warnings[], steps{1..6:{complete,issues[]}}, ... }
 * Every step view and the stepper must use this instead of re-deriving status.
 */

const EMPTY = { complete: false, issues: [] };

export function getReadiness(review) {
  const steps = review?.steps || {};
  const step = (n) => steps[n] || EMPTY;
  return {
    loaded: Boolean(review),
    ready: Boolean(review?.ready_to_calculate),
    blockers: review?.errors || [],
    warnings: review?.warnings || [],
    step,
    isComplete: (n) => Boolean(review) && step(n).complete === true,
    issueCount: (n) => step(n).issues.length,
    allIssues: () =>
      [1, 2, 3, 4, 5].flatMap((n) => step(n).issues.map((message) => ({ step: n, message }))),
  };
}

/** Steps (1-6) that are genuinely complete, for the stepper. Step 5 = ready to calculate. */
export function completedSteps(review) {
  const r = getReadiness(review);
  const done = [];
  if (!r.loaded) return done;
  for (const n of [1, 2, 3, 4]) if (r.isComplete(n)) done.push(n);
  if (r.ready && [1, 2, 3, 4].every((n) => r.isComplete(n))) done.push(5);
  if (r.isComplete(6)) done.push(6);
  return done;
}


/* ───────── Step gating: a step opens only when every step before it is complete ───────── */

const ISSUE_TH = [
  ['Add at least one investment item.', 'เพิ่มรายการเงินที่ใช้อย่างน้อย 1 รายการ'],
  ['Set the analysis period.', 'กรอกระยะเวลาวิเคราะห์ (ปี)'],
  ['Choose how investment is compared with present-value outcomes.', 'เลือกวิธีเปรียบเทียบเงินลงทุนกับผลลัพธ์ (ในส่วนตั้งค่าขั้นสูง)'],
  ['Identify at least one stakeholder group.', 'เพิ่มกลุ่มผู้มีส่วนได้เสียอย่างน้อย 1 กลุ่ม'],
  ['Add at least one outcome.', 'เพิ่มผลลัพธ์อย่างน้อย 1 รายการ'],
  ['Choose a discount rate (0% is allowed) and record why.', 'เลือกอัตราคิดลด (0% ได้) และระบุเหตุผล'],
];
const ISSUE_TH_RE = [
  [/^Outcome "(.*)" needs a quantity greater than zero\.$/, (n) => `ผลลัพธ์ "${n}" ต้องมีจำนวนมากกว่า 0`],
  [/^Outcome "(.*)" needs a proxy source or a stated assumption\.$/, (n) => `ผลลัพธ์ "${n}" ต้องระบุแหล่งที่มาของค่า proxy หรือเหตุผลประกอบ`],
  [/^Outcome "(.*)": assess all of deadweight/, (n) => `ผลลัพธ์ "${n}": ต้องประเมิน deadweight, attribution และ displacement ให้ครบ (0% ใช้ได้ แต่ต้องกรอก)`],
  [/^Outcome "(.*)": document the basis/, (n) => `ผลลัพธ์ "${n}": ต้องระบุเหตุผลหรือแหล่งที่มาของการปรับค่า`],
];

export function localizeIssue(msg, isTh) {
  if (!isTh) return msg;
  const hit = ISSUE_TH.find(([en]) => en === msg);
  if (hit) return hit[1];
  for (const [re, fn] of ISSUE_TH_RE) {
    const m = msg.match(re);
    if (m) return fn(m[1]);
  }
  return msg;
}

/** What is still missing in step n (1-5). Empty list = the step is complete (or nothing is loaded yet). */
export function stepIssues(state, n, isTh = true) {
  const review = state?.review;
  if (!review || n < 1 || n > 5) return [];
  const out = [];
  if (n === 1) {
    const p = state.project || {};
    if (!String(p.name || '').trim()) out.push(isTh ? 'กรอกชื่อโครงการ' : 'Enter the project name');
    if (!String(p.description || '').trim()) out.push(isTh ? 'กรอกวัตถุประสงค์ของโครงการ (โดยสังเขป)' : 'Describe what the project is for');
  }
  for (const m of getReadiness(review).step(n).issues) out.push(localizeIssue(m, isTh));
  return out;
}

/** Lowest step (1-5) that is not complete, or null when 1-5 are all complete. */
export function firstBlockedStep(state) {
  for (let n = 1; n <= 5; n++) if (stepIssues(state, n).length) return n;
  return null;
}

/** Highest step the user may open right now. */
export function maxOpenStep(state) {
  if (!state?.review) return 6; // nothing loaded yet: never lock people out
  return firstBlockedStep(state) ?? 6;
}

/** Can the user leave `step` for the next one? message explains why not. */
export function nextGate(state, step, isTh = true) {
  const issues = stepIssues(state, step, isTh);
  if (!issues.length) return { blocked: false, message: '' };
  const more = issues.length > 1 ? (isTh ? ` (และอีก ${issues.length - 1} ข้อ)` : ` (and ${issues.length - 1} more)`) : '';
  const lead = isTh ? `ยังไปต่อไม่ได้ — ขั้นที่ ${step} ยังไม่ครบ: ` : `Can't continue yet — step ${step} is incomplete: `;
  return { blocked: true, message: `${lead}${issues[0]}${more}`, issues };
}