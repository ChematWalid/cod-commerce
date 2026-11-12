import { requestContextOf, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type {
  DataKeyRecord,
  DataKeyRepositoryPort,
  NewDataKey,
  NewSecret,
  SecretRepositoryPort,
  StoredSecret,
} from '../domain/ports/secret-repositories.port';
import { TenantDataKeyEntity } from './tenant-data-key.entity';
import { TenantSecretEntity } from './tenant-secret.entity';

/**
 * The one raw statement of this file (a `RAW_DATA_ACCESS_FILES` entry): the first-use insert of a business's data key.
 * `TenantRepository.insert` cannot say `ON CONFLICT DO NOTHING`, and a plain insert that loses the race to a concurrent
 * first use would abort the caller's transaction. The business is the scope's, bound as a parameter.
 */
const INSERT_DATA_KEY_SQL =
  'INSERT INTO "tenant_data_key" ("id", "businessId", "kid", "iv", "wrappedKey", "tag") VALUES ($1, $2, $3, $4, $5, $6) ' +
  'ON CONFLICT ("businessId") DO NOTHING';

/**
 * The second raw statement of this file: the secret upsert. `TenantRepository.insert` cannot say `ON CONFLICT`, and a
 * plain insert that loses a race raises an error TypeORM logs together with its parameters (ciphertext, wrapped key).
 * The business is the scope's, bound as a parameter.
 */
const UPSERT_SECRET_SQL =
  'INSERT INTO "tenant_secret" ("id", "businessId", "provider", "ref", "dataKeyId", "iv", "ciphertext", "tag", "last4") ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ' +
  'ON CONFLICT ("businessId", "provider", "ref") DO UPDATE SET "dataKeyId" = EXCLUDED."dataKeyId", ' +
  '"iv" = EXCLUDED."iv", "ciphertext" = EXCLUDED."ciphertext", "tag" = EXCLUDED."tag", ' +
  '"last4" = EXCLUDED."last4", "updatedAt" = now()';

export const toDataKey = (row: TenantDataKeyEntity): DataKeyRecord => ({
  id: row.id,
  kid: row.kid,
  wrapped: { iv: row.iv, ciphertext: row.wrappedKey, tag: row.tag },
});

const toSecret = (row: TenantSecretEntity): StoredSecret => ({
  id: row.id,
  provider: row.provider,
  ref: row.ref,
  dataKeyId: row.dataKeyId,
  sealed: { iv: row.iv, ciphertext: row.ciphertext, tag: row.tag },
  last4: row.last4,
  updatedAt: row.updatedAt,
});

/** The data keys on Postgres: reads through `TenantRepository`, the first-use insert as one `ON CONFLICT DO NOTHING`. */
@Injectable()
export class TypeOrmDataKeyRepository implements DataKeyRepositoryPort {
  private readonly keys: TenantRepository<TenantDataKeyEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly connection: TransactionalConnection,
  ) {
    this.keys = repositories.for(TenantDataKeyEntity);
  }

  async find(scope: TenantScope): Promise<DataKeyRecord | undefined> {
    const row = await this.keys.findOne(scope, {});
    return row === null ? undefined : toDataKey(row);
  }

  async insertIfAbsent(scope: TenantScope, key: NewDataKey): Promise<void> {
    await this.connection
      .getRepository(requestContextOf(scope), TenantDataKeyEntity)
      .query(INSERT_DATA_KEY_SQL, [
        key.id,
        scope.businessId,
        key.kid,
        key.wrapped.iv,
        key.wrapped.ciphertext,
        key.wrapped.tag,
      ]);
  }
}

/** The secrets on `TenantRepository`: every call is confined to the scope's business. */
@Injectable()
export class TypeOrmSecretRepository implements SecretRepositoryPort {
  private readonly secrets: TenantRepository<TenantSecretEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly connection: TransactionalConnection,
  ) {
    this.secrets = repositories.for(TenantSecretEntity);
  }

  async find(scope: TenantScope, provider: string, ref: string): Promise<StoredSecret | undefined> {
    const row = await this.secrets.findOne(scope, { provider, ref });
    return row === null ? undefined : toSecret(row);
  }

  async list(scope: TenantScope): Promise<readonly StoredSecret[]> {
    const rows = await this.secrets.find(scope, { order: { provider: 'ASC', ref: 'ASC' } });
    return rows.map(toSecret);
  }

  /**
   * Inserts the `(provider, ref)` row, or replaces its bytes. One `ON CONFLICT DO UPDATE` statement: two concurrent
   * first writes never raise a unique violation, so TypeORM has no failed query to log with its parameters (the sealed
   * value). The row keeps the id of the first write.
   */
  async upsert(scope: TenantScope, secret: NewSecret): Promise<StoredSecret> {
    const bytes = bytesOf(secret);
    await this.connection
      .getRepository(requestContextOf(scope), TenantSecretEntity)
      .query(UPSERT_SECRET_SQL, [
        secret.id,
        scope.businessId,
        secret.provider,
        secret.ref,
        bytes.dataKeyId,
        bytes.iv,
        bytes.ciphertext,
        bytes.tag,
        bytes.last4,
      ]);
    const stored = await this.find(scope, secret.provider, secret.ref);
    if (stored === undefined) {
      throw new Error('A secret written a moment ago is gone');
    }
    return stored;
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    return (await this.secrets.delete(scope, { id })) > 0;
  }
}

const bytesOf = (secret: NewSecret) => ({
  dataKeyId: secret.dataKeyId,
  iv: secret.sealed.iv,
  ciphertext: secret.sealed.ciphertext,
  tag: secret.sealed.tag,
  last4: secret.last4,
});
