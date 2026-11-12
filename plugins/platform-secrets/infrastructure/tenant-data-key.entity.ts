import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * The `tenant_data_key` row: the one 256-bit data key of a business, wrapped by the KEK `kid` (D114). `iv`, `tag`
 * and `wrappedKey` are the AES-GCM parts of the wrapping. The unique `businessId` is what makes two concurrent first
 * uses end with a single key (`INSERT … ON CONFLICT ("businessId") DO NOTHING`).
 */
@Entity('tenant_data_key')
@Unique(['businessId'])
export class TenantDataKeyEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kid!: string;

  @Column({ type: 'bytea' })
  iv!: Buffer;

  @Column({ type: 'bytea' })
  wrappedKey!: Buffer;

  @Column({ type: 'bytea' })
  tag!: Buffer;

  /** When the key was last re-wrapped under another KEK (Task 12); null until then. */
  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
