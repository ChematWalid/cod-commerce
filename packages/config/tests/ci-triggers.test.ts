import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');

interface WorkflowTriggers {
  on: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean | string };
}

const ci = parse(readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')) as WorkflowTriggers;

describe('ci.yml triggers (ADR 0018)', () => {
  it('runs on every pull request and on pushes to main and the phase branches', () => {
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push']);
    expect(ci.on['pull_request']).toBeNull();
    expect(ci.on['push']).toEqual({ branches: ['main', 'phase/**'] });
  });

  it('cancels superseded pull-request runs only, so every push to a phase branch keeps its own result', () => {
    expect(ci.concurrency?.group).toBe('ci-${{ github.ref }}');
    expect(ci.concurrency?.['cancel-in-progress']).toBe("${{ github.event_name == 'pull_request' }}");
  });
});
