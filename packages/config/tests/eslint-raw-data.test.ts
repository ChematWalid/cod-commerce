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
  'destructured-manager.ts.txt',
  'repository-manager-query.ts.txt',
  'unnamed-manager-call.ts.txt',
] as const;
const RAW_DATA_IMPORTS = [
  ['DataSource', 'typeorm'],
  ['EntityManager', 'typeorm'],
  ['Connection', 'typeorm'],
  ['BaseEntity', 'typeorm'],
  ['getRepository', 'typeorm'],
  ['getManager', 'typeorm'],
  ['getConnection', 'typeorm'],
  ['getConnectionManager', 'typeorm'],
  ['createConnection', 'typeorm'],
  ['createQueryBuilder', 'typeorm'],
  ['getMongoRepository', 'typeorm'],
  ['getTreeRepository', 'typeorm'],
  ['getCustomRepository', 'typeorm'],
  ['InjectDataSource', '@nestjs/typeorm'],
  ['InjectRepository', '@nestjs/typeorm'],
  ['InjectEntityManager', '@nestjs/typeorm'],
  ['InjectConnection', '@nestjs/typeorm'],
  ['getDataSourceToken', '@nestjs/typeorm'],
  ['getRepositoryToken', '@nestjs/typeorm'],
  ['getEntityManagerToken', '@nestjs/typeorm'],
  ['getConnectionToken', '@nestjs/typeorm'],
  ['getCustomRepositoryToken', '@nestjs/typeorm'],
  ['TypeOrmModule', '@nestjs/typeorm'],
  ['Client', 'pg'],
  ['Pool', 'pg'],
] as const;
/** Import shapes that reach TypeORM, its Nest tokens or the `pg` driver around the named-import ban. */
const RAW_DATA_IMPORT_SOURCES = [
  "import { DataSource } from 'typeorm/data-source/DataSource';\nexport type Leaked = DataSource;\n",
  "import type { DataSource } from 'typeorm/data-source/DataSource';\nexport type Leaked = DataSource;\n",
  "import { DataSource } from 'typeorm/index';\nexport type Leaked = DataSource;\n",
  "import { DataSource } from 'typeorm/index.js';\nexport type Leaked = DataSource;\n",
  "import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';\nexport type Leaked = QueryDeepPartialEntity<object>;\n",
  "import orm from 'typeorm';\nexport const Leaked = orm.DataSource;\n",
  "import * as orm from 'typeorm';\nexport const Leaked = orm.DataSource;\n",
  "import pg from 'pg';\nexport const Leaked = pg.Client;\n",
  "import { Pool } from 'pg/lib/index.js';\nexport const Leaked = Pool;\n",
  "import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';\nexport const Leaked = TypeOrmModule;\n",
] as const;
const RAW_DATA_DYNAMIC_IMPORTS = ['typeorm', 'typeorm/data-source/DataSource', '@nestjs/typeorm', 'pg'] as const;
/** The imports adapters and the server config really use: entity decorators, operators and two type-only deep paths. */
const LEGITIMATE_IMPORT_SOURCES = [
  [
    "import { Column, Entity, In, type Repository } from 'typeorm';\nexport const used = [Column, Entity, In];\nexport type R = Repository<object>;\n",
    `${PLUGIN}/infrastructure/adapter.ts`,
  ],
  [
    "import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';\nexport type P = QueryDeepPartialEntity<object>;\n",
    `${PLUGIN}/infrastructure/adapter.ts`,
  ],
  [
    "import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';\nexport type O = PostgresConnectionOptions;\n",
    'apps/server/src/config/db.config.ts',
  ],
] as const;
const RAW_DATA_ALLOWED_FILES = [
  'plugins/tenancy/infrastructure/tenant-repository.ts',
  'plugins/tenancy/infrastructure/platform-store-lookup.ts',
  'plugins/tenancy/infrastructure/tenant-transaction.ts',
  'plugins/rbac/infrastructure/vendure-actor-directory.ts',
  'plugins/platform-partitions/infrastructure/postgres-partition-catalog.ts',
  'plugins/platform-outbox/infrastructure/outbox-partition-policies.ts',
  'plugins/platform-outbox/infrastructure/outbox-due-scan.ts',
  'plugins/platform-health/platform-health.plugin.ts',
  'plugins/platform-health/infrastructure/postgres.probe.ts',
  'plugins/platform-health/infrastructure/migrations.probe.ts',
  'apps/server/src/seed/ensure-algeria-zone.ts',
  'apps/server/src/seed/ensure-default-channel.ts',
  'apps/server/src/seed/ensure-zero-tax.ts',
  'apps/server/src/seed/seed-platform-defaults.ts',
  'apps/server/src/seed/seed-demo-businesses.ts',
  'apps/server/src/seed/seed-demo-members.ts',
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

  it.each(RAW_DATA_IMPORT_SOURCES)('bans the import shape %s', async (source) => {
    for (const path of [`${PLUGIN}/infrastructure/adapter.ts`, `${PLUGIN}/domain/y.ts`, 'apps/server/src/y.ts']) {
      expect(await lintSource(source, path)).toContain('no-restricted-imports');
    }
    expect(await lintSource(source, 'apps/server/src/roles/migrate.role.ts')).not.toContain('no-restricted-imports');
  });

  it.each(RAW_DATA_DYNAMIC_IMPORTS)('bans a dynamic import of %s', async (module) => {
    const source = `export const load = async (): Promise<unknown> => import('${module}');\n`;

    expect(await lintSource(source, `${PLUGIN}/infrastructure/adapter.ts`)).toContain('no-restricted-syntax');
    expect(await lintSource(source, 'apps/server/src/y.ts')).toContain('no-restricted-syntax');
    expect(await lintSource(source, RAW_DATA_ALLOWED_FILES[0])).not.toContain('no-restricted-syntax');
  });

  it.each(LEGITIMATE_IMPORT_SOURCES)('lets the legitimate import through: %s', async (source, path) => {
    expect(await lintSource(source, path)).not.toContain('no-restricted-imports');
  });

  it.each(['seed.types.ts', 'seed.constants.ts', 'ensure-available-languages.ts', 'new-seed.ts'])(
    'keeps the seed file %s under the gate: only the files that use raw access are allow-listed',
    async (file) => {
      expect(await lint('get-repository-with-context.ts.txt', `apps/server/src/seed/${file}`)).toContain(
        'no-restricted-syntax',
      );
    },
  );

  it.each([
    `${PLUGIN}/infrastructure/adapter.ts`,
    `${PLUGIN}/application/use-case.ts`,
    `${PLUGIN}/domain/rule.ts`,
    'apps/server/src/y.ts',
  ])('lets a property that is merely called manager through in %s', async (path) => {
    expect(await lint('role-manager.ts.txt', path)).not.toContain('no-restricted-syntax');
  });

  it.each(RAW_DATA_FIXTURES)('leaves @cod/shared outside the data access gate: %s', async (fixture) => {
    expect(await lint(fixture, 'packages/shared/src/x.ts')).not.toContain('no-restricted-syntax');
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

  it.each([`${PLUGIN}/dashboard/constants.ts`, `${PLUGIN}/dashboard/document-lang.ts`])(
    'keeps %s under the gate: a plugin entry point may re-export it',
    async (path) => {
      expect(await lint('get-repository.ts.txt', path)).toContain('no-restricted-syntax');
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
