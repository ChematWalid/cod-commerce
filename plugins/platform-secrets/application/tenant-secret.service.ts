import type { TenantScope } from '@cod/shared';
import { dataKeyAad, secretAad } from '../domain/aad';
import { MAX_ROW_ID, ROW_ID_FORMAT } from '../domain/constants';
import { SecretNotFoundError, SecretUnreadableError } from '../domain/errors';
import type { EnvelopeCipherPort, KekRing } from '../domain/ports/envelope-cipher.port';
import type {
  DataKeyRecord,
  DataKeyRepositoryPort,
  SecretRepositoryPort,
  StoredSecret,
} from '../domain/ports/secret-repositories.port';
import { SecretValue } from '../domain/secret-value';
import type { TenantSecretProviderRegistry } from './provider-registry';

/** A secret as the API shows it: never the value (D114). */
export interface TenantSecretView {
  readonly id: string;
  readonly provider: string;
  readonly ref: string;
  readonly last4: string | null;
  readonly updatedAt: string;
}

/** What {@link TenantSecretService.put} stores. */
export interface PutTenantSecretInput {
  readonly provider: string;
  readonly ref: string;
  readonly value: string;
}

/** Where the service reports a secret it cannot open. Lines name the business, provider and ref, never a value. */
export interface SecretLogger {
  warn(message: string): void;
}

/** Hands out new row ids (ADR 0003). */
export interface SecretIdSource {
  next(): string;
}

/** The adapters behind the service: the cipher, the two repositories and the log. */
export interface SecretPorts {
  readonly cipher: EnvelopeCipherPort;
  readonly dataKeys: DataKeyRepositoryPort;
  readonly secrets: SecretRepositoryPort;
  readonly logger: SecretLogger;
}

/** Everything the service needs. */
export interface TenantSecretDependencies extends SecretPorts {
  readonly providers: TenantSecretProviderRegistry;
  readonly ring: KekRing;
  readonly ids: SecretIdSource;
}

const toView = (row: StoredSecret): TenantSecretView => ({
  id: row.id,
  provider: row.provider,
  ref: row.ref,
  last4: row.last4,
  updatedAt: row.updatedAt.toISOString(),
});

const isRowId = (id: string): boolean => ROW_ID_FORMAT.test(id) && BigInt(id) <= MAX_ROW_ID;

/**
 * Envelope-encrypted secrets of one business (D114). A value is sealed with AES-256-GCM under the business's data
 * key, binding its business, provider and ref; the data key is wrapped by a KEK and bound to its business and kid.
 * Nothing here logs, returns or throws a value, a key or any of their encodings.
 */
export class TenantSecretService {
  constructor(private readonly deps: TenantSecretDependencies) {}

  /**
   * Stores `value` under `(provider, ref)` for the scope's business, replacing an earlier value and keeping its id. The
   * first secret of a business creates its data key; two concurrent first uses end with one shared key.
   *
   * @throws {UnknownProviderError} or {InvalidSecretValueError} for input the store refuses.
   */
  async put(scope: TenantScope, input: PutTenantSecretInput): Promise<TenantSecretView> {
    this.deps.providers.assertAccepts(input.provider, input.ref);
    const value = SecretValue.of(input.value);
    const dataKey = await this.dataKeyOf(scope);
    const plaintext = value.bytes();
    const dek = this.unwrap(scope, dataKey, input);
    try {
      const sealed = this.deps.cipher.seal(dek, plaintext, secretAad(scope.businessId, input.provider, input.ref));
      const stored = await this.deps.secrets.upsert(scope, {
        id: this.deps.ids.next(),
        provider: input.provider,
        ref: input.ref,
        dataKeyId: dataKey.id,
        sealed,
        last4: value.last4,
      });
      return toView(stored);
    } finally {
      plaintext.fill(0);
      dek.fill(0);
    }
  }

  /** The business's secrets, without values. */
  async list(scope: TenantScope): Promise<readonly TenantSecretView[]> {
    return (await this.deps.secrets.list(scope)).map(toView);
  }

  /** Deletes the business's secret `id`; false when it has none. */
  delete(scope: TenantScope, id: string): Promise<boolean> {
    return isRowId(id) ? this.deps.secrets.delete(scope, id) : Promise.resolve(false);
  }

  /**
   * The value of the business's secret `(provider, ref)`. For workers and handlers only: no API calls it.
   *
   * @throws {SecretNotFoundError} when the business has no such secret (another business's counts as none).
   * @throws {SecretUnreadableError} when the row does not open under this business's data key and these names.
   */
  async reveal(scope: TenantScope, provider: string, ref: string): Promise<string> {
    const row = await this.deps.secrets.find(scope, provider, ref);
    if (row === undefined) {
      throw new SecretNotFoundError();
    }
    const dataKey = await this.deps.dataKeys.find(scope);
    if (dataKey === undefined || dataKey.id !== row.dataKeyId) {
      throw this.unreadable(scope, { provider, ref });
    }
    const dek = this.unwrap(scope, dataKey, { provider, ref });
    try {
      const plaintext = this.open(scope, dek, row);
      try {
        return plaintext.toString('utf8');
      } finally {
        plaintext.fill(0);
      }
    } finally {
      dek.fill(0);
    }
  }

  private open(scope: TenantScope, dek: Buffer, row: StoredSecret): Buffer {
    try {
      return this.deps.cipher.open(dek, row.sealed, secretAad(scope.businessId, row.provider, row.ref));
    } catch (error) {
      if (error instanceof SecretUnreadableError) {
        throw this.unreadable(scope, row);
      }
      throw error;
    }
  }

  /** The business's data key, created under the active kid on first use. */
  private async dataKeyOf(scope: TenantScope): Promise<DataKeyRecord> {
    const existing = await this.deps.dataKeys.find(scope);
    if (existing !== undefined) {
      return existing;
    }
    const { ring, cipher } = this.deps;
    const dek = cipher.newDataKey();
    try {
      const wrapped = cipher.seal(ring.key(ring.activeKid), dek, dataKeyAad(scope.businessId, ring.activeKid));
      await this.deps.dataKeys.insertIfAbsent(scope, { id: this.deps.ids.next(), kid: ring.activeKid, wrapped });
    } finally {
      dek.fill(0);
    }
    // Our key, or the one a concurrent first use inserted first: either way the one row every secret shares.
    const stored = await this.deps.dataKeys.find(scope);
    if (stored === undefined) {
      throw new SecretUnreadableError();
    }
    return stored;
  }

  /** The plain data key, or `tenant-secret.unreadable` when its KEK left the ring or the wrapped key is altered. */
  private unwrap(scope: TenantScope, dataKey: DataKeyRecord, names: { provider: string; ref: string }): Buffer {
    try {
      const kek = this.deps.ring.key(dataKey.kid);
      try {
        return this.deps.cipher.open(kek, dataKey.wrapped, dataKeyAad(scope.businessId, dataKey.kid));
      } finally {
        kek.fill(0);
      }
    } catch {
      // A kid the ring no longer holds, a row copied from another business, or altered bytes: all unreadable.
      throw this.unreadable(scope, names);
    }
  }

  private unreadable(scope: TenantScope, names: { provider: string; ref: string }): SecretUnreadableError {
    this.deps.logger.warn(
      `Tenant secret unreadable: business ${scope.businessId}, provider ${names.provider}, ref ${names.ref}`,
    );
    return new SecretUnreadableError();
  }
}
