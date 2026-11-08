import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
