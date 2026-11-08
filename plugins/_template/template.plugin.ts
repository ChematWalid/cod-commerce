import { PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { templateNotePermission } from './api/permissions';
import { adminApiSchema } from './api/schema';
import { TemplateNoteResolver } from './api/template-note.resolver';
import { CreateNoteService } from './application/create-note.service';
import { GetNotesService } from './application/get-notes.service';
import { ID_GENERATOR, NOTE_REPOSITORY, TENANT_SCOPE_RESOLVER } from './application/tokens';
import type { IdGeneratorPort } from './domain/ports/id-generator.port';
import type { NoteRepositoryPort } from './domain/ports/note-repository.port';
import { ChannelTenantScopeResolver } from './infrastructure/channel-tenant-scope.resolver';
import { NoteEntity } from './infrastructure/note.entity';
import { RandomBigintIdGenerator } from './infrastructure/random-bigint-id.generator';
import { TypeOrmNoteRepository } from './infrastructure/typeorm-note.repository';

const systemClock = (): Date => new Date();

function addPermission(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.authOptions.customPermissions.push(templateNotePermission);
  return config;
}

/**
 * The reference plugin of CLAUDE.md §3a: tenant-scoped notes. This module only wires the layers: the ports'
 * adapters, the use cases (plain classes built by factories) and the Admin API. Copy it to start a feature;
 * `README.md` says how.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [NoteEntity],
  providers: [
    { provide: NOTE_REPOSITORY, useClass: TypeOrmNoteRepository },
    { provide: ID_GENERATOR, useClass: RandomBigintIdGenerator },
    { provide: TENANT_SCOPE_RESOLVER, useClass: ChannelTenantScopeResolver },
    {
      provide: CreateNoteService,
      useFactory: (notes: NoteRepositoryPort, ids: IdGeneratorPort) => new CreateNoteService(notes, ids, systemClock),
      inject: [NOTE_REPOSITORY, ID_GENERATOR],
    },
    {
      provide: GetNotesService,
      useFactory: (notes: NoteRepositoryPort) => new GetNotesService(notes),
      inject: [NOTE_REPOSITORY],
    },
  ],
  adminApiExtensions: { schema: adminApiSchema, resolvers: [TemplateNoteResolver] },
  configuration: addPermission,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TemplatePlugin {}
