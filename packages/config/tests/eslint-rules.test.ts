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

  it.each(TEMPLATE_PLUGIN_FILES)('lints the real template plugin file %s', (path) => {
    expect(existsSync(join(repoRoot, path))).toBe(true);
  });

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
        'bad/application/uses-infrastructure.ts',
        'bad/domain/uses-application.ts',
      ].sort(),
    );
  });

  it('allows the dependency direction, including dashboard to domain', async () => {
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
