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
}
interface Job {
  needs?: string[];
  services?: Record<string, { image?: string }>;
  'timeout-minutes'?: number;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, Job>;
}
interface CompositeAction {
  runs: { steps: Step[] };
}

const ci = parse(read('.github/workflows/ci.yml')) as Workflow;
const browser = parse(read('.github/workflows/browser.yml')) as Workflow;
const compositeAction = parse(read('.github/actions/setup/action.yml')) as CompositeAction;

const jobOf = (workflow: Workflow, name: string): Job => {
  const job = workflow.jobs[name];
  if (job === undefined) throw new Error(`job ${name} is missing`);
  return job;
};

/** Every `uses:` of a workflow's jobs, plus those of the composite action its jobs call. */
const allUses = (workflow: Workflow, action: CompositeAction): string[] =>
  [...Object.values(workflow.jobs).flatMap((job) => job.steps ?? []), ...action.runs.steps]
    .map((step) => step.uses)
    .filter((uses): uses is string => uses !== undefined);

const stepsRun = (job: Job): string[] =>
  (job.steps ?? []).map((step) => step.run).filter((run): run is string => run !== undefined);

describe('browser.yml', () => {
  const job = jobOf(browser, 'browser');
  const runs = stepsRun(job);
  const index = (needle: string): number => (job.steps ?? []).findIndex((step) => step.run?.includes(needle));

  it('runs on push to main, nightly and by hand, never on pull requests (ADR 0001 section 6)', () => {
    expect(Object.keys(browser.on).sort()).toEqual(['push', 'schedule', 'workflow_dispatch']);
    expect(browser.on['push']).toEqual({ branches: ['main'] });
    expect(browser.on['schedule']).toEqual([{ cron: '0 2 * * *' }]);
    expect(read('.github/workflows/browser.yml')).not.toMatch(/pull_request/);
  });

  it('has the one browser job, with postgres and valkey service containers pinned like the integration job', () => {
    const integration = jobOf(ci, 'integration');

    expect(Object.keys(browser.jobs)).toEqual(['browser']);
    expect(Object.keys(job.services ?? {}).sort()).toEqual(['postgres', 'valkey']);
    expect(job.services?.['postgres']?.image).toBe(integration.services?.['postgres']?.image);
    expect(job.services?.['valkey']?.image).toBe(integration.services?.['valkey']?.image);
  });

  it('stays inside the ADR 0001 time budget', () => {
    expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
  });

  it('sets up, installs the browser, builds, migrates, starts the api, waits, tests, in that order', () => {
    const steps = job.steps ?? [];
    const order = [
      steps.findIndex((step) => step.uses === './.github/actions/setup'),
      index('playwright-core install --with-deps chromium-headless-shell'),
      index('pnpm build'),
      index('build:dashboard'),
      index('apps/server/dist/main-migrate.js'),
      index('setsid'),
      index('wait_http 200 http://localhost:3100/readyz'),
      index('pnpm --filter @cod/server test:browser'),
    ];

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('migrates as ROLE=migrate and serves the api on 3100, through the loopback services', () => {
    expect(runs.join('\n')).toMatch(
      /ROLE=migrate node --env-file-if-exists=\.env apps\/server\/dist\/main-migrate\.js/,
    );
    expect(runs.join('\n')).toMatch(/ROLE=api API_PORT=3100 setsid node [^\n]*apps\/server\/dist\/main-api\.js/);
    expect(runs.join('\n')).toMatch(/wait_http 200 http:\/\/localhost:3100\/dashboard\//);
  });

  it('uploads the screenshots even when the tests fail, by an action pinned by SHA', () => {
    const upload = (job.steps ?? []).find((step) => step.uses?.startsWith('actions/upload-artifact@'));

    expect(upload?.uses).toBe('actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9');
    expect(upload?.if).toBe('always()');
    expect(JSON.stringify(upload)).toContain('apps/server/test-results/*.png');
  });

  it('pins every action by commit SHA and uses no secrets', () => {
    for (const uses of allUses(browser, compositeAction)) {
      expect(uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$|^\.\//);
    }
    expect(read('.github/workflows/browser.yml')).not.toMatch(/secrets\./);
  });

  it('uses the same checkout SHA as ci.yml', () => {
    const checkout = (workflow: Workflow): string | undefined =>
      (jobOf(workflow, Object.keys(workflow.jobs)[0] ?? '').steps ?? []).find((step) =>
        step.uses?.startsWith('actions/checkout@'),
      )?.uses;

    expect(checkout(browser)).toBe(checkout(ci));
  });
});
