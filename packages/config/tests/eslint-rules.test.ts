import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const lintFixtures = join(__dirname, 'fixtures/lint');
const archFixtures = join(__dirname, 'fixtures/arch/plugins');
const PLUGIN = 'plugins/__lint_fixture__';
const DASHBOARD_PAGE = `${PLUGIN}/dashboard/routes/page.tsx`;
const PLUGIN_LAYER_FILES = [
  `${PLUGIN}/domain/x.ts`,
  `${PLUGIN}/application/x.ts`,
  `${PLUGIN}/infrastructure/x.ts`,
  `${PLUGIN}/api/x.ts`,
  `${PLUGIN}/tests/x.ts`,
  DASHBOARD_PAGE,
] as const;
/** RF2: the same check on the real reference plugin, so a glob or ignore can never skip a real layer. */
const TEMPLATE_PLUGIN_FILES = [
  'plugins/_template/domain/note.ts',
  'plugins/_template/application/create-note.service.ts',
  'plugins/_template/infrastructure/typeorm-note.repository.ts',
  'plugins/_template/api/template-note.resolver.ts',
  'plugins/_template/dashboard/routes/notes-page.tsx',
  'plugins/_template/tests/unit/note-title.test.ts',
] as const;

/** Every shape that reaches a table without `TenantRepository` (CLAUDE.md §3a.9). */
const RAW_DATA_FIXTURES = [
  'get-repository.ts.txt',
  'get-repository-with-context.ts.txt',
  'raw-connection.ts.txt',
  'datasource-manager.ts.txt',
  'datasource-query.ts.txt',
  'datasource-query-constant.ts.txt',
  'datasource-query-builder.ts.txt',
  'datasource-query-runner.ts.txt',
  'get-entity-or-throw.ts.txt',
  'find-one-in-channel.ts.txt',
  'find-by-ids-in-channel.ts.txt',
  'destructured-raw-connection.ts.txt',
  'destructured-get-repository.ts.txt',
  'computed-raw-connection.ts.txt',
  'template-computed-raw-connection.ts.txt',
] as const;
const RAW_DATA_IMPORTS = [
  ['DataSource', 'typeorm'],
  ['EntityManager', 'typeorm'],
  ['Connection', 'typeorm'],
  ['InjectDataSource', '@nestjs/typeorm'],
  ['InjectRepository', '@nestjs/typeorm'],
  ['InjectEntityManager', '@nestjs/typeorm'],
  ['InjectConnection', '@nestjs/typeorm'],
] as const;
const RAW_DATA_ALLOWED_FILES = [
  'plugins/tenancy/infrastructure/tenant-repository.ts',
  'plugins/tenancy/infrastructure/platform-store-lookup.ts',
  'plugins/tenancy/infrastructure/tenant-transaction.ts',
  'plugins/rbac/infrastructure/vendure-actor-directory.ts',
  'plugins/platform-health/platform-health.plugin.ts',
  'plugins/platform-health/infrastructure/postgres.probe.ts',
  'plugins/platform-health/infrastructure/migrations.probe.ts',
  'apps/server/src/seed/ensure-zero-tax.ts',
  'apps/server/src/roles/migrate.role.ts',
] as const;

const typeCheckOff = tseslint.configs.disableTypeChecked;
/** Lints regardless of ignore patterns, like a file a developer opens in the editor. */
const eslint = new ESLint({ cwd: repoRoot, ignore: false, overrideConfig: typeCheckOff });
/** Lints exactly as `pnpm lint` does, ignore patterns included. */
const eslintAsCi = new ESLint({ cwd: repoRoot, overrideConfig: typeCheckOff });

/** Loading the root config imports eslint-config-next and its plugins, which takes seconds on a busy machine. */
const CONFIG_LOAD_TIMEOUT_MS = 30_000;

const read = (fixture: string): string => readFileSync(join(lintFixtures, fixture), 'utf8');

const ruleIds = (results: ESLint.LintResult[]): (string | null)[] =>
  results.flatMap((result) => result.messages.map((message) => message.ruleId));

const lintWith = async (linter: ESLint, fixture: string, virtualPath: string): Promise<(string | null)[]> =>
  ruleIds(await linter.lintText(read(fixture), { filePath: join(repoRoot, virtualPath) }));

const lint = (fixture: string, virtualPath: string): Promise<(string | null)[]> =>
  lintWith(eslint, fixture, virtualPath);

