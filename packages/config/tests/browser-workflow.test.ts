import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  id?: string;
  'timeout-minutes'?: number;
  uses?: string;
  run?: string;
  if?: string;
  name?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}
interface MatrixPart {
  part: string;
  command: string;
}
interface Job {
  name?: string;
  env?: Record<string, string>;
  strategy?: { 'fail-fast'?: boolean; matrix?: { include?: MatrixPart[] } };
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

/** The dashboard browser suite takes about 7 minutes on one runner (measured 2026-11-10), so it runs in three parts. */
const DASHBOARD_SHARDS = 3;
const EXPECTED_BROWSER_PARTS: readonly MatrixPart[] = [
  ...Array.from({ length: DASHBOARD_SHARDS }, (_, index) => ({
    part: `dashboard-${String(index + 1)}`,
    command: `pnpm --filter @cod/server test:browser --shard=${String(index + 1)}/${String(DASHBOARD_SHARDS)}`,
  })),
  {
    part: 'storefront',
    command: 'pnpm --filter @cod/storefront test:smoke && pnpm --filter @cod/storefront test:browser',
  },
];

/** The `actions/cache` the composite setup action already pins: one version of it in the repository. */
const compositeCacheUses = (): string | undefined =>
  compositeAction.runs.steps.find((step) => step.uses?.startsWith('actions/cache@'))?.uses;

/** The three steps of the browser download (version, cache, install) and whether they run in that order. */
function playwrightSteps(job: Job): { version: Step; cache: Step; install: Step; order: boolean[] } {
  const steps = job.steps ?? [];
  const find = (match: (step: Step) => boolean): Step => {
    const step = steps.find(match);
    if (step === undefined) throw new Error('a Playwright step is missing');
    return step;
  };
  const version = find(
    (step) => (step.run ?? '').includes('playwright-core@') && (step.run ?? '').includes('pnpm-lock.yaml'),
  );
  const cache = find((step) => (step.uses ?? '').startsWith('actions/cache@'));
  const install = find((step) => (step.run ?? '').includes('playwright-core install chromium-headless-shell'));
  const order = [steps.indexOf(cache) > steps.indexOf(version), steps.indexOf(install) > steps.indexOf(cache)];
  return { version, cache, install, order };
}

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

  it('has the one browser job, with mailpit, postgres and valkey service containers, the last two pinned like the integration job', () => {
    const integration = jobOf(ci, 'integration');

    expect(Object.keys(browser.jobs)).toEqual(['browser']);
    expect(Object.keys(job.services ?? {}).sort()).toEqual(['mailpit', 'postgres', 'valkey']);
    expect(job.services?.['postgres']?.image).toBe(integration.services?.['postgres']?.image);
    expect(job.services?.['valkey']?.image).toBe(integration.services?.['valkey']?.image);
  });

  it('stays inside the ADR 0001 time budget', () => {
    expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
  });

  it('splits the tests into the dashboard shards and the storefront, each its own ten-minute part', () => {
    expect(job.strategy?.['fail-fast']).toBe(false);
    expect(job.strategy?.matrix?.include).toEqual(EXPECTED_BROWSER_PARTS);
    expect(job.name).toContain('${{ matrix.part }}');
    expect((job.steps ?? []).filter((step) => step.run === '${{ matrix.command }}')).toHaveLength(1);
  });

