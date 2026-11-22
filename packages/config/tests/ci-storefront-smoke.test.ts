import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { loadEnv } from '../../../apps/server/src/config/env';
import { loadStorefrontEnv, STOREFRONT_ENV_KEYS } from '../../../apps/storefront/src/config/storefront-env';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
}
interface Job {
  name?: string;
  env?: Record<string, string>;
  services?: Record<string, { image?: string }>;
  'timeout-minutes'?: number;
  steps?: Step[];
}
interface Workflow {
  jobs: Record<string, Job>;
}

const ci = parse(read('.github/workflows/ci.yml')) as Workflow;

const jobOf = (name: string): Job => {
  const job = ci.jobs[name];
  if (job === undefined) throw new Error(`job ${name} is missing`);
  return job;
};

const smoke = jobOf('storefront-smoke');
const steps = smoke.steps ?? [];
const index = (needle: string): number => steps.findIndex((step) => step.run?.includes(needle));
const stepNamed = (name: string): Step => {
  const step = steps.find((candidate) => candidate.name === name);
  if (step === undefined) throw new Error(`step ${name} is missing`);
  return step;
};

/** What a step sees on a runner: the job env, the step env and the `KEY=value` words in front of its command. */
function envOf(step: Step): Record<string, string> {
  const inline: Record<string, string> = {};
  for (const [, key, value] of (step.run ?? '').matchAll(/(?:^|\s)([A-Z][A-Z0-9_]*)=(\S+)/g)) {
    if (key !== undefined && value !== undefined) inline[key] = value;
  }
  return { ...smoke.env, ...step.env, ...inline };
}

describe('ci.yml storefront-smoke (#182)', () => {
  it('runs on pull requests inside the ADR 0001 budget, set up through the composite action', () => {
    expect(smoke.name).toBe('storefront-smoke');
    expect(smoke['timeout-minutes']).toBeLessThanOrEqual(10);
    expect(steps.map((step) => step.uses)).toContain('./.github/actions/setup');
  });

  it('runs on the integration images of postgres and valkey', () => {
    const integration = jobOf('integration').services ?? {};

    expect(Object.keys(smoke.services ?? {}).sort()).toEqual(['postgres', 'valkey']);
    expect(smoke.services?.['postgres']?.image).toBe(integration['postgres']?.image);
    expect(smoke.services?.['valkey']?.image).toBe(integration['valkey']?.image);
  });

  it('builds only the api and the storefront, migrates, seeds, starts api, worker and storefront, then smokes', () => {
    const order = [
      index('turbo run build --filter=@cod/server --filter=@cod/storefront'),
      index('apps/server/dist/main-migrate.js'),
      index('docker compose --env-file .env.example up -d --wait garage'),
      index('apps/server/dist/main-seed-demo.js'),
      index('wait_http 200 http://localhost:3100/readyz'),
      index('apps/server/dist/main-worker.js'),
      index('wait_http 200 http://127.0.0.1:3001/livez'),
      index('pnpm --filter @cod/storefront test:smoke'),
    ];

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('never runs the browser tests', () => {
    expect(steps.map((step) => step.run ?? '').join('\n')).not.toMatch(/test:browser|playwright/);
  });

  it('gives the build and the storefront the same commit-derived deployment id', () => {
    const build = steps.find((step) => step.run?.includes('turbo run build'));

    expect(build?.env?.['NEXT_DEPLOYMENT_ID']).toBe('ci-${{ github.sha }}');
    expect(stepNamed('Start the storefront').env?.['NEXT_DEPLOYMENT_ID']).toBe('ci-${{ github.sha }}');
  });

  it('gives the server steps an env loadEnv accepts', () => {
    for (const name of ['Migrate', 'Seed the demo businesses', 'Start the api']) {
      expect(() => loadEnv(envOf(stepNamed(name))), name).not.toThrow();
    }
  });

  it('gives the storefront every key it validates, on the localhost platform domain, and an env it accepts', () => {
    const env = envOf(stepNamed('Start the storefront'));

    expect(env['PLATFORM_DOMAIN']).toBe('localhost');
    expect(STOREFRONT_ENV_KEYS.filter((key) => !(key in env))).toEqual([]);
    expect(loadStorefrontEnv(env).platformDomain).toBe('localhost');
  });

  it('keeps every value a non-secret placeholder', () => {
    expect(read('.github/workflows/ci.yml')).not.toMatch(/secrets\./);
    expect(smoke.env?.['NEXT_SERVER_ACTIONS_ENCRYPTION_KEY']).toMatch(/^A+=$/);
  });

  it('shows the api, worker and storefront logs when a step fails', () => {
    const logs = steps.find((step) => step.run?.includes('tail -n 200 storefront.log'));

    expect(logs?.if).toBe('failure()');
    expect(logs?.run).toMatch(/api\.log[\s\S]*worker\.log/);
  });
});
