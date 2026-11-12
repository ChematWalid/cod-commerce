import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TenancyPlugin, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  withPartitionedSchemas,
} from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { NoteEntity } from '../../infrastructure/note.entity';
import { TypeOrmNoteRepository } from '../../infrastructure/typeorm-note.repository';
import { TemplatePlugin } from '../../template.plugin';
import { describeNoteRepositoryContract } from '../contract/note-repository.contract';
import { TEST_REDIS_URL, testRateLimitPlugin } from './template-note-operations';

const LIST_INDEX_COLUMNS = '("businessId", "createdAt", id)';

const { server } = createPluginTestEnvironment({
  plugins: [
    testRateLimitPlugin(),
    TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1006 }),
    PlatformPartitionsPlugin,
    RbacPlugin,
    TemplatePlugin,
  ],
  db: loadPluginTestDbConfig(process.env),
});
withPartitionedSchemas(server, [ACTIVITY_LOG_SCHEMA], PartitionMaintenanceService);

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterAll(async () => {
  await server.destroy();
});

describeNoteRepositoryContract('TypeOrmNoteRepository', async () => {
  const connection = server.app.get(TransactionalConnection);
  // Test-only direct table access: each contract case starts from an empty table.
  await connection.rawConnection.getRepository(NoteEntity).clear();
  return new TypeOrmNoteRepository(server.app.get(TenantRepositoryFactory));
});

it('has the composite index the newest-first list reads', async () => {
  // Act
  const indexes = await server.app
    .get(TransactionalConnection)
    .rawConnection.query<{ indexdef: string }[]>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'template_note'`);

  // Assert
  expect(indexes.map((index) => index.indexdef).join()).toContain(LIST_INDEX_COLUMNS);
});
