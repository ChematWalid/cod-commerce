import { beforeAll, describe, expect, it } from 'vitest';
import { CONFIG_LOAD_TIMEOUT_MS, DASHBOARD_PAGE, lint, lintSource, loadConfig, PLUGIN } from './lint-fixtures';

/** Every shape that reaches a table without `TenantRepository` (CLAUDE.md §3a.9). */
const RAW_DATA_FIXTURES = [
  'get-repository.ts.txt',
  'get-repository-with-context.ts.txt',
  'raw-connection.ts.txt',
  'datasource-manager.ts.txt',
  'datasource-query.ts.txt',
  'datasource-query-constant.ts.txt',
  'datasource-query-builder.ts.txt',
  'datasource-query-runner.ts.txt',
  'get-entity-or-throw.ts.txt',
  'find-one-in-channel.ts.txt',
  'find-by-ids-in-channel.ts.txt',
  'destructured-raw-connection.ts.txt',
  'destructured-get-repository.ts.txt',
  'computed-raw-connection.ts.txt',
  'template-computed-raw-connection.ts.txt',
] as const;
const RAW_DATA_IMPORTS = [
  ['DataSource', 'typeorm'],
  ['EntityManager', 'typeorm'],
  ['Connection', 'typeorm'],
  ['InjectDataSource', '@nestjs/typeorm'],
  ['InjectRepository', '@nestjs/typeorm'],
  ['InjectEntityManager', '@nestjs/typeorm'],
  ['InjectConnection', '@nestjs/typeorm'],
] as const;
const RAW_DATA_ALLOWED_FILES = [
  'plugins/tenancy/infrastructure/tenant-repository.ts',
  'plugins/tenancy/infrastructure/platform-store-lookup.ts',
  'plugins/tenancy/infrastructure/tenant-transaction.ts',
  'plugins/rbac/infrastructure/vendure-actor-directory.ts',
  'plugins/platform-health/platform-health.plugin.ts',
  'plugins/platform-health/infrastructure/postgres.probe.ts',
  'plugins/platform-health/infrastructure/migrations.probe.ts',
  'apps/server/src/seed/ensure-zero-tax.ts',
  'apps/server/src/roles/migrate.role.ts',
] as const;

describe('data access gate (CLAUDE.md §3a.9)', () => {
  beforeAll(loadConfig, CONFIG_LOAD_TIMEOUT_MS);

  it.each(RAW_DATA_FIXTURES)('bans direct data access in infrastructure: %s', async (fixture) => {
    expect(await lint(fixture, `${PLUGIN}/infrastructure/adapter.ts`)).toContain('no-restricted-syntax');
  });

  it.each(RAW_DATA_FIXTURES)('bans direct data access in api: %s', async (fixture) => {
    expect(await lint(fixture, `${PLUGIN}/api/x.resolver.ts`)).toContain('no-restricted-syntax');
  });

  it.each([
    `${PLUGIN}/application/y.ts`,
    `${PLUGIN}/domain/y.ts`,
    `${PLUGIN}/x.plugin.ts`,
    `${PLUGIN}/index.ts`,
    'apps/server/src/y.ts',
    'apps/server/src/roles/api.role.ts',
  ])('bans direct data access in every guarded source: %s', async (path) => {
    expect(await lint('get-repository-with-context.ts.txt', path)).toContain('no-restricted-syntax');
  });

  it.each(RAW_DATA_IMPORTS)('bans importing %s from %s outside the allow-list', async (name, module) => {
    for (const keyword of ['import', 'import type']) {
      const source = `${keyword} { ${name} } from '${module}';\n\nexport type Leaked = typeof ${name};\n`;

      expect(await lintSource(source, `${PLUGIN}/infrastructure/adapter.ts`)).toContain('no-restricted-imports');
      expect(await lintSource(source, 'apps/server/src/y.ts')).toContain('no-restricted-imports');
      expect(await lintSource(source, RAW_DATA_ALLOWED_FILES[0])).not.toContain('no-restricted-imports');
    }
  });

  it.each(RAW_DATA_ALLOWED_FILES)('allows direct data access in %s', async (path) => {
    for (const fixture of RAW_DATA_FIXTURES) {
      expect(await lint(fixture, path)).not.toContain('no-restricted-syntax');
    }
  });

  it.each([`${PLUGIN}/tests/integration/x.test.ts`, DASHBOARD_PAGE, 'apps/server/src/migrations/1-init.ts'])(
    'leaves %s outside the data access gate',
    async (path) => {
      expect(await lint('get-repository.ts.txt', path)).not.toContain('no-restricted-syntax');
    },
  );

  it('lets an adapter declare entities and query through TenantRepository', async () => {
    const rules = await lint('tenant-repository-query.ts.txt', `${PLUGIN}/infrastructure/adapter.ts`);

    expect(rules).not.toContain('no-restricted-syntax');
    expect(rules).not.toContain('no-restricted-imports');
  });

  it.each([`${PLUGIN}/domain/rule.ts`, `${PLUGIN}/application/use-case.ts`])(
    'keeps the framework bans of %s beside the data access gate',
    async (path) => {
      expect(await lint('dynamic-import.ts.txt', path)).toContain('no-restricted-syntax');
      expect(await lint('nest-in-application.ts.txt', path)).toContain('no-restricted-imports');
    },
  );
});
