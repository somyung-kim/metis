import { spawn } from 'node:child_process';

export const name = 'codex';

// --sandbox workspace-write is required: `codex exec` defaults to a read-only
// sandbox, which would block code-editing delegations.
// stdin='ignore': when stdin is a non-TTY pipe, `codex exec` tries to read it as
// a <stdin> block and blocks forever on an unclosed pipe ("Reading additional
// input from stdin..."). /dev/null gives an immediate EOF so it proceeds.
export async function delegate({ prompt, signal }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', ['exec', prompt, '--sandbox', 'workspace-write'], {
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killTimer;

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) reject(new Error(`codex exited ${code}: ${stderr}`));
      else resolve(stdout);
    });

    // spawn({ signal }) sends SIGTERM on abort; escalate to SIGKILL after 5s
    // in case the process ignores SIGTERM.
    if (signal) {
      signal.addEventListener('abort', () => {
        killTimer = setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, { once: true });
    }
  });
}
