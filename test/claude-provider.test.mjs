import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { delegate } from '../scripts/lib/providers/claude.mjs';

const originalPath = process.env.PATH;
const tempDirs = [];

afterEach(() => {
  process.env.PATH = originalPath;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function installFakeClaude(source) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'metis-claude-provider-'));
  tempDirs.push(dir);
  const executable = path.join(dir, 'claude');
  writeFileSync(executable, `#!/usr/bin/env node\n${source}\n`);
  chmodSync(executable, 0o755);
  process.env.PATH = `${dir}${path.delimiter}${originalPath}`;
}

describe('Claude provider', () => {
  it('passes the prompt as one literal argument with coding permissions', async () => {
    installFakeClaude('process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    const prompt = 'fix "$(touch /tmp/metis-injected)" and `echo nope`\nthen test it';

    const result = await delegate({ prompt, signal: new AbortController().signal });

    assert.deepEqual(JSON.parse(result), [
      '-p',
      prompt,
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      'Bash,Read,Edit,Write,Grep,Glob',
    ]);
  });

  it('includes stderr and the exit code when Claude fails', async () => {
    installFakeClaude("process.stderr.write('permission denied'); process.exit(7);");

    await assert.rejects(
      delegate({ prompt: 'do work', signal: new AbortController().signal }),
      /claude exited 7: permission denied/
    );
  });

  it('terminates an in-flight Claude process when aborted', async () => {
    installFakeClaude("process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);");
    const controller = new AbortController();
    const pending = delegate({ prompt: 'do work', signal: controller.signal });

    controller.abort();

    await assert.rejects(pending, { name: 'AbortError' });
  });
});
