import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import type { KekRewrapStorePort, RewrappedKey } from '../domain/ports/kek-rotation.ports';
import type { DataKeyRecord } from '../domain/ports/secret-repositories.port';
import { TenantDataKeyEntity } from './tenant-data-key.entity';
import { toDataKey } from './typeorm-secret.repositories';

/** {@link KekRewrapStorePort} on Postgres: a job has no request, so an anonymous admin context carries the scope. */
@Injectable()
export class TypeOrmKekRewrapStore implements KekRewrapStorePort {
  private readonly keys: TenantRepository<TenantDataKeyEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly contexts: RequestContextService,
    private readonly connection: TransactionalConnection,
  ) {
    this.keys = repositories.for(TenantDataKeyEntity);
  }

  async rewrapLocked(
    businessId: BusinessId,
    plan: (current: DataKeyRecord) => RewrappedKey | undefined,
    rotatedAt: Date,
  ): Promise<'rewrapped' | 'current'> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    return this.connection.withTransaction(ctx, async (txCtx) => {
      const scope = new RequestTenantScope(txCtx, businessId);
      // Held until commit: a concurrent rewrap waits, then reads the new kid and finds nothing to do.
      const row = await this.keys.query(scope, 'key').setLock('pessimistic_write').getOne();
      const next = row === null ? undefined : plan(toDataKey(row));
      if (row === null || next === undefined) return 'current';
      await this.keys.update(
        scope,
        { id: row.id },
        { kid: next.kid, iv: next.wrapped.iv, wrappedKey: next.wrapped.ciphertext, tag: next.wrapped.tag, rotatedAt },
      );
      return 'rewrapped';
    });
  }
}