  it('sets up, installs the browser, builds, migrates, starts the api and the storefront, waits, tests, in that order', () => {
    const steps = job.steps ?? [];
    const order = [
      steps.findIndex((step) => step.uses === './.github/actions/setup'),
      index('playwright-core install chromium-headless-shell'),
      index('pnpm build'),
      index('build:dashboard'),
      index('apps/server/dist/main-migrate.js'),
      index('setsid'),
      index('wait_http 200 http://localhost:3100/readyz'),
      index('wait_http 200 http://127.0.0.1:3001/livez'),
      index('${{ matrix.command }}'),
    ];

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('caches the browser download by the locked playwright-core version, and installs it on a miss only (D119)', () => {
    const { version, cache, install, order } = playwrightSteps(job);

    expect(order).toEqual([true, true]);
    expect(cache.uses).toBe(compositeCacheUses());
    expect(cache.with?.['path']).toBe('~/.cache/ms-playwright');
    expect(cache.with?.['key']).toBe(`playwright-\${{ runner.os }}-\${{ steps.${version.id ?? ''}.outputs.version }}`);
    expect(install.if).toBe(`steps.${cache.id ?? ''}.outputs.cache-hit != 'true'`);
    expect(install['timeout-minutes']).toBe(5);
  });

  it('never installs the browser with system dependencies (D119)', () => {
    expect(runs.join('\n')).not.toMatch(/--with-deps|install-deps/);
  });

  it('gives the api the internal HMAC keys and an active kid that is one of them (D111)', () => {
    const keys = job.env?.['INTERNAL_HMAC_KEYS'] ?? '';

    expect(keys).toMatch(/^[a-z0-9-]{1,16}:.{32,}$/);
    expect(keys.split(',').map((entry) => entry.split(':')[0])).toContain(job.env?.['INTERNAL_HMAC_ACTIVE_KID']);
  });

  it('migrates as ROLE=migrate and serves the api on 3100, through the loopback services', () => {
    expect(runs.join('\n')).toMatch(
      /ROLE=migrate node --env-file-if-exists=\.env apps\/server\/dist\/main-migrate\.js/,
    );
    expect(runs.join('\n')).toMatch(/ROLE=api API_PORT=3100 setsid node [^\n]*apps\/server\/dist\/main-api\.js/);
    expect(runs.join('\n')).toMatch(/wait_http 200 http:\/\/localhost:3100\/dashboard\//);
  });

  it('starts the storefront detached on 3001 after the api, and waits for its /livez before testing it', () => {
    const start = index('@cod/storefront start');
    const wait = index('wait_http 200 http://127.0.0.1:3001/livez');

    expect(start).toBeGreaterThan(index('setsid node'));
    expect(runs.join('\n')).toMatch(/setsid pnpm --filter @cod\/storefront start > storefront\.log 2>&1 &/);
    expect(wait).toBeGreaterThanOrEqual(start);
    expect(wait).toBeLessThan(index('${{ matrix.command }}'));
  });

  it('gives the storefront the job valkey, the build deployment id and a non-secret environment', () => {
    const step = (job.steps ?? []).find((candidate) => candidate.run?.includes('@cod/storefront start'));
    const env = { ...job.env, ...step?.env };

    expect(env['REDIS_URL']).toBe('redis://localhost:6379');
    expect(env['APP_ENV']).toBe('development');
    expect(env['NEXT_DEPLOYMENT_ID']).toBe('ci-${{ github.sha }}');
    expect(env['NEXT_DEPLOYMENT_ID']).toBe(
      (job.steps ?? []).find((candidate) => candidate.run === 'pnpm build')?.env?.['NEXT_DEPLOYMENT_ID'],
    );
  });

  it('shows both server logs when a step fails', () => {
    const show = (job.steps ?? []).find((step) => step.if === 'failure()' && step.run?.includes('storefront.log'));

    expect(show?.run).toContain('tail -n 200 api.log');
    expect(show?.run).toContain('tail -n 200 storefront.log');
  });

  it('uploads the screenshots even when the tests fail, by an action pinned by SHA, one artifact per part', () => {
    const upload = (job.steps ?? []).find((step) => step.uses?.startsWith('actions/upload-artifact@'));

    expect(upload?.uses).toBe('actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9');
    expect(upload?.if).toBe('always()');
    expect(upload?.with?.['name']).toContain('${{ matrix.part }}');
    expect(upload?.with?.['path']).toContain('apps/server/test-results/*.png');
    expect(upload?.with?.['path']).toContain('apps/storefront/test-results/*.png');
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
