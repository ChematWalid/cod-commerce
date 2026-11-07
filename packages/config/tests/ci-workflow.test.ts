import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  uses?: string;
  run?: string;
  if?: string;
  shell?: string;
  'continue-on-error'?: boolean;
}
interface Job {
  name?: string;
  needs?: string[];
  if?: string;
  env?: Record<string, string>;
  services?: Record<string, { image?: string }>;
  'timeout-minutes'?: number;
  steps?: Step[];
}
interface Workflow {
  jobs: Record<string, Job>;
}
interface CompositeAction {
  runs: { steps: Step[] };
}

const ci = parse(read('.github/workflows/ci.yml')) as Workflow;
const compositeAction = parse(read('.github/actions/setup/action.yml')) as CompositeAction;

/** Every `uses:` of a workflow's jobs, plus those of the composite action its jobs call. */
const allUses = (workflow: Workflow, action: CompositeAction): string[] =>
  [...Object.values(workflow.jobs).flatMap((job) => job.steps ?? []), ...action.runs.steps]
    .map((step) => step.uses)
    .filter((uses): uses is string => uses !== undefined);

const jobOf = (workflow: Workflow, name: string): Job => {
  const job = workflow.jobs[name];
  if (job === undefined) throw new Error(`job ${name} is missing`);
  return job;
};

const stepsRun = (job: Job): string[] =>
  (job.steps ?? []).map((step) => step.run).filter((run): run is string => run !== undefined);

/** The shell of the gate job's verdict step. */
const gateScript = (workflow: Workflow): string => stepsRun(jobOf(workflow, 'build-test')).join('\n');

