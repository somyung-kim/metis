import { spawn } from 'node:child_process';

export const name = 'claude';

// -p runs Claude non-interactively. acceptEdits plus the explicit coding-tool
// allowlist gives the subprocess the same working surface as the native Metis
// Claude subagent while preserving Claude Code's protected-path safeguards.
export async function delegate({ prompt, signal }) {
  if (signal?.aborted) return Promise.reject(new DOMException('delegation aborted', 'AbortError'));

  return new Promise((resolve, reject) => {
    const proc = spawn(
      'claude',
      [
        '-p',
        prompt,
        '--permission-mode',
        'acceptEdits',
        '--allowedTools',
        'Bash,Read,Edit,Write,Grep,Glob',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
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
      else if (code !== 0) reject(new Error(`claude exited ${code}: ${stderr}`));
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
