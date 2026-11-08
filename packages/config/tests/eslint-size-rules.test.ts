import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import { AT_LIMIT, OVER } from './lint-sources';

const repoRoot = resolve(__dirname, '../../..');
const lintFixtures = join(__dirname, 'fixtures/lint');
const PLUGIN = 'plugins/__lint_fixture__';
const CONFIG_LOAD_TIMEOUT_MS = 30_000;

/** Lints regardless of ignore patterns, like a file a developer opens in the editor. */
const eslint = new ESLint({ cwd: repoRoot, ignore: false, overrideConfig: tseslint.configs.disableTypeChecked });

const lintSource = async (source: string, virtualPath: string): Promise<(string | null)[]> =>
  (await eslint.lintText(source, { filePath: join(repoRoot, virtualPath) })).flatMap((result) =>
    result.messages.map((message) => message.ruleId),
  );

const lintFixture = (fixture: string, virtualPath: string): Promise<(string | null)[]> =>
  lintSource(readFileSync(join(lintFixtures, fixture), 'utf8'), virtualPath);

const PLUGIN_FILE = `${PLUGIN}/application/x.ts`;

describe('size and complexity rules fire on plugin files', () => {
  beforeAll(async () => {
    await eslint.calculateConfigForFile(join(repoRoot, PLUGIN_FILE));
  }, CONFIG_LOAD_TIMEOUT_MS);

  it.each([
    ['complexity', OVER.complexity, AT_LIMIT.complexity],
    ['max-depth', OVER.depth, AT_LIMIT.depth],
    ['max-params', OVER.params, AT_LIMIT.params],
  ])('%s fails over the limit and passes at it', async (rule, over, atLimit) => {
    expect(await lintSource(over, PLUGIN_FILE)).toContain(rule);
    expect(await lintSource(atLimit, PLUGIN_FILE)).not.toContain(rule);
  });
});

describe('@typescript-eslint/no-magic-numbers', () => {
  const RULE = '@typescript-eslint/no-magic-numbers';

  it.each(['domain', 'application'])('fires on a bare number in %s', async (layer) => {
    expect(await lintFixture('magic-number.ts.txt', `${PLUGIN}/${layer}/x.ts`)).toContain(RULE);
  });

  it('accepts a named constant and the ignored values 0, 1 and -1', async () => {
    expect(await lintFixture('named-constant.ts.txt', `${PLUGIN}/domain/x.ts`)).not.toContain(RULE);
  });

  it.each([
    `${PLUGIN}/domain/constants.ts`,
    `${PLUGIN}/domain/x.test.ts`,
    `${PLUGIN}/tests/unit/x.ts`,
    `${PLUGIN}/infrastructure/x.ts`,
  ])('does not apply to %s', async (path) => {
    expect(await lintFixture('magic-number.ts.txt', path)).not.toContain(RULE);
  });
});

describe('boundaries/no-unknown-files', () => {
  const RULE = 'boundaries/no-unknown-files';
  const SOURCE = 'export const x = 1;\n';

  it('fails a file in a folder that is not a plugin layer', async () => {
    expect(await lintSource(SOURCE, `${PLUGIN}/helpers/x.ts`)).toContain(RULE);
    expect(await lintSource(SOURCE, `${PLUGIN}/helpers/deep/x.ts`)).toContain(RULE);
  });

  it('fails an unlisted file at the plugin root', async () => {
    expect(await lintSource(SOURCE, `${PLUGIN}/stray.ts`)).toContain(RULE);
  });

  it.each([
    `${PLUGIN}/domain/x.ts`,
    `${PLUGIN}/domain/ports/x.port.ts`,
    `${PLUGIN}/application/ports/x.port.ts`,
    `${PLUGIN}/infrastructure/x.ts`,
    `${PLUGIN}/api/x.ts`,
    `${PLUGIN}/dashboard/routes/x.tsx`,
    `${PLUGIN}/tests/unit/x.ts`,
    `${PLUGIN}/tests/integration/x.ts`,
    `${PLUGIN}/tests/fakes/x.ts`,
    `${PLUGIN}/tests/contract/x.ts`,
    `${PLUGIN}/tests/setup-env.ts`,
    `${PLUGIN}/index.ts`,
    `${PLUGIN}/__lint_fixture__.plugin.ts`,
    `${PLUGIN}/vitest.config.ts`,
    `${PLUGIN}/vitest.integration.config.ts`,
  ])('passes the known file %s', async (path) => {
    expect(await lintSource(SOURCE, path)).not.toContain(RULE);
  });
});
