// Builds the exact <past_work> injection from PRD §"Prompt template".
// Pure functions only — no db, no IO.

const HEADER =
  '<past_work>\n' +
  'The following past delegations on this codebase are provided as reference. They are not part of the current task.\n' +
  '\n' +
  'Tagged outcomes:\n' +
  '- ✓ Past work that helped: use these patterns\n' +
  '- ✗ Past work that did not help: avoid repeating these mistakes\n' +
  '- Untagged: no judgment available, treat as neutral context\n' +
  '\n';

const BUDGET_TOKENS = 1500; // hard cap on the <past_work> block
const RESULT_CAP = 500; // chars of `result` per entry

function tagMarker(tag) {
  if (tag === 'good') return '✓ helped';
  if (tag === 'bad') return '✗ did not help';
  return '~ untagged';
}

function truncate(result, cap) {
  const r = result == null ? '' : String(result);
  return r.length > cap ? r.slice(0, cap) + '…' : r;
}

function renderEntry(i, row, cap) {
  return (
    `[${i}] ${tagMarker(row.tag)} (${row.provider})\n` +
    `Task: ${row.task}\n` +
    `Result: ${truncate(row.result, cap)}`
  );
}

function renderBlock(rows, cap) {
  const entries = rows.map((r, idx) => renderEntry(idx + 1, r, cap));
  return HEADER + entries.join('\n\n') + '\n</past_work>';
}

const estimateTokens = (s) => Math.ceil(s.length / 4);

// rows: FTS-ranked past delegations (already limited). Returns the prompt to
// send AND the byte-for-byte context_injected (identical when matches exist).
// No matches -> raw task, context_injected NULL (PRD gate 4 over the template's
// looser "Current task:" wording).
export function buildPrompt(rows, userTask) {
  if (!rows || rows.length === 0) {
    return { prompt: userTask, contextInjected: null };
  }
  let entries = rows.slice(0, 3);
  let block = renderBlock(entries, RESULT_CAP);
  while (entries.length > 1 && estimateTokens(block) > BUDGET_TOKENS) {
    entries = entries.slice(0, entries.length - 1);
    block = renderBlock(entries, RESULT_CAP);
  }
  if (entries.length === 1 && estimateTokens(block) > BUDGET_TOKENS) {
    let cap = RESULT_CAP;
    while (cap > 0 && estimateTokens(block) > BUDGET_TOKENS) {
      cap = Math.floor(cap / 2);
      block = renderBlock(entries, cap);
    }
  }
  const prompt = `${block}\n\nCurrent task: ${userTask}`;
  return { prompt, contextInjected: prompt };
}
