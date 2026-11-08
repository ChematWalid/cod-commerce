import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { loadEnv } from '../../../apps/server/src/config/env';

const repoRoot = resolve(__dirname, '../../..');
const workflow = (name: string): Workflow =>
  parse(readFileSync(join(repoRoot, '.github/workflows', name), 'utf8')) as Workflow;

interface Step {
  name?: string;
  env?: Record<string, string>;
  run?: string;
}
interface Job {
  env?: Record<string, string>;
  steps: Step[];
}
interface Workflow {
  jobs: Record<string, Job>;
}

const jobOf = (file: string, name: string): Job => {
  const job = workflow(file).jobs[name];
  if (job === undefined) {
    throw new Error(`no job named ${name}`);
  }
  return job;
};

/**
 * The environment a step sees on a runner, which has no .env and no TZ of its own: the job env, the step env
 * and the `KEY=value` words in front of its command. Real `loadEnv` validates it, so a key added to the
 * schema later fails here instead of on a runner.
 */
function stepEnv(job: Job, stepName: string): Record<string, string> {
  const step = job.steps.find((candidate) => candidate.name === stepName);
  if (step?.run === undefined) {
    throw new Error(`no step named ${stepName}`);
  }
  const inline: Record<string, string> = {};
  for (const [, key, value] of step.run.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]*)=(\S+)/g)) {
    if (key !== undefined && value !== undefined) {
      inline[key] = value;
    }
  }
  return { ...job.env, ...step.env, ...inline };
}

describe('workflow steps that load the server config', () => {
  it('gives ci.yml "Build the dashboard" an env loadEnv accepts, TZ included', () => {
    const env = stepEnv(jobOf('ci.yml', 'build'), 'Build the dashboard');

    expect(env['TZ']).toBe('UTC');
    expect(() => loadEnv(env)).not.toThrow();
  });

  it('gives every browser.yml step that loads the config an env loadEnv accepts', () => {
    const job = jobOf('browser.yml', 'browser');

    for (const name of ['Build the dashboard', 'Migrate', 'Start the api']) {
      expect(() => loadEnv(stepEnv(job, name)), name).not.toThrow();
    }
  });
});
