import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from '../architecture/check';

/** dependency-cruiser walks the whole fixture tree; 7 s was observed under load, past Vitest's 5 s default. */
const FULL_SCAN_TIMEOUT_MS = 60_000;
const repoRoot = resolve(__dirname, '../../..');
const fixturesArch = join(__dirname, 'fixtures/arch');
const existsInRepo = (dir: string): boolean => existsSync(join(repoRoot, dir));

describe('architecture rules', () => {
  it(
    'reports every forbidden dependency in the bad fixtures, type-only imports included',
    async () => {
      const bad = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins'] });

      expect(bad.violations.map((violation) => violation.rule).sort()).toEqual(
        [
          'application-no-concretes',
          'dashboard-no-plugin-core',
          'domain-is-pure',
          'domain-no-outer-layers',
          'no-cross-plugin-internals',
          'no-cross-plugin-internals',
          'no-cross-plugin-internals',
          'plugin-core-no-tenancy-entry',
          'plugin-core-no-tenancy-entry',
          'tenancy-provisioning-entry-restricted',
        ].sort(),
      );
      expect(bad.violations).toContainEqual({
        rule: 'plugin-core-no-tenancy-entry',
        from: 'plugins/bad/application/uses-tenancy-entry.ts',
        to: 'plugins/tenancy/index.ts',
      });
      expect(bad.violations).toContainEqual({
        rule: 'plugin-core-no-tenancy-entry',
        from: 'plugins/bad/application/uses-rate-limit-entry.ts',
        to: 'plugins/rate-limit/index.ts',
      });
      expect(bad.violations).toContainEqual({
        rule: 'tenancy-provisioning-entry-restricted',
        from: 'plugins/bad/infrastructure/uses-provisioning-entry.ts',
        to: 'plugins/tenancy/provisioning.ts',
      });
      expect(bad.violations.map((violation) => violation.from)).not.toContain(
        'plugins/rbac/infrastructure/uses-provisioning-entry.ts',
      );
      expect(bad.violations).toContainEqual({
        rule: 'dashboard-no-plugin-core',
        from: 'plugins/bad/dashboard/uses-domain.ts',
        to: 'plugins/bad/domain/clean.ts',
      });
      expect(bad.violations).toContainEqual({
        rule: 'no-cross-plugin-internals',
        from: 'plugins/bad/api/uses-shell-api.ts',
        to: 'plugins/merchant-shell/dashboard/shell-api.ts',
      });
      expect(bad.violations).toContainEqual({
        rule: 'no-cross-plugin-internals',
        from: 'plugins/bad/dashboard/uses-shell-internals.ts',
        to: 'plugins/merchant-shell/dashboard/internal.ts',
      });
      expect(bad.violations.map((violation) => violation.from)).not.toContain(
        'plugins/good/dashboard/uses-shell-api.ts',
      );
      expect(bad.violations).toContainEqual({
        rule: 'domain-is-pure',
        from: 'plugins/bad/domain/uses-vendure.ts',
        to: '@vendure/core',
      });
    },
    FULL_SCAN_TIMEOUT_MS,
  );

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
    expect(good.cruisedModules).toContain('plugins/good/dashboard/uses-shell-api.ts');
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
