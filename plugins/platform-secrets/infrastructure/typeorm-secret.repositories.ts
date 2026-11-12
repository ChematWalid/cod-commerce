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

/** Postgres SQLSTATE of a unique violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * The one raw statement of this file (a `RAW_DATA_ACCESS_FILES` entry): the first-use insert of a business's data key.
 * `TenantRepository.insert` cannot say `ON CONFLICT DO NOTHING`, and a plain insert that loses the race to a concurrent
 * first use would abort the caller's transaction. The business is the scope's, bound as a parameter.
 */
const INSERT_DATA_KEY_SQL =
  'INSERT INTO "tenant_data_key" ("id", "businessId", "kid", "iv", "wrappedKey", "tag") VALUES ($1, $2, $3, $4, $5, $6) ' +
  'ON CONFLICT ("businessId") DO NOTHING';

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

  constructor(repositories: TenantRepositoryFactory) {
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
   * Updates the `(provider, ref)` row, or inserts it. Two concurrent first writes of one pair both miss the update; the
   * loser's insert hits the unique constraint and falls back to the update. (Outside a transaction only: a unique
   * violation inside one aborts it, so the service never wraps this call.)
   */
  async upsert(scope: TenantScope, secret: NewSecret): Promise<StoredSecret> {
    if (!(await this.replace(scope, secret))) {
      try {
        await this.secrets.insert(scope, {
          ...bytesOf(secret),
          id: secret.id,
          provider: secret.provider,
          ref: secret.ref,
        });
      } catch (error) {
        if (!isUniqueViolation(error) || !(await this.replace(scope, secret))) {
          throw error;
        }
      }
    }
    const stored = await this.find(scope, secret.provider, secret.ref);
    if (stored === undefined) {
      throw new Error('A secret written a moment ago is gone');
    }
    return stored;
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    return (await this.secrets.delete(scope, { id })) > 0;
  }

  /** True when a row for `(provider, ref)` existed and took the new bytes. */
  private async replace(scope: TenantScope, secret: NewSecret): Promise<boolean> {
    const changed = await this.secrets.update(scope, { provider: secret.provider, ref: secret.ref }, bytesOf(secret));
    return changed > 0;
  }
}

const bytesOf = (secret: NewSecret) => ({
  dataKeyId: secret.dataKeyId,
  iv: secret.sealed.iv,
  ciphertext: secret.sealed.ciphertext,
  tag: secret.sealed.tag,
  last4: secret.last4,
});

function isUniqueViolation(error: unknown): boolean {
  const failure = error as { code?: unknown; driverError?: { code?: unknown } } | null;
  return failure?.code === UNIQUE_VIOLATION || failure?.driverError?.code === UNIQUE_VIOLATION;
}
