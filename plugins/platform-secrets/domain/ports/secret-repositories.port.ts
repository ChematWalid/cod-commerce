import type { TenantScope } from '@cod/shared';
import type { SealedBytes } from './envelope-cipher.port';

/** A business's data key as stored: wrapped by the KEK `kid`. */
export interface DataKeyRecord {
  readonly id: string;
  readonly kid: string;
  /** `ciphertext` is the wrapped key. */
  readonly wrapped: SealedBytes;
}

/** A data key to store. */
export type NewDataKey = DataKeyRecord;

/** Where the data keys are kept: one per business. */
export interface DataKeyRepositoryPort {
  /** The scope's business's data key, or `undefined` before its first secret. */
  find(scope: TenantScope): Promise<DataKeyRecord | undefined>;

  /**
   * Stores `key` for the scope's business unless that business already has a data key (`ON CONFLICT DO NOTHING`):
   * of two concurrent first uses one wins and the other changes nothing. Callers read the key back with {@link find}.
   */
  insertIfAbsent(scope: TenantScope, key: NewDataKey): Promise<void>;
}

/** A secret as stored. */
export interface StoredSecret {
  readonly id: string;
  readonly provider: string;
  readonly ref: string;
  readonly dataKeyId: string;
  readonly sealed: SealedBytes;
  readonly last4: string | null;
  readonly updatedAt: Date;
}

/** A secret to store. */
export interface NewSecret {
  readonly id: string;
  readonly provider: string;
  readonly ref: string;
  readonly dataKeyId: string;
  readonly sealed: SealedBytes;
  readonly last4: string | null;
}

/** Where the secrets are kept. Every method is confined to the scope's business. */
export interface SecretRepositoryPort {
  find(scope: TenantScope, provider: string, ref: string): Promise<StoredSecret | undefined>;

  /** Every secret of the business, by provider then ref. */
  list(scope: TenantScope): Promise<readonly StoredSecret[]>;

  /** Writes the secret under `(provider, ref)`: an existing row keeps its id and takes the new bytes. Returns the stored row. */
  upsert(scope: TenantScope, secret: NewSecret): Promise<StoredSecret>;

  /** Deletes the business's secret `id`; false when it has none (another business's id counts as none). */
  delete(scope: TenantScope, id: string): Promise<boolean>;
}