const lintSource = async (source: string, virtualPath: string): Promise<(string | null)[]> =>
  ruleIds(await eslint.lintText(source, { filePath: join(repoRoot, virtualPath) }));

describe('root ESLint config', () => {
  beforeAll(async () => {
    await eslint.calculateConfigForFile(join(repoRoot, `${PLUGIN}/domain/x.ts`));
  }, CONFIG_LOAD_TIMEOUT_MS);

  it('applies the Next.js rules to the storefront only', async () => {
    // Arrange
    const nextRule = '@next/next/no-html-link-for-pages';
    // Act
    const storefront = (await eslint.calculateConfigForFile(join(repoRoot, 'apps/storefront/app/layout.tsx'))) as {
      rules: Record<string, unknown>;
    };
    const plugin = (await eslint.calculateConfigForFile(join(repoRoot, DASHBOARD_PAGE))) as {
      rules: Record<string, unknown>;
    };
    // Assert
    expect(storefront.rules).toHaveProperty(nextRule);
    expect(plugin.rules).not.toHaveProperty(nextRule);
  });

  it('keeps domain code free of framework imports, type imports included', async () => {
    expect(await lint('vendure-in-domain.ts.txt', `${PLUGIN}/domain/rule.ts`)).toContain('no-restricted-imports');
    expect(await lint('type-import-in-domain.ts.txt', `${PLUGIN}/domain/rule.ts`)).toContain('no-restricted-imports');
    expect(await lint('vendure-in-domain.ts.txt', `${PLUGIN}/infrastructure/adapter.ts`)).not.toContain(
      'no-restricted-imports',
    );
  });

  it.each(['vendure-in-domain.ts.txt', 'typeorm-in-application.ts.txt', 'nest-in-application.ts.txt'])(
    'keeps application code free of framework imports: %s',
    async (fixture) => {
      expect(await lint(fixture, `${PLUGIN}/application/use-case.ts`)).toContain('no-restricted-imports');
    },
  );

  it.each(RAW_DATA_FIXTURES)('bans direct data access in infrastructure: %s', async (fixture) => {
    expect(await lint(fixture, `${PLUGIN}/infrastructure/adapter.ts`)).toContain('no-restricted-syntax');
  });

  it.each(RAW_DATA_FIXTURES)('bans direct data access in api: %s', async (fixture) => {
    expect(await lint(fixture, `${PLUGIN}/api/x.resolver.ts`)).toContain('no-restricted-syntax');
  });

  it.each([
    `${PLUGIN}/application/y.ts`,
    `${PLUGIN}/domain/y.ts`,
    `${PLUGIN}/x.plugin.ts`,
    `${PLUGIN}/index.ts`,
    'apps/server/src/y.ts',
    'apps/server/src/roles/api.role.ts',
  ])('bans direct data access in every guarded source: %s', async (path) => {
    expect(await lint('get-repository-with-context.ts.txt', path)).toContain('no-restricted-syntax');
  });

  it.each(RAW_DATA_IMPORTS)('bans importing %s from %s outside the allow-list', async (name, module) => {
    for (const keyword of ['import', 'import type']) {
      const source = `${keyword} { ${name} } from '${module}';\n\nexport type Leaked = typeof ${name};\n`;

      expect(await lintSource(source, `${PLUGIN}/infrastructure/adapter.ts`)).toContain('no-restricted-imports');
      expect(await lintSource(source, 'apps/server/src/y.ts')).toContain('no-restricted-imports');
      expect(await lintSource(source, RAW_DATA_ALLOWED_FILES[0])).not.toContain('no-restricted-imports');
    }
  });

  it.each(RAW_DATA_ALLOWED_FILES)('allows direct data access in %s', async (path) => {
    for (const fixture of RAW_DATA_FIXTURES) {
      expect(await lint(fixture, path)).not.toContain('no-restricted-syntax');
    }
  });

  it.each([`${PLUGIN}/tests/integration/x.test.ts`, DASHBOARD_PAGE, 'apps/server/src/migrations/1-init.ts'])(
    'leaves %s outside the data access gate',
    async (path) => {
      expect(await lint('get-repository.ts.txt', path)).not.toContain('no-restricted-syntax');
    },
  );

  it('lets an adapter declare entities and query through TenantRepository', async () => {
    const rules = await lint('tenant-repository-query.ts.txt', `${PLUGIN}/infrastructure/adapter.ts`);

    expect(rules).not.toContain('no-restricted-syntax');
    expect(rules).not.toContain('no-restricted-imports');
  });

  it.each([`${PLUGIN}/domain/rule.ts`, `${PLUGIN}/application/use-case.ts`])(
    'keeps the framework bans of %s beside the data access gate',
    async (path) => {
      expect(await lint('dynamic-import.ts.txt', path)).toContain('no-restricted-syntax');
      expect(await lint('nest-in-application.ts.txt', path)).toContain('no-restricted-imports');
    },
  );

  it('lets clean application code through', async () => {
    expect(await lint('clean-application.ts.txt', `${PLUGIN}/application/use-case.ts`)).not.toContain(
      'no-restricted-imports',
    );
  });

  it('limits function length in plugins and in @cod/shared', async () => {
    expect(await lint('long-function.ts.txt', `${PLUGIN}/application/x.ts`)).toContain('max-lines-per-function');
    expect(await lint('long-function.ts.txt', 'packages/shared/src/x.ts')).toContain('max-lines-per-function');
  });

  it('forbids explicit any', async () => {
    expect(await lint('explicit-any.ts.txt', `${PLUGIN}/domain/x.ts`)).toContain('@typescript-eslint/no-explicit-any');
  });

  it.each([...PLUGIN_LAYER_FILES, ...TEMPLATE_PLUGIN_FILES])('lints every layer of a plugin: %s', async (path) => {
    const absolute = join(repoRoot, path);
    const config = (await eslintAsCi.calculateConfigForFile(absolute)) as { rules?: Record<string, unknown> };

    expect(await eslintAsCi.isPathIgnored(absolute)).toBe(false);
    expect(config.rules?.['max-lines']).toBeDefined();
  });

  it.each(TEMPLATE_PLUGIN_FILES)(
    'keeps the RF2 template file %s in the repo, so the check above is not vacuous',
    (path) => {
      expect(existsSync(join(repoRoot, path))).toBe(true);
    },
  );

  it('lints every layer of a plugin: limits apply to dashboard .tsx files', async () => {
    expect(await lintWith(eslintAsCi, 'long-function.ts.txt', DASHBOARD_PAGE)).toContain('max-lines-per-function');
  });
});

