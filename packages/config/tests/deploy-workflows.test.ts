import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  name?: string;
  'continue-on-error'?: boolean;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}
interface Job {
  if?: string;
  permissions?: Record<string, string>;
  needs?: string | string[];
  environment?: string | { name?: string };
  outputs?: Record<string, string>;
  env?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
}

const deployText = read('.github/workflows/deploy-staging.yml');
const deploy = parse(deployText) as Workflow;
const restoreText = read('.github/workflows/restore-test.yml');
const restore = parse(restoreText) as Workflow;
const ci = parse(read('.github/workflows/ci.yml')) as Workflow;
const deployScript = read('scripts/ops/deploy-staging.sh');

const jobOf = (workflow: Workflow, name: string): Job => {
  const job = workflow.jobs[name];
  if (job === undefined) throw new Error(`job ${name} is missing`);
  return job;
};
const stepsOf = (job: Job): Step[] => job.steps ?? [];
const stepRunning = (job: Job, needle: string): Step | undefined =>
  stepsOf(job).find((step) => (step.run ?? '').includes(needle));
const ciCheckout = Object.values(ci.jobs)
  .flatMap(stepsOf)
  .find((step) => step.uses?.startsWith('actions/checkout@'))?.uses;
/** The secret names Kamal expands (.kamal/secrets.example), each a `staging` environment secret. */
const kamalSecrets = [...read('.kamal/secrets.example').matchAll(/^([A-Z][A-Z0-9_]*)=\$/gm)].map((m) => m[1] ?? '');

