import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
interface TurboConfig {
  extends?: string[];
  tasks: Record<string, { outputs?: string[]; env?: string[] }>;
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
    expect(config.tasks['build']?.outputs).toEqual(['.next/**', '!.next/cache/**', 'cache/dist/**']);
  });

  it('the storefront build hash includes NEXT_DEPLOYMENT_ID', () => {
    // Strict env mode: without it a cache hit would replay a build made for another deployment id.
    expect(readJson('apps/storefront/turbo.json').tasks['build']?.env).toContain('NEXT_DEPLOYMENT_ID');
  });
});
