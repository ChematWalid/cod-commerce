import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from '../architecture/check';
import { BAD_FIXTURE_VIOLATIONS, describeViolations } from './arch-fixture-violations';

/** dependency-cruiser walks the whole fixture tree; 7 s was observed under load, past Vitest's 5 s default. */
const FULL_SCAN_TIMEOUT_MS = 60_000;
const repoRoot = resolve(__dirname, '../../..');
const fixturesArch = join(__dirname, 'fixtures/arch');
const FRAMEWORK_IN_NODE_MODULES = /node_modules\/@vendure\/core\//;
const existsInRepo = (dir: string): boolean => existsSync(join(repoRoot, dir));

describe('architecture rules', () => {
  it(
    'reports every forbidden dependency in the bad fixtures, type-only imports included',
    async () => {
      const bad = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins'] });

      expect(describeViolations(bad.violations)).toEqual(describeViolations(BAD_FIXTURE_VIOLATIONS));
      expect(bad.violations.map((violation) => violation.from)).not.toContain(
        'plugins/rbac/infrastructure/uses-provisioning-entry.ts',
      );
      expect(
        bad.violations.map((violation) => violation.from).filter((from) => from.startsWith('plugins/good/')),
      ).toEqual([]);
    },
    FULL_SCAN_TIMEOUT_MS,
  );

  it(
    'cruises a file whose name merely contains an excluded folder name',
    async () => {
      const bad = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins/bad'] });

      expect(bad.cruisedModules).toContain('plugins/bad/application/district-pricing.service.ts');
      expect(bad.violations).toContainEqual({
        rule: 'application-no-concretes',
        from: 'plugins/bad/application/district-pricing.service.ts',
        to: 'plugins/bad/infrastructure/adapter.ts',
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
    expect(bad.violations).toContainEqual({
      rule: 'production-no-tests',
      from: 'apps/bad/uses-plugin-tests.ts',
      to: 'plugins/good/tests/unit/helper.ts',
    });
  });

  it('accepts a plugin that follows the dependency direction', async () => {
    const good = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins/good'] });

    expect(good.violations).toEqual([]);
    expect(good.cruisedModules).toContain('plugins/good/dashboard/uses-shell-api.ts');
    // An entry point may re-export its dashboard's constants, and tests may import the entry point.
    expect(good.cruisedModules).toEqual(
      expect.arrayContaining([
        'plugins/good/index.ts',
        'plugins/good/dashboard/constants.ts',
        'plugins/good/tests/unit/helper.ts',
      ]),
    );
  });

  it('resolves package-name imports to the sources they name', async () => {
    const good = await checkArchitecture({ baseDir: fixturesArch, roots: ['plugins/good'] });

    expect(good.cruisedModules).toEqual(
      expect.arrayContaining([
        'plugins/good/api/uses-rbac-guard-package.ts',
        'plugins/good/dashboard/uses-shell-api-package.ts',
        'plugins/good/infrastructure/uses-tenancy-package.ts',
        'plugins/merchant-shell/dashboard/shell-api.ts',
        'plugins/rbac/guard.ts',
        'plugins/tenancy/index.ts',
      ]),
    );
    expect(good.cruisedModules.filter((module) => module.startsWith('@cod/'))).toEqual([]);
  });

  it(
    'finds no violation in the workspace',
    async () => {
      const real = await checkArchitecture({
        baseDir: repoRoot,
        roots: ['apps', 'packages', 'plugins'].filter(existsInRepo),
      });

      expect(describeViolations(real.violations)).toEqual([]);
      // The one unresolved workspace import is the fixture that is unresolvable on purpose.
      expect(real.cruisedModules.filter((module) => module.startsWith('@cod/'))).toEqual(['@cod/plugin-missing']);
      expect(real.cruisedModules).toContain('plugins/merchant-shell/dashboard/shell-api.ts');
      // Positive control: the purity rules can only match a framework module the cruise keeps in the graph.
      expect(real.cruisedModules.some((module) => FRAMEWORK_IN_NODE_MODULES.test(module))).toBe(true);
      expect(real.cruisedModules.some((module) => module.startsWith('packages/shared/src/'))).toBe(true);
      expect(real.cruisedModules.some((module) => module.startsWith('apps/server/src/'))).toBe(true);
      expect(real.cruisedModules).toEqual(
        expect.arrayContaining([
          'plugins/_template/domain/note.ts',
          'plugins/_template/infrastructure/typeorm-note.repository.ts',
        ]),
      );
    },
    FULL_SCAN_TIMEOUT_MS,
  );

  it('fails loudly when a root does not exist', async () => {
    await expect(checkArchitecture({ baseDir: fixturesArch, roots: ['missing'] })).rejects.toThrow();
  });
});
