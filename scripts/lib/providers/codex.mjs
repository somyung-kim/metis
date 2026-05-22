import { spawn } from 'node:child_process';

export const name = 'codex';

// --sandbox workspace-write is required: `codex exec` defaults to a read-only
// sandbox, which would block code-editing delegations.
// stdin='ignore': when stdin is a non-TTY pipe, `codex exec` tries to read it as
// a <stdin> block and blocks forever on an unclosed pipe ("Reading additional
// input from stdin..."). /dev/null gives an immediate EOF so it proceeds.
export async function delegate({ prompt, signal }) {
  if (signal?.aborted) return Promise.reject(new DOMException('delegation aborted', 'AbortError'));

  return new Promise((resolve, reject) => {
    // signal is handled manually (not passed to spawn) so the promise only settles
    // after the subprocess closes — preventing process.exit(1) from firing before
    // SIGKILL can escalate a subprocess that ignores SIGTERM.
    const proc = spawn('codex', ['exec', prompt, '--sandbox', 'workspace-write'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killTimer;
    let aborted = false;

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (aborted) reject(new DOMException('delegation aborted', 'AbortError'));
      else if (code !== 0) reject(new Error(`codex exited ${code}: ${stderr}`));
      else resolve(stdout);
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true;
        proc.kill('SIGTERM');
        killTimer = setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, { once: true });
    }
  });
}
