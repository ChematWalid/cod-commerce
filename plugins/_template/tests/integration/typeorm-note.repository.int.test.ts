import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll } from 'vitest';
import { NoteEntity } from '../../infrastructure/note.entity';
import { TypeOrmNoteRepository } from '../../infrastructure/typeorm-note.repository';
import { TemplatePlugin } from '../../template.plugin';
import { describeNoteRepositoryContract } from '../contract/note-repository.contract';

const { server } = createPluginTestEnvironment({
  plugins: [TemplatePlugin],
  db: loadPluginTestDbConfig(process.env),
});

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
  return new TypeOrmNoteRepository(connection);
});