describe('plugin layer boundaries', () => {
  const lintArch = async (pattern: string): Promise<ESLint.LintResult[]> =>
    eslint.lintFiles([join(archFixtures, pattern)]);

  it('reports imports against the dependency direction or into another plugin', async () => {
    const results = await lintArch('bad/**');
    const offenders = results
      .filter((result) => result.messages.some((message) => message.ruleId === 'boundaries/dependencies'))
      .map((result) => result.filePath.slice(archFixtures.length + 1))
      .sort();

    expect(offenders).toEqual(
      [
        'bad/api/uses-other-plugin.ts',
        'bad/api/uses-shell-api.ts',
        'bad/application/district-pricing.service.ts',
        'bad/application/uses-infrastructure.ts',
        'bad/application/uses-rate-limit-entry.ts',
        'bad/application/uses-tenancy-entry.ts',
        'bad/dashboard/uses-domain.ts',
        'bad/dashboard/uses-shell-internals.ts',
        'bad/domain/uses-application.ts',
        'bad/infrastructure/uses-provisioning-entry.ts',
      ].sort(),
    );
  });

  it('allows the dependency direction, including a dashboard importing the shell api of another plugin', async () => {
    const results = await lintArch('good/**');

    expect(results.length).toBeGreaterThan(0);
    expect(results.flatMap((result) => result.messages)).toEqual([]);
  });
});

describe('type-aware lint of plugin dashboards', () => {
  /** Type-aware, as `pnpm lint` runs, but without ignores: the fixtures are ignored by `pnpm lint`. */
  const typeAware = new ESLint({ cwd: repoRoot, ignore: false });
  const dashboardPage = join(archFixtures, 'good/dashboard/page.tsx');

  it('lints a dashboard .tsx with the types of its plugin dashboard tsconfig', async () => {
    const results = await typeAware.lintText(read('floating-promise.tsx.txt'), { filePath: dashboardPage });
    const messages = results.flatMap((result) => result.messages);

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toContain('@typescript-eslint/no-floating-promises');
  });
});
