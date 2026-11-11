import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PLUGIN_SUB_ENTRIES } from '../eslint/plugin-entry.mjs';
import { CONFIG_LOAD_TIMEOUT_MS, lintSource, loadConfig, repoRoot } from './lint-fixtures';

/** Where an app or a package could import a plugin from: production code and tests alike (CLAUDE.md §3a.2). */
const OUTSIDE_FILES = [
  'apps/server/tests/browser/x.browser.test.ts',
  'apps/server/src/x.ts',
  'apps/server/src/migrations/x.ts',
  'apps/storefront/src/x.tsx',
  'packages/shared/src/x.ts',
  'packages/config/tests/x.test.ts',
] as const;
const climb = (file: string): string => '../'.repeat(file.split('/').length - 1);

const importOf = (specifier: string): string => `import { X } from '${specifier}';\nexport const used = X;\n`;
/** Every syntax that names a module: static, type-only, re-export, `import()` and the `import('…')` type. */
const REACHES: readonly ((specifier: string) => string)[] = [
  importOf,
  (specifier) => `import type { X } from '${specifier}';\nexport type Used = X;\n`,
  (specifier) => `export { X } from '${specifier}';\n`,
  (specifier) => `export * from '${specifier}';\n`,
  (specifier) => `export const load = () => import('${specifier}');\n`,
  (specifier) => `export type Used = import('${specifier}').X;\n`,
];
const ENTRY_RULES = ['no-restricted-imports', 'no-restricted-syntax'];

const fires = async (source: string, file: string): Promise<boolean> =>
  (await lintSource(source, file)).some((ruleId) => ENTRY_RULES.includes(ruleId ?? ''));

const declaredSubEntries = (): string[] =>
  readdirSync(join(repoRoot, 'plugins')).flatMap((folder) => {
    const manifest = join(repoRoot, 'plugins', folder, 'package.json');
    if (!existsSync(manifest)) return [];
    const { name, exports: entries = {} } = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name: string;
      exports?: Record<string, unknown>;
    };
    return Object.keys(entries)
      .filter((entry) => entry !== '.')
      .map((entry) => `${name}/${entry.slice('./'.length)}`);
  });

describe('ESLint plugin entry gate: apps and packages import a plugin through its package entry only', () => {
  beforeAll(loadConfig, CONFIG_LOAD_TIMEOUT_MS);

  it.each(OUTSIDE_FILES)('rejects a relative path into a plugin from %s', async (file) => {
    expect(await fires(importOf(`${climb(file)}plugins/auth/dashboard/constants`), file)).toBe(true);
    expect(await fires(importOf(`${climb(file)}plugins/auth/index`), file)).toBe(true);
    expect(await fires(importOf(`${climb(file)}plugins/auth`), file)).toBe(true);
  });

  it.each(OUTSIDE_FILES)('rejects a deep package path of a plugin from %s', async (file) => {
    expect(await fires(importOf('@cod/plugin-auth/dashboard/constants'), file)).toBe(true);
    expect(await fires(importOf('@cod/plugin-merchant-shell/shell-api/internal'), file)).toBe(true);
    expect(await fires(importOf('@cod/plugin-tenancy/provisioning.ts'), file)).toBe(true);
  });

  it.each(REACHES)('rejects every import syntax: %s', async (reach) => {
    const file = 'apps/server/tests/browser/x.browser.test.ts';
    expect(await fires(reach('../../../../plugins/auth/dashboard/constants'), file)).toBe(true);
    expect(await fires(reach('@cod/plugin-auth/dashboard/constants'), file)).toBe(true);
    expect(await fires(reach('@cod/plugin-auth'), file)).toBe(false);
  });

  it('rejects a path that reaches the plugins folder by a detour', async () => {
    const file = 'apps/server/src/x.ts';
    expect(await fires(importOf('./../../../plugins/auth/index'), file)).toBe(true);
    expect(await fires(importOf('../../../packages/../plugins/auth/index'), file)).toBe(true);
  });

  it.each(OUTSIDE_FILES)('allows the package entry and the declared sub-entries from %s', async (file) => {
    for (const specifier of ['@cod/plugin-auth', ...PLUGIN_SUB_ENTRIES]) {
      expect(await fires(importOf(specifier), file)).toBe(false);
    }
  });

  it('leaves other relative imports alone, an app path from a package test included', async () => {
    expect(await fires(importOf('../../../apps/server/src/config/env'), 'packages/config/tests/x.test.ts')).toBe(false);
    expect(await fires(importOf('./plugins.config'), 'apps/server/src/config/x.ts')).toBe(false);
    expect(await fires(importOf('@cod/shared'), 'apps/server/src/x.ts')).toBe(false);
  });

  it('keeps the data access gate on the server app and the framework ban on @cod/shared', async () => {
    const typeorm = "import { DataSource } from 'typeorm';\nexport type Leaked = DataSource;\n";
    const nest = "import { Injectable } from '@nestjs/common';\nexport const leaked = Injectable;\n";
    expect(await lintSource(typeorm, 'apps/server/src/x.ts')).toContain('no-restricted-imports');
    expect(await lintSource(nest, 'packages/shared/src/x.ts')).toContain('no-restricted-imports');
    expect(await lintSource('export const load = () => import("./x");\n', 'packages/shared/src/y.ts')).toContain(
      'no-restricted-syntax',
    );
  });

  it('allows exactly the sub-entries the plugins declare in their package.json exports', () => {
    expect([...PLUGIN_SUB_ENTRIES].sort()).toEqual(declaredSubEntries().sort());
  });
});
