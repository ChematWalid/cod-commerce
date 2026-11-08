import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from '../architecture/check';

const repoRoot = resolve(__dirname, '../../..');
const fixturesArch = join(__dirname, 'fixtures/arch');
const existsInRepo = (dir: string): boolean => existsSync(join(repoRoot, dir));

describe('architecture rules', () => {
  it('reports every forbidden dependency in the bad fixtures, type-only imports included', async () => {
    const bad = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins'] });

    expect(bad.violations.map((violation) => violation.rule).sort()).toEqual(
      ['application-no-concretes', 'domain-is-pure', 'domain-no-outer-layers', 'no-cross-plugin-internals'].sort(),
    );
    expect(bad.violations).toContainEqual({
      rule: 'domain-is-pure',
      from: 'plugins/bad/domain/uses-vendure.ts',
      to: '@vendure/core',
    });
  });

  it('reports an app that imports a plugin layer directly', async () => {
    const bad = await checkArchitecture({ baseDir: fixturesArch, roots: ['apps/bad'] });

    expect(bad.violations).toContainEqual({
      rule: 'apps-no-plugin-internals',
      from: 'apps/bad/uses-plugin-internals.ts',
      to: 'plugins/good/infrastructure/repo.ts',
    });
  });

  it('accepts a plugin that follows the dependency direction', async () => {
    const good = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins/good'] });

    expect(good.violations).toEqual([]);
    expect(good.cruisedModules.length).toBeGreaterThan(0);
  });

  it('finds no violation in the workspace', async () => {
    const real = await checkArchitecture({
      baseDir: repoRoot,
      roots: ['apps', 'packages', 'plugins'].filter(existsInRepo),
    });

    expect(real.violations).toEqual([]);
    expect(real.cruisedModules.some((module) => module.startsWith('packages/shared/src/'))).toBe(true);
    expect(real.cruisedModules.some((module) => module.startsWith('apps/server/src/'))).toBe(true);
    expect(real.cruisedModules).toEqual(
      expect.arrayContaining([
        'plugins/_template/domain/note.ts',
        'plugins/_template/infrastructure/typeorm-note.repository.ts',
      ]),
    );
  });

  it('fails loudly when a root does not exist', async () => {
    await expect(checkArchitecture({ baseDir: fixturesArch, roots: ['missing'] })).rejects.toThrow();
  });
});
