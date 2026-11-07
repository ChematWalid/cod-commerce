import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  uses?: string;
  run?: string;
}
interface Job {
  name?: string;
  needs?: string[];
  if?: string;
  env?: Record<string, string>;
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
  it('has the five work jobs and the build-test gate', () => {
    expect(Object.keys(ci.jobs).sort()).toEqual(['build', 'build-test', 'data-services', 'lint', 'typecheck', 'unit']);
  });

  it('keeps build-test as the required status check, depending on every other job', () => {
    const gate = jobOf(ci, 'build-test');

    expect(gate.name).toBe('build-test');
    expect([...(gate.needs ?? [])].sort()).toEqual(['build', 'data-services', 'lint', 'typecheck', 'unit']);
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

  it('fails the gate unless every needed job succeeded', () => {
    expect(gateScript(ci)).toMatch(/!= "success"/);
  });

  it('leaves the attribution check unchanged', () => {
    const attribution = parse(read('.github/workflows/attribution.yml')) as Workflow;

    expect(jobOf(attribution, 'attribution-check').name).toBe('attribution-check');
  });
});
