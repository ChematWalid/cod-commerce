import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findForbiddenSql, scanTenantSql } from '../gates/tenant-sql';

const repoRoot = resolve(__dirname, '../../..');
const fixtures = join(__dirname, 'fixtures/tenant-sql');
const rulesFor = (fixture: string): string[] =>
  findForbiddenSql(fixture, readFileSync(join(fixtures, fixture), 'utf8')).map((violation) => violation.rule);

describe('tenant SQL gate', () => {
  it.each([
    ['plain-set.ts.txt', 'session-set'],
    ['session-set-template.ts.txt', 'session-set'],
    ['advisory-lock.ts.txt', 'session-advisory-lock'],
    ['listen.ts.txt', 'listen'],
    ['set-config-session.ts.txt', 'session-set-config'],
    ['set-config-nested-call.ts.txt', 'session-set-config'],
    ['set-role.ts.txt', 'session-set'],
    ['set-time-zone.ts.txt', 'session-set'],
    ['set-schema.ts.txt', 'session-set'],
    ['set-names.ts.txt', 'session-set'],
    ['comment-line-prefix.ts.txt', 'session-set'],
    ['comment-block-prefix.ts.txt', 'session-set'],
    ['set-mixed-case.ts.txt', 'session-set'],
    ['set-role-mixed-case.ts.txt', 'session-set'],
    ['temp-table.ts.txt', 'temporary-table'],
    ['temporary-table.ts.txt', 'temporary-table'],
    ['global-temp-table.ts.txt', 'temporary-table'],
    ['prepare.ts.txt', 'prepared-statement'],
    ['prepare-mixed-case.ts.txt', 'prepared-statement'],
    ['cursor-with-hold.ts.txt', 'cursor-with-hold'],
    ['listen-mixed-case.ts.txt', 'listen'],
  ])('fires on %s', (fixture, rule) => {
    expect(rulesFor(fixture)).toEqual([rule]);
  });

  it('lets transaction-scoped SQL and ordinary strings through', () => {
    expect(rulesFor('allowed.ts.txt')).toEqual([]);
  });

  it('reports the file and line of a violation', () => {
    const [violation] = findForbiddenSql('plugin.ts', "\nconst sql = 'SET app.business_id = 1';\n");

    expect(violation).toMatchObject({ file: 'plugin.ts', line: 2 });
  });

  it('finds no session-scoped SQL in plugins or the server', () => {
    expect(scanTenantSql(repoRoot)).toEqual([]);
  });
});

describe('tenant SQL gate: skipped folders', () => {
  const roots: string[] = [];
  const SESSION_SQL = "export const sql = 'SET app.business_id = 1';\n";

  /** A throwaway repository holding one session-SQL file at each path. */
  const repoWith = (paths: readonly string[]): string => {
    const root = mkdtempSync(join(tmpdir(), 'tenant-sql-'));
    roots.push(root);
    mkdirSync(join(root, 'apps/server/src'), { recursive: true });
    mkdirSync(join(root, 'plugins'), { recursive: true });
    for (const path of paths) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), SESSION_SQL);
    }
    return root;
  };

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("skips a plugin's own tests and dashboard folders", () => {
    const root = repoWith(['plugins/billing/tests/leak.int.test.ts', 'plugins/billing/dashboard/page.ts']);

    expect(scanTenantSql(root)).toEqual([]);
  });

  it('scans a folder named tests or dashboard deeper in a plugin', () => {
    const root = repoWith([
      'plugins/billing/infrastructure/tests/query.ts',
      'plugins/billing/application/dashboard/query.ts',
    ]);

    expect(scanTenantSql(root).map((violation) => violation.file)).toEqual([
      join('plugins/billing/application/dashboard/query.ts'),
      join('plugins/billing/infrastructure/tests/query.ts'),
    ]);
  });

  it('scans a folder named tests or dashboard in the server', () => {
    const root = repoWith(['apps/server/src/tests/query.ts', 'apps/server/src/dashboard/query.ts']);

    expect(scanTenantSql(root)).toHaveLength(2);
  });
});