describe('ci.yml', () => {
  it('has the seven work jobs and the build-test gate', () => {
    expect(Object.keys(ci.jobs).sort()).toEqual([
      'build',
      'build-test',
      'data-services',
      'integration',
      'lint',
      'stack',
      'typecheck',
      'unit',
    ]);
  });

  it('keeps build-test as the required status check, depending on every other job', () => {
    const gate = jobOf(ci, 'build-test');

    expect(gate.name).toBe('build-test');
    expect([...(gate.needs ?? [])].sort()).toEqual([
      'build',
      'data-services',
      'integration',
      'lint',
      'stack',
      'typecheck',
      'unit',
    ]);
    expect(gate.if).toBe('always()');
    expect(gate.env?.['GH_TOKEN']).toBe('${{ github.token }}');
  });

  it('stays inside the ADR 0001 time budget', () => {
    for (const job of Object.values(ci.jobs)) expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
  });

  it('has no silent skips', () => {
    expect(read('.github/workflows/ci.yml')).not.toMatch(/--if-present|hashFiles\('package\.json'\)/);
  });

  it('pins every action by commit SHA', () => {
    for (const uses of allUses(ci, compositeAction)) {
      expect(uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$|^\.\//);
    }
  });

  it('runs lint with the architecture checks, uncached', () => {
    expect(stepsRun(jobOf(ci, 'lint'))).toEqual(expect.arrayContaining(['pnpm lint', 'pnpm run test:arch']));
  });

  it('checks the data services, then their portability', () => {
    expect(stepsRun(jobOf(ci, 'data-services')).join('\n')).toMatch(
      /check-data-services\.sh[\s\S]*check-compose-portability\.mjs/,
    );
  });

  it('starts only the data services by name, never the server image', () => {
    expect(stepsRun(jobOf(ci, 'data-services'))).toContain(
      'docker compose up -d --wait postgres pgbouncer valkey garage mailpit',
    );
  });

  it('builds the image and checks the single-VPS stack, then the bad-password variant', () => {
    const stack = jobOf(ci, 'stack');
    const runs = stepsRun(stack);

    expect(stack['timeout-minutes']).toBeLessThanOrEqual(10);
    expect(runs).toContain('cp .env.example .env');
    expect(runs).toContain('scripts/verify-stack.sh');
    expect(runs).toContain('scripts/verify-stack.sh --bad-password');
    expect(runs.indexOf('cp .env.example .env')).toBeLessThan(runs.indexOf('scripts/verify-stack.sh'));
    expect(runs.indexOf('scripts/verify-stack.sh')).toBeLessThan(
      runs.indexOf('scripts/verify-stack.sh --bad-password'),
    );
  });

  it('fails the gate unless every needed job succeeded', () => {
    expect(gateScript(ci)).toMatch(/!= "success"/);
  });

  it('uses no secrets', () => {
    expect(read('.github/workflows/ci.yml')).not.toMatch(/secrets\./);
    expect(read('.github/actions/setup/action.yml')).not.toMatch(/secrets\./);
  });

  it('pins each action to the exact SHA of the plan table', () => {
    const expected: Record<string, string> = {
      'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
      'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
      'pnpm/action-setup': '73e46992e05b19abd31f2f3c20e0e7370d762115',
      'actions/cache': '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
    };
    const remote = allUses(ci, compositeAction).filter((uses) => !uses.startsWith('./'));

    expect(remote.length).toBeGreaterThan(0);
    for (const uses of remote) {
      const [name = '', sha] = uses.split('@');
      expect(sha, name).toBe(expected[name]);
    }
  });

  it('sets every work job up through the composite action', () => {
    for (const name of ['lint', 'typecheck', 'unit', 'build', 'data-services', 'integration', 'stack']) {
      expect(
        jobOf(ci, name).steps?.map((step) => step.uses),
        name,
      ).toContain('./.github/actions/setup');
    }
  });

  it('installs dependencies before the data-services check scripts run', () => {
    const steps = jobOf(ci, 'data-services').steps ?? [];
    const setup = steps.findIndex((step) => step.uses === './.github/actions/setup');
    const check = steps.findIndex((step) => step.run?.includes('check-data-services.sh'));

    expect(setup).toBeGreaterThanOrEqual(0);
    expect(setup).toBeLessThan(check);
  });

  it('prints compose state and logs on failure, before the teardown', () => {
    const steps = jobOf(ci, 'data-services').steps ?? [];
    const logs = steps.findIndex((step) => step.run?.includes('docker compose logs'));
    const teardown = steps.findIndex((step) => step.run?.includes('down -v'));

    expect(logs).toBeGreaterThanOrEqual(0);
    expect(steps[logs]?.if).toBe('failure()');
    expect(steps[logs]?.run).toMatch(/docker compose ps/);
    expect(steps[logs]?.run).toMatch(/docker compose logs --no-color --tail=200/);
    expect(logs).toBeLessThan(teardown);
  });

  it('always tears the data services down', () => {
    const teardown = (jobOf(ci, 'data-services').steps ?? []).filter((step) => step.run?.includes('down -v'));

    expect(teardown).toHaveLength(1);
    expect(teardown[0]?.if).toBe('always()');
  });

  it('fails the data-services pipe when docker compose config fails', () => {
    const step = (jobOf(ci, 'data-services').steps ?? []).find((s) => s.run?.includes('check-compose-portability'));

    expect(step?.shell).toBe('bash');
    expect(step?.run).toMatch(/set -o pipefail/);
  });

  it('checks ignored builds through .modules.yaml, not command output', () => {
    const text = read('.github/actions/setup/action.yml');

    expect(text).toContain('.modules.yaml');
    expect(text).not.toMatch(/Cannot identify|pnpm ignored-builds/);
  });

  it('derives the gate verdict from needs.*.result', () => {
    const verdict = (jobOf(ci, 'build-test').steps ?? []).find((step) => step.run?.includes('!= "success"'));

    expect(JSON.stringify(verdict)).toContain('needs.*.result');
  });

  it('never lets the timing report fail the gate', () => {
    const timing = (jobOf(ci, 'build-test').steps ?? []).find((step) => step.run?.includes('GITHUB_STEP_SUMMARY'));

    expect(timing?.['continue-on-error']).toBe(true);
  });

  it('runs the integration tests against postgres and valkey service containers', () => {
    const integration = jobOf(ci, 'integration');
    const postgres = integration.services?.['postgres']?.image ?? '';

    expect(Object.keys(integration.services ?? {}).sort()).toEqual(['postgres', 'valkey']);
    expect(postgres).toMatch(/^postgres:17\.\d+@sha256:[0-9a-f]{64}$/);
    expect(stepsRun(integration)).toContain('pnpm test:integration');
  });

  it('uses the compose images for the CI service containers', () => {
    const compose = parse(read('docker-compose.yml')) as { services: Record<string, { image: string }> };
    const services = jobOf(ci, 'integration').services ?? {};

    expect(services['postgres']?.image).toBe(compose.services['postgres']?.image);
    expect(services['valkey']?.image).toBe(compose.services['valkey']?.image);
  });

  // A unix-socket check passes while the image's first-boot initdb server runs without TCP (R3-10).
  it('checks postgres health over TCP in compose and in the CI service container', () => {
    const compose = parse(read('docker-compose.yml')) as {
      services: Record<string, { healthcheck?: { test?: string[] } }>;
    };
    const services = jobOf(ci, 'integration').services as Record<string, { options?: string }> | undefined;

    expect(compose.services['postgres']?.healthcheck?.test?.join(' ')).toContain('pg_isready -h 127.0.0.1 -p 5432 ');
    expect(services?.['postgres']?.options).toContain('pg_isready -h 127.0.0.1 -p 5432 ');
  });

  it('leaves the attribution check unchanged', () => {
    const attribution = parse(read('.github/workflows/attribution.yml')) as Workflow;

    expect(jobOf(attribution, 'attribution-check').name).toBe('attribution-check');
  });
});
