import { spawn } from 'node:child_process';

export const name = 'copilot';

// Requires: npm install -g @github/copilot  (installs the 'copilot' binary)
// Auth: ambient 'gh auth login' or GH_TOKEN env var.
// -p is the non-interactive flag; --silent strips UI metadata from stdout;
// --allow-all-tools enables automatic tool execution without interactive prompts.
// stdin='ignore': precaution against potential pipe-hang (same pattern as codex.mjs).
export async function delegate({ prompt, signal }) {
  if (signal?.aborted) return Promise.reject(new DOMException('delegation aborted', 'AbortError'));

  return new Promise((resolve, reject) => {
    // signal is handled manually (not passed to spawn) so the promise only settles
    // after the subprocess closes — preventing process.exit(1) from firing before
    // SIGKILL can escalate a subprocess that ignores SIGTERM.
    const proc = spawn('copilot', ['-p', prompt, '--silent', '--allow-all-tools'], {
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
      else if (code !== 0) reject(new Error(`copilot exited ${code}: ${stderr}`));
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
