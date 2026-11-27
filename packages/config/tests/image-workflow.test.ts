import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Step {
  name?: string;
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
  env?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
}

const imageText = read('.github/workflows/image.yml');
const image = parse(imageText) as Workflow;
const ci = parse(read('.github/workflows/ci.yml')) as Workflow;
const browser = parse(read('.github/workflows/browser.yml')) as Workflow;
const uploadScript = read('scripts/ops/upload-static.sh');

const jobOf = (workflow: Workflow, name: string): Job => {
  const job = workflow.jobs[name];
  if (job === undefined) throw new Error(`job ${name} is missing`);
  return job;
};
const stepsOf = (job: Job): Step[] => job.steps ?? [];
const indexOf = (job: Job, needle: string): number =>
  stepsOf(job).findIndex((step) => (step.run ?? '').includes(needle));
const usesOf = (workflow: Workflow, prefix: string): string | undefined =>
  Object.values(workflow.jobs)
    .flatMap(stepsOf)
    .find((step) => step.uses?.startsWith(prefix))?.uses;

/** The guards every `workflow_run` consumer of this repo applies (D3505): a green push run of this repo's main/phase. */
const WORKFLOW_RUN_GUARDS = [
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.conclusion == 'success'",
  'github.event.workflow_run.head_repository.full_name == github.repository',
  "github.event.workflow_run.head_branch == 'main'",
  "startsWith(github.event.workflow_run.head_branch, 'phase/')",
];

