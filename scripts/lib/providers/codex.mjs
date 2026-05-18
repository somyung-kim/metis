import { spawn } from 'node:child_process';

export const name = 'codex';

// --sandbox workspace-write is required: `codex exec` defaults to a read-only
// sandbox, which would block code-editing delegations.
export async function delegate({ prompt, signal }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', ['exec', prompt, '--sandbox', 'workspace-write'], { signal });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`codex exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
  });
}
