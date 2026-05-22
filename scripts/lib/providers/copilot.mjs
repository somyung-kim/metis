import { spawn } from 'node:child_process';

export const name = 'copilot';

// Requires: npm install -g @github/copilot  (installs the 'copilot' binary)
// Auth: ambient 'gh auth login' or GH_TOKEN env var.
// -p is the non-interactive flag; --silent strips UI metadata from stdout;
// --allow-all-tools enables automatic tool execution without interactive prompts.
// stdin='ignore': precaution against potential pipe-hang (same pattern as codex.mjs).
export async function delegate({ prompt, signal }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('copilot', ['-p', prompt, '--silent', '--allow-all-tools'], {
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
      if (code !== 0) reject(new Error(`copilot exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
  });
}
