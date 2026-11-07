import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { findVendurePinViolations } from '@cod/config/gates';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const serverRoot = join(__dirname, '../..');
const manifestPath = join(serverRoot, 'package.json');
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageJson;
const allDeps = (p: PackageJson): Record<string, string> => ({
  ...p.dependencies,
  ...p.devDependencies,
  ...p.optionalDependencies,
});
const deps = allDeps(pkg);

describe('server dependency pins', () => {
  it('pins bullmq exactly and installs that version', () => {
    expect(pkg.dependencies?.['bullmq']).toBe('5.81.5');
    const installed = createRequire(manifestPath)('bullmq/package.json') as { version: string };
    expect(installed.version).toBe(pkg.dependencies?.['bullmq']);
  });

  it('pins ioredis to an exact 5.x version', () => {
    expect(pkg.dependencies?.['ioredis']).toMatch(/^5\.\d+\.\d+$/);
  });

  it('has no Vendure pin violations and every @vendure/* is 3.8.1', () => {
    expect(findVendurePinViolations([{ path: 'apps/server/package.json', deps }], [])).toEqual([]);
    const vendure = Object.entries(deps).filter(([name]) => name.startsWith('@vendure/'));
    expect(vendure.length).toBeGreaterThan(0);
    for (const [, version] of vendure) expect(version).toBe('3.8.1');
  });

  it('uses no ^ or ~ ranges', () => {
    const ranged = Object.entries(deps).filter(([, v]) => v.startsWith('^') || v.startsWith('~'));
    expect(ranged).toEqual([]);
  });
});
