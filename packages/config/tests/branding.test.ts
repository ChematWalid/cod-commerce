import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findBrandingViolations, type SourceFile } from '../gates/branding';

const repoRoot = resolve(__dirname, '../../..');
const fixtures = join(__dirname, 'fixtures/branding');
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage', 'cache']);
/** ADR 0007: the gate covers product code, not `packages/config` (it holds the checker itself). */
const PRODUCT_ROOTS = ['apps', 'plugins', 'packages/shared'] as const;

const collect = (root: string, dir: string): SourceFile[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : collect(root, path);
    return [{ path: relative(root, path), content: readFileSync(path, 'utf8') }];
  });

const filesUnder = (root: string, relativeDir: string): SourceFile[] =>
  existsSync(join(root, relativeDir)) ? collect(root, join(root, relativeDir)) : [];

describe('findBrandingViolations', () => {
  it('flags the brand name in any case, once per file', () => {
    const violations = findBrandingViolations(filesUnder(fixtures, 'dirty'));

    expect(violations).toHaveLength(2);
    expect(violations.join('\n')).toContain('dirty/upper.txt');
    expect(violations.join('\n')).toContain('dirty/lower.txt');
  });

  it('accepts neutral copy', () => {
    expect(findBrandingViolations(filesUnder(fixtures, 'clean'))).toEqual([]);
  });

  it('the product code is clean', () => {
    const files = PRODUCT_ROOTS.flatMap((dir) => filesUnder(repoRoot, dir));

    expect(files.some((file) => file.path.startsWith('packages/shared'))).toBe(true);
    expect(findBrandingViolations(files)).toEqual([]);
  });
});
