// Coarse task-type classifier used to label delegations in the per-repo db.
// Pure functions only — no db, no IO. First matching keyword group wins;
// 'feature' is the default when nothing matches.

export function classifyTaskType(task) {
  const t = task.toLowerCase();
  if (/\b(fix|bug|broken|error|crash|fails?|failing)\b/.test(t)) return 'fix';
  if (/\b(review|check|audit|inspect)\b/.test(t)) return 'review';
  if (/\b(refactor|clean ?up|simplify|restructure)\b/.test(t)) return 'refactor';
  if (/\b(explain|what does|how does|why does|describe)\b/.test(t)) return 'explain';
  return 'feature';
}
