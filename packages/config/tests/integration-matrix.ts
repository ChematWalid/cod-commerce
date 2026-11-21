import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One part of the CI integration matrix. */
export interface MatrixPart {
  part: string;
  command: string;
}

/** The command of shard `shard` of a package that has its own matrix parts. */
export const shardedCommand = (name: string, shard: number): string =>
  `pnpm exec turbo run test:integration --filter=${name} -- --shard=${String(shard)}/2`;

/** The command of a package that runs its whole integration suite in one part of its own. */
export const unshardedCommand = (name: string): string => `pnpm exec turbo run test:integration --filter=${name}`;

/** The command of the part that runs only `files` of a package's integration suite (vitest file filters). */
export const fileGroupCommand = (name: string, files: readonly string[]): string =>
  `pnpm exec turbo run test:integration --filter=${name} -- ${files.join(' ')}`;

/** The command of the part that runs every other file of the suite, so a new test file always lands in a part. */
export const restOfSuiteCommand = (name: string, files: readonly string[]): string =>
  `pnpm exec turbo run test:integration --filter=${name} -- ${files.map((file) => `--exclude=${file}`).join(' ')}`;

/**
 * The command of a part that runs the whole integration suites of several packages, one after the other:
 * `--concurrency=1`, because every plugin test server listens on Vendure's one default test port (EADDRINUSE).
 */
export const groupedCommand = (names: readonly string[]): string =>
  `pnpm exec turbo run test:integration --concurrency=1 ${names.map((name) => `--filter=${name}`).join(' ')}`;

const SERVER = '@cod/server';
const AUTH = '@cod/plugin-auth';
const RBAC = '@cod/plugin-rbac';
const TENANCY = '@cod/plugin-tenancy';
/** The catalog has parts of its own: `others` already uses most of its ten-minute budget (D2116). */
const CATALOG = '@cod/plugin-catalog';
/** Catalog-packs has a part of its own for the same reason (D2216). */
const CATALOG_PACKS = '@cod/plugin-catalog-packs';
/** Catalog-import too (D2216). */
const CATALOG_IMPORT = '@cod/plugin-catalog-import';
/**
 * The catalog files of part `catalog-1`; the rest run in `catalog-2`. The single catalog part took 9m37s, then overran
 * its ten-minute budget, and these two files are 279s of its 525s of tests. `--shard` cannot split them: they sort
 * next to each other by path hash, so its second shard would still hold 366s.
 */
export const CATALOG_HEAVY_FILES = [
  'tests/integration/permissions.int.test.ts',
  'tests/integration/isolation-sweep.int.test.ts',
] as const;
/** The packages whose suite runs as a file-group part plus a rest-of-suite part, with the group's files. */
const FILE_SPLITS: Readonly<Record<string, readonly string[]>> = { [CATALOG]: CATALOG_HEAVY_FILES };
/** The offers have a part of their own too: five Vendure test-server suites would overrun `others` (D2433). */
const OFFERS = '@cod/plugin-offers';
/** The platform plugins of part `platform-1` (D118). */
const PLATFORM_1 = [
  '@cod/plugin-platform-jobs',
  '@cod/plugin-platform-partitions',
  '@cod/plugin-platform-outbox',
] as const;
/** The platform plugins of part `platform-2` (D118). */
const PLATFORM_2 = [
  '@cod/plugin-platform-secrets',
  '@cod/plugin-platform-webhooks',
  '@cod/plugin-platform-flags',
] as const;
const othersExclusions = [
  SERVER,
  TENANCY,
  AUTH,
  RBAC,
  ...PLATFORM_1,
  ...PLATFORM_2,
  CATALOG,
  CATALOG_PACKS,
  CATALOG_IMPORT,
  OFFERS,
]
  .map((name) => `--filter=!${name}`)
  .join(' ');

/** The parts of the matrix, in order (D51, D69, D118, D2116, D2216, D2433). */
export const EXPECTED_MATRIX_PARTS: readonly MatrixPart[] = [
  { part: 'others', command: `pnpm test:integration ${othersExclusions}` },
  { part: 'server-e2e', command: unshardedCommand(SERVER) },
  { part: 'tenancy-1', command: shardedCommand(TENANCY, 1) },
  { part: 'tenancy-2', command: shardedCommand(TENANCY, 2) },
  { part: 'auth-1', command: shardedCommand(AUTH, 1) },
  { part: 'auth-2', command: shardedCommand(AUTH, 2) },
  { part: 'rbac-1', command: shardedCommand(RBAC, 1) },
  { part: 'rbac-2', command: shardedCommand(RBAC, 2) },
  { part: 'platform-1', command: groupedCommand(PLATFORM_1) },
  { part: 'platform-2', command: groupedCommand(PLATFORM_2) },
  { part: 'catalog-1', command: fileGroupCommand(CATALOG, CATALOG_HEAVY_FILES) },
  { part: 'catalog-2', command: restOfSuiteCommand(CATALOG, CATALOG_HEAVY_FILES) },
  { part: 'offers', command: unshardedCommand(OFFERS) },
  { part: 'catalog-packs', command: unshardedCommand(CATALOG_PACKS) },
  { part: 'catalog-import', command: unshardedCommand(CATALOG_IMPORT) },
];

/** True when a whole-suite `turbo` part runs `name`'s suite, alone or grouped: no shard and no file arguments. */
const inUnshardedPart = (commands: readonly string[], name: string): boolean =>
  commands.some(
    (command) =>
      command.startsWith('pnpm exec turbo run test:integration ') &&
      !command.includes(' -- ') &&
      command.split(' ').includes(`--filter=${name}`),
  );

/** True when `commands` hold both halves of `name`'s file split: its file group and the rest of its suite. */
const inFileSplitParts = (commands: readonly string[], name: string): boolean => {
  const files = FILE_SPLITS[name];
  if (files === undefined) return false;
  return [fileGroupCommand(name, files), restOfSuiteCommand(name, files)].every((part) => commands.includes(part));
};

/**
 * True when `commands` give `name` a part outside `others`: an unsharded one (alone or grouped), both shards, or both
 * halves of its file split.
 */
export const hasOwnPart = (commands: readonly string[], name: string): boolean =>
  inUnshardedPart(commands, name) ||
  inFileSplitParts(commands, name) ||
  [shardedCommand(name, 1), shardedCommand(name, 2)].every((shard) => commands.includes(shard));

/** The name of every workspace package with an integration suite. */
export function integrationPackages(repoRoot: string): string[] {
  return ['apps', 'packages', 'plugins']
    .flatMap((root) => readdirSync(join(repoRoot, root)).map((name) => join(repoRoot, root, name, 'package.json')))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, 'utf8')) as { name: string; scripts?: Record<string, string> })
    .filter((manifest) => manifest.scripts?.['test:integration'] !== undefined)
    .map((manifest) => manifest.name);
}
