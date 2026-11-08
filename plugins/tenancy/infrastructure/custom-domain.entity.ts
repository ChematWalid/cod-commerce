import { Column, Entity, PrimaryColumn } from 'typeorm';
import { HOST_MAX_LENGTH } from '../domain/constants';
import { TenantEntity } from './tenant.entity';

/** A merchant's own host for a store. A stub until P8.S9 adds verification. */
@Entity('custom_domain')
export class CustomDomainEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: HOST_MAX_LENGTH, unique: true })
  host!: string;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;
}
