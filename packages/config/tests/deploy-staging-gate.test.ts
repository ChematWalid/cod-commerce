import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/** Runs the gate step of deploy-staging.yml as GitHub would, against a recorded image-version artifact (D3523). */
interface Step {
  id?: string;
  run?: string;
}
interface Workflow {
  jobs: Record<string, { steps?: Step[] }>;
}

const repoRoot = resolve(__dirname, '../../..');
const deploy = parse(readFileSync(join(repoRoot, '.github/workflows/deploy-staging.yml'), 'utf8')) as Workflow;

describe('deploy-staging.yml gate script', () => {
  const script = deploy.jobs['gate']?.steps?.find((step) => step.id === 'gate')?.run ?? '';
  const SHA = '0123456789abcdef0123456789abcdef01234567';
  interface Recorded {
    sha?: string;
    branch?: string;
  }
  const runGate = (env: Record<string, string>, recorded?: Recorded) => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-'));
    try {
      if (recorded !== undefined) {
        mkdirSync(join(dir, 'image-version'));
        if (recorded.sha !== undefined) writeFileSync(join(dir, 'image-version/sha'), `${recorded.sha}\n`);
        if (recorded.branch !== undefined) writeFileSync(join(dir, 'image-version/branch'), `${recorded.branch}\n`);
      }
      const output = join(dir, 'output');
      writeFileSync(output, '');
      // The shell GitHub runs a `run:` step with.
      const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
        encoding: 'utf8',
        cwd: dir,
        env: { PATH: process.env['PATH'] ?? '', GITHUB_OUTPUT: output, ...env },
      });
      return { ...result, outputs: readFileSync(output, 'utf8') };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const chained = { EVENT_NAME: 'workflow_run', DISPATCH_VERSION: 'f'.repeat(40), STAGING_ENABLED: 'true' };

  it('deploys the commit the image run recorded, not the run head', () => {
    const result = runGate(chained, { sha: SHA, branch: 'phase/P3' });

    expect(result.status).toBe(0);
    expect(result.outputs).toContain(`version=${SHA}`);
    expect(result.outputs).toContain('enabled=true');
  });

  it('deploys a commit recorded from main', () => {
    const result = runGate(chained, { sha: SHA, branch: 'main' });

    expect(result.outputs).toContain('enabled=true');
  });

  it('skips with a notice when the image run left no version (its push was refused)', () => {
    const result = runGate(chained);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice');
    expect(result.outputs).toContain('enabled=false');
    expect(result.outputs).not.toContain('version=');
  });

  it('skips with a notice when the recorded branch is neither main nor a phase branch', () => {
    const result = runGate(chained, { sha: SHA, branch: 'feature/x' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice');
    expect(result.outputs).toContain('enabled=false');
    expect(result.outputs).not.toContain('version=');
  });

  it('fails on a recorded version that is not a full commit id', () => {
    const result = runGate(chained, { sha: 'main', branch: 'main' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error');
  });

  it('deploys a dispatched version without any artifact', () => {
    const result = runGate({ EVENT_NAME: 'workflow_dispatch', DISPATCH_VERSION: SHA, STAGING_ENABLED: 'true' });

    expect(result.outputs).toContain(`version=${SHA}`);
    expect(result.outputs).toContain('enabled=true');
  });

  it('skips with a notice until STAGING_ENABLED is true', () => {
    const result = runGate({ ...chained, STAGING_ENABLED: '' }, { sha: SHA, branch: 'main' });

    expect(result.stdout).toContain('STAGING_ENABLED');
    expect(result.outputs).toContain('enabled=false');
  });
});
