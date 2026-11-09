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

const AUTH = '@cod/plugin-auth';
const RBAC = '@cod/plugin-rbac';

/** The parts of the matrix, in order (D51, D69). */
export const EXPECTED_MATRIX_PARTS: readonly MatrixPart[] = [
  { part: 'others', command: `pnpm test:integration --filter=!${AUTH} --filter=!${RBAC}` },
  { part: 'auth-1', command: shardedCommand(AUTH, 1) },
  { part: 'auth-2', command: shardedCommand(AUTH, 2) },
  { part: 'rbac-1', command: shardedCommand(RBAC, 1) },
  { part: 'rbac-2', command: shardedCommand(RBAC, 2) },
];

/** The name of every workspace package with an integration suite. */
export function integrationPackages(repoRoot: string): string[] {
  return ['apps', 'packages', 'plugins']
    .flatMap((root) => readdirSync(join(repoRoot, root)).map((name) => join(repoRoot, root, name, 'package.json')))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, 'utf8')) as { name: string; scripts?: Record<string, string> })
    .filter((manifest) => manifest.scripts?.['test:integration'] !== undefined)
    .map((manifest) => manifest.name);
}
