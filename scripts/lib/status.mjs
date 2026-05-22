// Renders the /metis:status output per PRD §"What `/metis:status` outputs".
// Pure functions only — no db, no IO.

function marker(tag) {
  if (tag === 'good') return '✓';
  if (tag === 'bad') return '✗';
  return '~';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// YYYY-MM-DD HH:MM in local time (unix seconds in).
function fmtTime(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function firstLine(task) {
  return String(task ?? '').split(/\r?\n/)[0].trim();
}

function formatRow(row) {
  const typeProv = `${row.task_type ?? ''} (${row.provider})`.padEnd(20);
  const followups = row.followup_messages ? JSON.parse(row.followup_messages).length : 0;
  const followupSuffix = followups > 0 ? ` [+${followups}]` : '';
  return `  [${marker(row.tag)}] ${fmtTime(row.ts)}  ${typeProv}  ${firstLine(row.task)}${followupSuffix}`;
}

function formatSummary(s) {
  const ratio = s.tagged > 0 ? `${Math.round((s.good / s.tagged) * 100)}%` : 'n/a';
  return [
    'Weekly summary (last 7 days):',
    `  Total delegations: ${s.total}`,
    `  Tagged: ${s.tagged} (good: ${s.good}, bad: ${s.bad})`,
    `  Good ratio: ${ratio}`,
    `  Untagged: ${s.untagged}`,
  ].join('\n');
}

// last: rows from memory.lastDelegations() — newest first; may be empty.
// summary: object from memory.weeklySummary() — { total, tagged, good, bad, untagged }.
export function formatStatus({ last, summary }) {
  const head = 'Last 10 delegations:';
  const rows = last && last.length > 0 ? last.map(formatRow).join('\n') : '  (no delegations yet)';
  return `${head}\n${rows}\n\n${formatSummary(summary)}\n`;
}
