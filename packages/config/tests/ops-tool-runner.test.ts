import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const TOOL_SH = join(repoRoot, 'scripts/ops/tool.sh');
const script = readFileSync(TOOL_SH, 'utf8');

/** Every ops tool the P3.S5a plan names (D3503); each runs from one pinned image. */
const TOOLS = [
  'tofu',
  'kamal',
  'ansible-playbook',
  'ansible-lint',
  'ansible-vault',
  'k6',
  'trivy',
  'otelcol',
  'promtool',
  'actionlint',
  'shellcheck',
] as const;

/** `registry/name:exact-version@sha256:<64 hex>`: a moving tag alone could change under CI. */
const PINNED_REF = /^[a-z0-9./-]+:v?\d+\.\d+\.\d+(?:-[a-z0-9.]+)?@sha256:[0-9a-f]{64}$/;

const run = (...args: string[]) => spawnSync('bash', [TOOL_SH, ...args], { encoding: 'utf8', cwd: repoRoot });

describe('scripts/ops/tool.sh', () => {
  it.each(TOOLS)('pins %s to an exact version and digest', (tool) => {
    const result = run('image', tool);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(PINNED_REF);
  });

  it('never names a latest tag', () => {
    expect(script).not.toMatch(/:latest\b/);
  });

  it('refuses an unknown tool with a usage error', () => {
    const result = run('image', 'terraform');

    expect(result.status).toBe(64);
    expect(result.stderr).toContain('unknown tool');
  });

  it('never traces commands, so no passed-through secret reaches the log', () => {
    expect(script).not.toMatch(/^\s*set\s+-[a-z]*x/m);
    expect(script).toMatch(/^set -euo pipefail$/m);
  });

  it('hands kamal the caller known_hosts read-only, so a deploy refuses a server whose host key changed', () => {
    const kamalCase = script.split(/^ {2}kamal\)$/m)[1]?.split(/^ {4};;$/m)[0] ?? '';

    expect(kamalCase).toContain('"$HOME/.ssh/known_hosts:/tmp/.ssh/known_hosts:ro"');
  });

  it('passes environment variables by name only, never by value on the command line', () => {
    expect(script).not.toMatch(/-e\s+"?\$?[A-Z_]+=\$/);
  });
});
