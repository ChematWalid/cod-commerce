import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowsDir = resolve(__dirname, '../../../.github/workflows');

interface Job {
  'timeout-minutes'?: number;
  steps?: { uses?: string }[];
}
interface Workflow {
  jobs: Record<string, Job>;
}

const workflowFiles = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
const readWorkflow = (file: string): Workflow => parse(readFileSync(join(workflowsDir, file), 'utf8')) as Workflow;

const isLocalAction = (uses: string): boolean => uses.startsWith('./');
const PINNED_TO_COMMIT = /@[0-9a-f]{40}$/;

describe('every workflow under .github/workflows', () => {
  it('finds the workflow files', () => {
    expect(workflowFiles).toEqual(expect.arrayContaining(['ci.yml', 'attribution.yml']));
  });

  it.each(workflowFiles)('%s pins every non-local action to a full commit SHA', (file) => {
    // A tag such as @v4 can be moved to other code; a 40-hex commit cannot.
    const unpinned = Object.values(readWorkflow(file).jobs)
      .flatMap((job) => job.steps ?? [])
      .map((step) => step.uses)
      .filter((uses): uses is string => uses !== undefined && !isLocalAction(uses))
      .filter((uses) => !PINNED_TO_COMMIT.test(uses));

    expect(unpinned).toEqual([]);
  });

  it.each(workflowFiles)('%s gives every job a timeout', (file) => {
    // Without one a hung job runs for GitHub's default of six hours.
    const withoutTimeout = Object.entries(readWorkflow(file).jobs)
      .filter(([, job]) => typeof job['timeout-minutes'] !== 'number')
      .map(([name]) => name);

    expect(withoutTimeout).toEqual([]);
  });
});
