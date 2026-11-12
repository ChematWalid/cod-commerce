import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RULE = 'boundaries/no-unknown-files';
const CONFIG_LOAD_TIMEOUT_MS = 30_000;
const SOURCE = 'export const x = 1;\n';
const configModule = pathToFileURL(join(__dirname, '../eslint/index.mjs')).href;

/** #222: a checkout under `.claude/worktrees/<name>` has a dot segment in its absolute path. */
describe('boundaries under a checkout whose path has a dot segment', () => {
  let scratch = '';
  let checkout = '';
  let eslint: ESLint;

  beforeAll(() => {
    // The config's import.meta.dirname is a realpath, so the checkout must be one too where tmpdir is a symlink.
    scratch = realpathSync(mkdtempSync(join(tmpdir(), 'cod-dot-segment-')));
    checkout = join(scratch, '.claude', 'worktrees', 'x');
    mkdirSync(checkout, { recursive: true });
    writeFileSync(
      join(checkout, 'eslint.config.mjs'),
      `import { codEslintConfig } from '${configModule}';\nexport default codEslintConfig({ tsconfigRootDir: import.meta.dirname });\n`,
    );
    // The process cwd stays packages/config: only the lint root is the checkout, as in the repo's own tests.
    eslint = new ESLint({ cwd: checkout, ignore: false, overrideConfig: tseslint.configs.disableTypeChecked });
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  const rules = async (path: string): Promise<(string | null)[]> =>
    (await eslint.lintText(SOURCE, { filePath: join(checkout, path) })).flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    );

  it.each(['plugins/p/domain/x.ts', 'plugins/p/tests/unit/x.ts', 'plugins/p/index.ts'])(
    'does not report the known file %s as unknown',
    async (path) => {
      expect(await rules(path)).not.toContain(RULE);
    },
    CONFIG_LOAD_TIMEOUT_MS,
  );

  it(
    'still reports an unlisted file as unknown',
    async () => {
      expect(await rules('plugins/p/stray.ts')).toContain(RULE);
    },
    CONFIG_LOAD_TIMEOUT_MS,
  );
});
