import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findVendurePinViolations, type ManifestDeps } from '../gates/vendure-pins';

const repoRoot = resolve(__dirname, '../../..');
const pinFixtures = join(__dirname, 'fixtures/pins');
const WORKSPACE_GROUPS = ['apps', 'packages', 'plugins'] as const;
const MANIFEST = 'package.json';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const readManifest = (root: string, path: string): ManifestDeps => {
  const json = JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
  return {
    path: relative(root, path),
    deps: { ...json.dependencies, ...json.devDependencies, ...json.optionalDependencies },
  };
};

const subdirectories = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(dir, entry.name))
    : [];

const filesIn = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir) : []);

/** Manifests of a workspace laid out like the repo: the root plus `apps/*`, `packages/*`, `plugins/*`. */
const workspaceManifests = (root: string): ManifestDeps[] =>
  [root, ...WORKSPACE_GROUPS.flatMap((group) => subdirectories(join(root, group)))]
    .map((dir) => join(dir, MANIFEST))
    .filter((path) => existsSync(path))
    .map((path) => readManifest(root, path));

const checkWorkspace = (root: string): string[] =>
  findVendurePinViolations(workspaceManifests(root), filesIn(join(root, 'patches')));

describe('findVendurePinViolations', () => {
  it('reports two different @vendure versions', () => {
    expect(checkWorkspace(join(pinFixtures, 'mixed-versions'))).toEqual([expect.stringContaining('3.8.0')]);
  });

  it('reports a caret range', () => {
    expect(checkWorkspace(join(pinFixtures, 'caret-range'))).toEqual([expect.stringContaining('^3.8.1')]);
  });

  it('reports a @vendure patch file', () => {
    expect(checkWorkspace(join(pinFixtures, 'patch-file'))).toEqual([
      expect.stringContaining('@vendure__core@3.8.1.patch'),
    ]);
  });

  it('accepts one exact version shared by every manifest', () => {
    const manifests: ManifestDeps[] = [
      { path: 'apps/server/package.json', deps: { '@vendure/core': '3.8.1', typeorm: '0.3.31' } },
      { path: 'plugins/demo/package.json', deps: { '@vendure/testing': '3.8.1' } },
    ];

    expect(findVendurePinViolations(manifests, ['typeorm@0.3.31.patch'])).toEqual([]);
  });

  it('the workspace has one exact @vendure version and no patches', () => {
    expect(checkWorkspace(repoRoot)).toEqual([]);
  });
});