describe('image.yml (D3505)', () => {
  const job = jobOf(image, 'image');

  it('runs after a completed CI run and by hand, never on a push or a pull request of its own', () => {
    expect(Object.keys(image.on).sort()).toEqual(['workflow_dispatch', 'workflow_run']);
    expect(image.on['workflow_run']).toEqual({ workflows: ['CI'], types: ['completed'] });
    expect(imageText).not.toMatch(/pull_request/);
  });

  it('builds only for a green CI push run of this repository on main or a phase branch', () => {
    for (const guard of WORKFLOW_RUN_GUARDS) expect(job.if).toContain(guard);
    expect(job.if).toContain("github.event_name == 'workflow_dispatch'");
  });

  it('reads the repository by default and gets package write access in the image job only', () => {
    expect(image.permissions).toEqual({ contents: 'read' });
    expect(job.permissions).toEqual({ contents: 'read', packages: 'write' });
  });

  it('checks out and tags the commit CI tested, without keeping the checkout token', () => {
    const checkout = stepsOf(job).find((step) => step.uses?.startsWith('actions/checkout@'));

    expect(job.env?.['COMMIT_SHA']).toBe('${{ github.event.workflow_run.head_sha || github.sha }}');
    expect(checkout?.uses).toBe(usesOf(ci, 'actions/checkout@'));
    expect(checkout?.with?.['ref']).toBe('${{ env.COMMIT_SHA }}');
    expect(String(checkout?.with?.['persist-credentials'])).toBe('false');
    expect(imageText).toContain('ghcr.io/${GITHUB_REPOSITORY_OWNER,,}/platform:${COMMIT_SHA}');
  });

  it('builds with the commit as deployment id and the CDN prefix as a build argument, and no secret', () => {
    const build = stepsOf(job)[indexOf(job, 'docker build')];

    expect(build?.run).toContain('--build-arg NEXT_DEPLOYMENT_ID="$COMMIT_SHA"');
    expect(build?.run).toContain('--build-arg STOREFRONT_ASSET_PREFIX="$STOREFRONT_ASSET_PREFIX"');
    expect(job.env?.['STOREFRONT_ASSET_PREFIX']).toBe('${{ vars.STOREFRONT_ASSET_PREFIX }}');
    expect(JSON.stringify(build)).not.toMatch(/secrets\./);
  });

  it('fails on a fixable high or critical vulnerability and on any secret, through the pinned trivy, before the push', () => {
    const vulns = indexOf(job, '--scanners vuln');
    const secrets = indexOf(job, '--scanners secret');
    const runOf = (index: number): string => stepsOf(job)[index]?.run ?? '';

    expect(runOf(vulns)).toMatch(
      /scripts\/ops\/tool\.sh trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1/,
    );
    expect(runOf(secrets)).toMatch(/scripts\/ops\/tool\.sh trivy image --scanners secret --exit-code 1/);
    expect(runOf(secrets)).not.toContain('--severity');
    expect(Math.max(vulns, secrets)).toBeLessThan(indexOf(job, 'docker push'));
    expect(Math.min(vulns, secrets)).toBeGreaterThan(indexOf(job, 'docker build'));
  });

  it('keeps a CycloneDX SBOM as an artifact, uploaded by the same pinned action as browser.yml', () => {
    const upload = stepsOf(job).find((step) => step.uses?.startsWith('actions/upload-artifact@'));

    expect(stepsOf(job)[indexOf(job, '--format cyclonedx')]?.run).toContain('--output sbom.cdx.json');
    expect(upload?.uses).toBe(usesOf(browser, 'actions/upload-artifact@'));
    expect(upload?.with?.['path']).toBe('sbom.cdx.json');
  });

  it('pushes with the job token on stdin, and only notes a refused push instead of failing', () => {
    const push = stepsOf(job)[indexOf(job, 'docker push')];

    expect(push?.env?.['GITHUB_TOKEN']).toBe('${{ secrets.GITHUB_TOKEN }}');
    expect(push?.run).toContain('docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin');
    expect(push?.run).toContain('::notice');
    expect(push?.run).not.toMatch(/-p\s|--password\s/);
  });

  it('puts the static files on the CDN bucket after the push, with R2 secrets only in that step', () => {
    const upload = stepsOf(job)[indexOf(job, 'scripts/ops/upload-static.sh')];
    const withSecrets = stepsOf(job).filter((step) => JSON.stringify(step).includes('secrets.R2_'));

    expect(indexOf(job, 'scripts/ops/upload-static.sh')).toBeGreaterThan(indexOf(job, 'docker push'));
    expect(withSecrets).toEqual([upload]);
    expect(Object.keys(upload?.env ?? {}).sort()).toEqual(
      ['IMAGE', 'R2_ACCESS_KEY_ID', 'R2_ACCOUNT_ID', 'R2_ASSETS_BUCKET', 'R2_SECRET_ACCESS_KEY'].sort(),
    );
  });

  it('uses no secret other than the job token and the R2 keys', () => {
    const names = [...imageText.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);

    expect(new Set(names)).toEqual(
      new Set(['GITHUB_TOKEN', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']),
    );
  });

  it('builds each commit once, never cancelling a build in flight', () => {
    expect(image.concurrency?.group).toBe('image-${{ github.event.workflow_run.head_sha || github.sha }}');
    expect(image.concurrency?.['cancel-in-progress']).toBe(false);
  });
});

describe('scripts/ops/upload-static.sh', () => {
  const run = (env: Record<string, string>) =>
    spawnSync('bash', [join(repoRoot, 'scripts/ops/upload-static.sh')], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: { PATH: process.env['PATH'] ?? '', ...env },
    });
  const credentials = {
    IMAGE: 'ghcr.io/example/platform:0123456789abcdef0123456789abcdef01234567',
    R2_ACCOUNT_ID: 'placeholder-account',
    R2_ACCESS_KEY_ID: 'placeholder-key-id',
    R2_SECRET_ACCESS_KEY: 'placeholder-secret',
    R2_ASSETS_BUCKET: 'assets-staging',
  };

  it('skips with a notice when the R2 secrets are absent', () => {
    const result = run({ IMAGE: credentials.IMAGE, STOREFRONT_ASSET_PREFIX: 'https://cdn.example.dz/sf' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice');
    expect(result.stdout).toContain('R2');
  });

  it('skips with a notice when the image was built without a CDN prefix', () => {
    const result = run({ ...credentials, STOREFRONT_ASSET_PREFIX: '' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice');
    expect(result.stdout).toContain('STOREFRONT_ASSET_PREFIX');
  });

  it('refuses a prefix that is not an https URL with a plain path', () => {
    const result = run({ ...credentials, STOREFRONT_ASSET_PREFIX: 'http://cdn.example.dz/sf?x=1' });

    expect(result.status).toBe(64);
    expect(result.stderr).toContain('STOREFRONT_ASSET_PREFIX');
  });

  it('copies the image static files to <prefix path>/_next/static, immutable, never deleting older ones', () => {
    expect(uploadScript).toContain('/app/apps/storefront/.next/standalone/apps/storefront/.next/static');
    expect(uploadScript).toContain('_next/static/');
    expect(uploadScript).toContain("--cache-control 'public, max-age=31536000, immutable'");
    expect(uploadScript).toContain('r2.cloudflarestorage.com');
    expect(uploadScript).not.toMatch(/--delete|aws s3 rm/);
  });

  it('never traces or prints its environment', () => {
    expect(uploadScript).toMatch(/^set -euo pipefail$/m);
    expect(uploadScript).not.toMatch(/^\s*set\s+-[a-z]*x/m);
    expect(uploadScript).not.toMatch(/\b(env|printenv)\s*$/m);
  });
});
