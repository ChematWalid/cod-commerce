import { beforeAll, describe, expect, it } from 'vitest';
import { PROCESS_ENV_READERS } from '../eslint/process-env.mjs';
import {
  CONFIG_LOAD_TIMEOUT_MS,
  eslintAsCi,
  lint,
  lintSource,
  lintWith,
  loadConfig,
  PLUGIN,
  repoRoot,
} from './lint-fixtures';

const RULE = 'cod-env/no-process-env';

/** Every shape that reads the environment without going through an env module. */
const READS = [
  ['a dotted read', 'process-env.ts.txt'],
  ['a bracket read', 'process-env-bracket.ts.txt'],
  ['the whole object passed on', 'process-env-passed.ts.txt'],
  ['a destructured read', 'process-env-destructured.ts.txt'],
  ['an import from node:process', 'process-env-imported.ts.txt'],
] as const;

/** One file of each guarded area that is not an env module. */
const GUARDED_FILES = [
  'apps/server/src/config/vendure-config.ts',
  'apps/server/src/roles/api.role.ts',
  'apps/storefront/src/tenancy/api-store-resolver.ts',
  'apps/storefront/cache/lazy-redis-client.ts',
  'apps/storefront/proxy.ts',
  'apps/storefront/app/page.tsx',
  `${PLUGIN}/infrastructure/x.adapter.ts`,
  `${PLUGIN}/application/x.service.ts`,
  `${PLUGIN}/x.plugin.ts`,
] as const;

/** Files outside the gate: tests, scripts and tool configs read the environment of the tool that runs them. */
const UNGUARDED_FILES = [
  'apps/server/tests/unit/x.test.ts',
  'apps/storefront/tests/smoke/x.smoke.test.ts',
  `${PLUGIN}/tests/integration/x.int.test.ts`,
  'apps/server/vite.config.mts',
  'apps/storefront/vitest.config.ts',
  'packages/config/gates/x.ts',
] as const;

describe('process.env is read only by the env modules (CLAUDE.md §3a.5)', () => {
  // Both linters load the root config on first use, which takes seconds on a busy machine: neither load may fall
  // inside a test's own timeout.
  beforeAll(async () => {
    await loadConfig();
    await eslintAsCi.calculateConfigForFile(`${repoRoot}/${PLUGIN}/domain/x.ts`);
  }, CONFIG_LOAD_TIMEOUT_MS);

  it.each(READS)('rejects %s in the server app', async (_name, fixture) => {
    expect(await lint(fixture, 'apps/server/src/config/vendure-config.ts')).toContain(RULE);
  });

  it.each(GUARDED_FILES)('rejects a read in %s', async (file) => {
    expect(await lint('process-env.ts.txt', file)).toContain(RULE);
  });

  it('rejects a read exactly as `pnpm lint` runs', async () => {
    expect(await lintWith(eslintAsCi, 'process-env.ts.txt', `${PLUGIN}/infrastructure/x.adapter.ts`)).toContain(RULE);
  });

  it('names the env modules a reader should use', async () => {
    // Arrange
    const filePath = `${repoRoot}/apps/server/src/config/vendure-config.ts`;

    // Act
    const [result] = await eslintAsCi.lintText('export const level = process.env.LOG_LEVEL;\n', { filePath });

    // Assert
    const message = result?.messages.find((candidate) => candidate.ruleId === RULE)?.message ?? '';
    expect(message).toContain('loadEnv');
    expect(message).toContain('loadStorefrontEnv');
  });

  it.each(Object.keys(PROCESS_ENV_READERS))('lets the listed reader %s read it', async (file) => {
    expect(await lint('process-env.ts.txt', file)).not.toContain(RULE);
  });

  it('lists a reason for every reader, and nothing but single files', () => {
    const entries = Object.entries(PROCESS_ENV_READERS);

    expect(entries.length).toBeGreaterThan(0);
    for (const [file, reason] of entries) {
      expect(file, file).not.toMatch(/[*{]/);
      expect(reason.length, file).toBeGreaterThan(20);
    }
  });

  it.each(UNGUARDED_FILES)('leaves %s outside the gate', async (file) => {
    expect(await lint('process-env.ts.txt', file)).not.toContain(RULE);
  });

  it('lets guarded code use the rest of `process` and an unrelated `env`', async () => {
    const source =
      'declare const options: { env: string };\nexport const pid = process.pid;\nexport const argument = process.argv[2];\nexport const name = options.env;\nprocess.exitCode = 1;\n';

    expect(await lintSource(source, 'apps/server/src/roles/api.role.ts')).not.toContain(RULE);
  });
});
