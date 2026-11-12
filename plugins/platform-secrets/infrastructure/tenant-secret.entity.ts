import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';
import { LAST4_COLUMN_LENGTH, PROVIDER_MAX_LENGTH, REF_MAX_LENGTH } from '../domain/constants';

/**
 * The `tenant_secret` row (D114): a value sealed under the business's data key. `storeId` stays null: secrets belong
 * to the business. `last4` is kept only for values of 12 characters or more. No column holds a plaintext.
 */
@Entity('tenant_secret')
@Unique(['businessId', 'provider', 'ref'])
export class TenantSecretEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: PROVIDER_MAX_LENGTH })
  provider!: string;

  @Column({ type: 'varchar', length: REF_MAX_LENGTH })
  ref!: string;

  @Column({ type: 'bigint' })
  dataKeyId!: string;

  @Column({ type: 'bytea' })
  iv!: Buffer;

  @Column({ type: 'bytea' })
  ciphertext!: Buffer;

  @Column({ type: 'bytea' })
  tag!: Buffer;

  @Column({ type: 'varchar', length: LAST4_COLUMN_LENGTH, nullable: true })
  last4!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
