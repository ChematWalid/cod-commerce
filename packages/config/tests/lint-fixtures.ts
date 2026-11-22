import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

/** Shared by the ESLint config tests: the linters, and helpers that lint a fixture as if it lived at a repo path. */

export const repoRoot = resolve(__dirname, '../../..');
const lintFixtures = join(__dirname, 'fixtures/lint');
export const PLUGIN = 'plugins/__lint_fixture__';
export const DASHBOARD_PAGE = `${PLUGIN}/dashboard/routes/page.tsx`;

const typeCheckOff = tseslint.configs.disableTypeChecked;
/** Lints regardless of ignore patterns, like a file a developer opens in the editor. */
export const eslint = new ESLint({ cwd: repoRoot, ignore: false, overrideConfig: typeCheckOff });
/** Lints exactly as `pnpm lint` does, ignore patterns included. */
export const eslintAsCi = new ESLint({ cwd: repoRoot, overrideConfig: typeCheckOff });

/** Loading the root config imports eslint-config-next and its plugins, which takes seconds on a busy machine. */
export const CONFIG_LOAD_TIMEOUT_MS = 30_000;

/** Loads the root config once, so the first test of a file does not pay for it inside its own timeout. */
export const loadConfig = async (): Promise<void> => {
  await eslint.calculateConfigForFile(join(repoRoot, `${PLUGIN}/domain/x.ts`));
};

export const read = (fixture: string): string => readFileSync(join(lintFixtures, fixture), 'utf8');

const ruleIds = (results: ESLint.LintResult[]): (string | null)[] =>
  results.flatMap((result) => result.messages.map((message) => message.ruleId));

export const lintWith = async (linter: ESLint, fixture: string, virtualPath: string): Promise<(string | null)[]> =>
  ruleIds(await linter.lintText(read(fixture), { filePath: join(repoRoot, virtualPath) }));

export const lint = (fixture: string, virtualPath: string): Promise<(string | null)[]> =>
  lintWith(eslint, fixture, virtualPath);

export const lintSource = async (source: string, virtualPath: string): Promise<(string | null)[]> =>
  ruleIds(await eslint.lintText(source, { filePath: join(repoRoot, virtualPath) }));

/** Number conversions of an id, each of which loses digits past 2^53 (ADR 0003). */
export const ID_NUMBER_CONVERSIONS = [
  ['Number(orderId)', 'export const n = (orderId: string): number => Number(orderId);\n'],
  ['parseInt(storeId, 10)', 'export const n = (storeId: string): number => parseInt(storeId, 10);\n'],
  ['Number.parseInt(id)', 'export const n = (id: string): number => Number.parseInt(id);\n'],
  ['Number.parseFloat(row.id)', 'export const n = (row: { id: string }): number => Number.parseFloat(row.id);\n'],
  ['parseFloat(business_id)', 'export const n = (business_id: string): number => parseFloat(business_id);\n'],
  ['+productId', 'export const n = (productId: string): number => +productId;\n'],
  ['Number(input.variantId)', 'export const n = (input: { variantId: string }): number => Number(input.variantId);\n'],
] as const;
