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

/** The command of a part that runs the whole integration suites of several packages, one after the other. */
export const groupedCommand = (names: readonly string[]): string =>
  `pnpm exec turbo run test:integration ${names.map((name) => `--filter=${name}`).join(' ')}`;

const SERVER = '@cod/server';
const AUTH = '@cod/plugin-auth';
const RBAC = '@cod/plugin-rbac';
/** The platform plugins of part `platform-1` (D118). */
const PLATFORM_1 = [
  '@cod/plugin-platform-jobs',
  '@cod/plugin-platform-partitions',
  '@cod/plugin-platform-outbox',
] as const;
/** The platform plugins of part `platform-2` (D118); webhooks and flags join it with their integration suites. */
const PLATFORM_2 = ['@cod/plugin-platform-secrets'] as const;
const othersExclusions = [SERVER, AUTH, RBAC, ...PLATFORM_1, ...PLATFORM_2]
  .map((name) => `--filter=!${name}`)
  .join(' ');

/** The parts of the matrix, in order (D51, D69, D118). */
export const EXPECTED_MATRIX_PARTS: readonly MatrixPart[] = [
  { part: 'others', command: `pnpm test:integration ${othersExclusions}` },
  { part: 'server-e2e', command: unshardedCommand(SERVER) },
  { part: 'auth-1', command: shardedCommand(AUTH, 1) },
  { part: 'auth-2', command: shardedCommand(AUTH, 2) },
  { part: 'rbac-1', command: shardedCommand(RBAC, 1) },
  { part: 'rbac-2', command: shardedCommand(RBAC, 2) },
  { part: 'platform-1', command: groupedCommand(PLATFORM_1) },
  { part: 'platform-2', command: groupedCommand(PLATFORM_2) },
];

/** True when an unsharded `turbo` part runs `name`'s suite, alone or grouped with other packages. */
const inUnshardedPart = (commands: readonly string[], name: string): boolean =>
  commands.some(
    (command) =>
      command.startsWith('pnpm exec turbo run test:integration ') &&
      !command.includes('--shard=') &&
      command.split(' ').includes(`--filter=${name}`),
  );

/** True when `commands` give `name` a part outside `others`: an unsharded one (alone or grouped), or both shards. */
export const hasOwnPart = (commands: readonly string[], name: string): boolean =>
  inUnshardedPart(commands, name) ||
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
