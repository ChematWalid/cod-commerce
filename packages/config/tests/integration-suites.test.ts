import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_HEAVY_FILES } from './integration-matrix';

const repoRoot = resolve(__dirname, '../../..');
const WORKSPACE_ROOTS = ['apps', 'packages', 'plugins'] as const;
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.turbo', '.next', 'coverage']);
const SUITE_FILE = /[.](int|e2e)[.]test[.]ts$/;

interface Manifest {
  name: string;
  scripts?: Record<string, string>;
}

function hasSuiteFile(dir: string): boolean {
  return readdirSync(dir, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) return !SKIPPED_DIRS.has(entry.name) && hasSuiteFile(join(dir, entry.name));
    return entry.isFile() && SUITE_FILE.test(entry.name);
  });
}

function packagesWithIntegrationScript(): { name: string; dir: string }[] {
  return WORKSPACE_ROOTS.flatMap((root) => readdirSync(join(repoRoot, root)).map((name) => join(repoRoot, root, name)))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({ dir, manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest }))
    .filter(({ manifest }) => manifest.scripts?.['test:integration'] !== undefined)
    .map(({ dir, manifest }) => ({ name: manifest.name, dir }));
}

describe('integration suites', () => {
  it('gives every package with a test:integration script at least one integration test file', () => {
    // Arrange: vitest exits 1 on "No test files found", which turns the root `pnpm test:integration` and the CI
    // part `others` red; a package adds the script together with its first *.int.test.ts.
    const packages = packagesWithIntegrationScript();

    // Act
    const empty = packages.filter(({ dir }) => !hasSuiteFile(dir)).map(({ name }) => name);

    // Assert
    expect(packages.length).toBeGreaterThan(0);
    expect(empty).toEqual([]);
  });

  // A renamed file would leave CI part `catalog-1` with no test file and move its slow tests into `catalog-2`.
  it('names only existing catalog files in the catalog file-group part', () => {
    const missing = CATALOG_HEAVY_FILES.filter((file) => !existsSync(join(repoRoot, 'plugins/catalog', file)));

    expect(missing).toEqual([]);
  });
});
