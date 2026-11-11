import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
interface TurboConfig {
  extends?: string[];
  tasks: Record<string, TurboTask>;
}
interface TurboTask {
  outputs?: string[];
  env?: string[];
  inputs?: string[];
  dependsOn?: string[];
  cache?: boolean;
  persistent?: boolean;
}
const readJson = (path: string): TurboConfig => JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as TurboConfig;

describe('turbo build cache outputs', () => {
  it('root build outputs carry no negation (a negation applies to every package)', () => {
    // A root-wide `!dist/dashboard/**` dropped plugins/merchant-shell's
    // dist/dashboard/constants.js from the cache (CI run 42434692656).
    const outputs = readJson('turbo.json').tasks['build']?.outputs ?? [];
    expect(outputs).toContain('dist/**');
    expect(outputs.filter((o) => o.startsWith('!'))).toEqual([]);
  });

  it('the dashboard exclusion is scoped to the server package', () => {
    const outputs = readJson('apps/server/turbo.json').tasks['build']?.outputs ?? [];
    expect(outputs).toEqual(expect.arrayContaining(['dist/**', '!dist/dashboard/**']));
  });

  it('the storefront caches its next build and compiled cache handlers, without the build cache', () => {
    // A cache hit must restore everything `next start` and the image need (CI run 42434692656 restored an
    // incomplete build); .next/cache is Next's own build cache, large and not needed to run.
    const config = readJson('apps/storefront/turbo.json');
    expect(config.extends).toEqual(['//']);
    // .next/dev is next dev's own output, written into the same folder.
    expect(config.tasks['build']?.outputs).toEqual(['.next/**', '!.next/cache/**', '!.next/dev/**', 'cache/dist/**']);
  });

  it('the storefront build hash includes its git-ignored .env files', () => {
    // next build loads apps/storefront/.env*, which $TURBO_DEFAULT$ skips as git-ignored.
    expect(readJson('apps/storefront/turbo.json').tasks['build']?.inputs).toEqual(['$TURBO_DEFAULT$', '.env*']);
  });

  it('the storefront build hash includes NEXT_DEPLOYMENT_ID', () => {
    // Strict env mode: without it a cache hit would replay a build made for another deployment id.
    expect(readJson('apps/storefront/turbo.json').tasks['build']?.env).toContain('NEXT_DEPLOYMENT_ID');
  });

  it('the storefront dev task builds its workspace dependencies first', () => {
    // Turbopack bundles @cod/shared from its dist (it ignores the @cod/source condition), so a fresh clone's
    // root `pnpm dev` failed until packages/shared was built.
    expect(readJson('apps/storefront/turbo.json').tasks['dev']?.dependsOn).toEqual(['^build']);
  });
});

/** True when the task's hash folds in the workspace dependencies: a `^` entry of its own, or of a task it depends on. */
const hashesWorkspaceDependencies = (tasks: TurboConfig['tasks'], name: string, seen = new Set<string>()): boolean => {
  if (seen.has(name)) return false;
  seen.add(name);
  const dependsOn = tasks[name]?.dependsOn ?? [];
  return dependsOn.some((entry) => entry.startsWith('^') || hashesWorkspaceDependencies(tasks, entry, seen));
};

describe('turbo task cache keys', () => {
  const { tasks } = readJson('turbo.json');
  const isCached = (task: TurboTask): boolean => task.cache !== false && task.persistent !== true;
  const cachedTasks = Object.keys(tasks).filter((name) => {
    const task = tasks[name];
    return task !== undefined && isCached(task);
  });

  it('typecheck and test are cached, so their cache keys matter', () => {
    expect(cachedTasks).toEqual(expect.arrayContaining(['typecheck', 'test']));
  });

  it.each(cachedTasks)('the cached %s task hashes the workspace dependencies it reads from source', (name) => {
    // Packages resolve workspace dependencies to their source (the @cod/source condition), and turbo only folds a
    // dependency into a task hash through dependsOn. Without it a change in packages/shared replays a stale pass.
    expect(hashesWorkspaceDependencies(tasks, name)).toBe(true);
  });
});