describe('deploy-staging.yml (D3505)', () => {
  const gate = jobOf(deploy, 'gate');
  const job = jobOf(deploy, 'deploy');
  const deployStep = stepRunning(job, 'scripts/ops/deploy-staging.sh');

  it('runs after a completed image run and by hand, never on a push or a pull request', () => {
    expect(Object.keys(deploy.on).sort()).toEqual(['workflow_dispatch', 'workflow_run']);
    expect(deploy.on['workflow_run']).toEqual({ workflows: ['image'], types: ['completed'] });
    expect(deployText).not.toMatch(/pull_request/);
  });

  it('deploys only a green image run of this repository, whether CI or a person started that run', () => {
    for (const guard of [
      "github.event.workflow_run.event == 'workflow_run'",
      "github.event.workflow_run.event == 'workflow_dispatch'",
      "github.event.workflow_run.conclusion == 'success'",
      'github.event.workflow_run.head_repository.full_name == github.repository',
    ]) {
      expect(gate.if).toContain(guard);
    }
    // image.yml is itself started by workflow_run, so the run never has event 'push' and its head_branch/head_sha
    // are the default branch's, not the commit it built (D3523).
    expect(gate.if).not.toContain("event == 'push'");
    expect(gate.if).not.toContain('head_branch');
    expect(deployText).not.toContain('workflow_run.head_sha');
  });

  it('reads the version image.yml recorded after its push, from that run, with read access to actions only', () => {
    const download = stepsOf(gate).find((step) => step.uses?.startsWith('actions/download-artifact@'));
    const steps = stepsOf(gate);

    expect(download?.uses).toMatch(/^actions\/download-artifact@[0-9a-f]{40}$/);
    expect(download?.if).toBe("github.event_name == 'workflow_run'");
    expect(download?.with).toEqual({
      name: 'image-version',
      path: 'image-version',
      'run-id': '${{ github.event.workflow_run.id }}',
      'github-token': '${{ github.token }}',
    });
    // A refused push leaves no artifact: the gate then skips with a notice instead of failing.
    expect(download?.['continue-on-error']).toBe(true);
    expect(steps.indexOf(download ?? {})).toBeLessThan(steps.findIndex((step) => step.id === 'gate'));
    expect(gate.permissions).toEqual({ actions: 'read' });
  });

  it('skips with a notice until the repository variable STAGING_ENABLED is true, without touching the environment', () => {
    const check = stepsOf(gate).find((step) => step.id === 'gate');

    expect(gate.environment).toBeUndefined();
    expect(check?.env?.['STAGING_ENABLED']).toBe('${{ vars.STAGING_ENABLED }}');
    expect(check?.run).toContain('::notice');
    expect(job.needs).toBe('gate');
    expect(job.if).toBe("needs.gate.outputs.enabled == 'true'");
  });

  it('checks out and deploys the version the gate picked, without keeping the checkout token', () => {
    const check = stepsOf(gate).find((step) => step.id === 'gate');
    const checkout = stepsOf(job).find((step) => step.uses?.startsWith('actions/checkout@'));

    expect(check?.env).toEqual({
      EVENT_NAME: '${{ github.event_name }}',
      DISPATCH_VERSION: '${{ inputs.version || github.sha }}',
      STAGING_ENABLED: '${{ vars.STAGING_ENABLED }}',
    });
    expect(job.env?.['VERSION']).toBe('${{ needs.gate.outputs.version }}');
    expect(checkout?.uses).toBe(ciCheckout);
    expect(checkout?.with?.['ref']).toBe('${{ env.VERSION }}');
    expect(String(checkout?.with?.['persist-credentials'])).toBe('false');
  });

  it('runs the deploy job in the staging environment, one deploy at a time, never cancelled midway', () => {
    expect(job.environment).toEqual({ name: 'staging' });
    expect(deploy.concurrency).toEqual({ group: 'deploy-staging', 'cancel-in-progress': false });
    expect(deploy.permissions).toEqual({ contents: 'read' });
  });

  it('loads the deploy key into an agent and trusts only the pinned host key', () => {
    const ssh = stepRunning(job, 'ssh-add');

    expect(ssh?.env?.['STAGING_SSH_PRIVATE_KEY']).toBe('${{ secrets.STAGING_SSH_PRIVATE_KEY }}');
    expect(ssh?.env?.['STAGING_SSH_KNOWN_HOSTS']).toBe('${{ vars.STAGING_SSH_KNOWN_HOSTS }}');
    expect(ssh?.run).toContain('known_hosts');
    expect(stepsOf(job).indexOf(ssh ?? {})).toBeLessThan(stepsOf(job).indexOf(deployStep ?? {}));
  });

  it('hands every Kamal secret to the deploy step only, by name', () => {
    for (const name of kamalSecrets) expect(deployStep?.env?.[name]).toBe(`\${{ secrets.${name} }}`);
    const stepsWithKamalSecrets = stepsOf(job).filter((step) =>
      kamalSecrets.some((name) => JSON.stringify(step.env ?? {}).includes(`secrets.${name}`)),
    );
    expect(stepsWithKamalSecrets).toEqual([deployStep]);
    expect(job.env ?? {}).not.toHaveProperty('TOOL_ENV');
    expect(JSON.stringify(job.env ?? {})).not.toMatch(/secrets\./);
  });

  it('hands the deploy step every variable config/deploy.staging.yml reads', () => {
    const staging = read('config/deploy.staging.yml');
    const fetched = [...staging.matchAll(/ENV\.fetch\("([A-Z0-9_]+)"/g)].map((m) => m[1] ?? '');

    for (const name of new Set([...fetched, 'KAMAL_REGISTRY_USERNAME', 'STAGING_SMOKE_HOSTS'])) {
      expect(deployStep?.env?.[name]).toBe(`\${{ vars.${name} }}`);
    }
  });
});

describe('scripts/ops/deploy-staging.sh', () => {
  const lines = deployScript.split('\n').filter((line) => !line.trimStart().startsWith('#'));
  const firstLine = (needle: string): number => lines.findIndex((line) => line.includes(needle));
  const run = (env: Record<string, string>) =>
    spawnSync('bash', [join(repoRoot, 'scripts/ops/deploy-staging.sh')], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: { PATH: process.env['PATH'] ?? '', ...env },
    });

  it('refuses a version that is not a full commit id before anything else', () => {
    const result = run({ VERSION: 'main', STAGING_HOST: '203.0.113.10', STAGING_SMOKE_HOSTS: 'demo.example.dz' });

    expect(result.status).toBe(64);
    expect(result.stderr).toContain('VERSION');
  });

  it('refuses to run without the smoke store hosts', () => {
    const result = run({ VERSION: '0123456789abcdef0123456789abcdef01234567', STAGING_HOST: '203.0.113.10' });

    expect(result.status).toBe(64);
    expect(result.stderr).toContain('STAGING_SMOKE_HOSTS');
  });

  it('records the running version, deploys without pushing, then smokes and warms up, in that order', () => {
    const order = [
      firstLine('app version'),
      firstLine('deploy --skip-push --version="$VERSION"'),
      firstLine('/api/readyz'),
      firstLine('ops/k6/smoke.js'),
      firstLine('scripts/ops/warm-up.sh'),
    ];

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('rolls back to the recorded version when the deploy, the smoke or the warm-up fails', () => {
    expect(deployScript).toMatch(/kamal rollback "\$previous"/);
    expect(deployScript).toMatch(/deploy --skip-push --version="\$VERSION" \|\| roll_back/);
    expect(deployScript).toMatch(/smoke \|\| roll_back/);
    expect(deployScript).toMatch(/warm_up \|\| roll_back/);
  });

  it('gives the Kamal secrets to Kamal only, never to k6 or the warm-up', () => {
    expect(deployScript).toMatch(/TOOL_ENV="\$kamal_env" scripts\/ops\/tool\.sh kamal/);
    expect(deployScript).not.toMatch(/^\s*export\s+TOOL_ENV/m);
    expect(deployScript).toContain('.kamal/secrets.example');
  });

  it('reaches the node through an SSH tunnel with the store host in Host, never through the edge (D3515)', () => {
    expect(deployScript).toMatch(/ssh [^\n]*-o StrictHostKeyChecking=yes[^\n]*-L /);
    expect(deployScript).toContain('WARMUP_ORIGIN="$ORIGIN"');
    expect(deployScript).toMatch(/-e ORIGIN="\$ORIGIN" -e STORE_HOST="\$host"/);
  });

  it('never traces or prints its environment', () => {
    expect(deployScript).toMatch(/^set -euo pipefail$/m);
    expect(deployScript).not.toMatch(/^\s*set\s+-[a-z]*x/m);
    expect(deployScript).not.toMatch(/\b(env|printenv)\s*$/m);
  });
});

describe('restore-test.yml (D3507)', () => {
  const job = jobOf(restore, 'restore-test');

  it('runs monthly and by hand only', () => {
    expect(Object.keys(restore.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(restore.on['schedule']).toEqual([{ cron: '0 3 1 * *' }]);
  });

  it('runs the synthetic container restore test only: no secret ever reaches a GitHub runner', () => {
    expect(restoreText).not.toMatch(/secrets\./);
    expect(restore.permissions).toEqual({ contents: 'read' });
    expect(stepRunning(job, 'cp .env.example .env')).toBeDefined();
    expect(stepRunning(job, 'bash scripts/ops/restore-test.sh')?.env?.['RESTORE_APP_IMAGE']).toBe(
      'cod-platform:restore-test',
    );
  });

  it('builds the role image it restores with, before the test', () => {
    const steps = stepsOf(job);
    const build = steps.findIndex((step) => (step.run ?? '').includes('docker build -t cod-platform:restore-test'));

    expect(build).toBeGreaterThanOrEqual(0);
    expect(build).toBeLessThan(steps.findIndex((step) => (step.run ?? '').includes('restore-test.sh')));
  });

  it('keeps the report as an artifact even when the test fails', () => {
    const upload = stepsOf(job).find((step) => step.uses?.startsWith('actions/upload-artifact@'));

    expect(upload?.if).toBe('always()');
    expect(upload?.with?.['path']).toBe('docs/evidence/P3.S5a/restore-test.md');
  });
});
