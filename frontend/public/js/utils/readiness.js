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
