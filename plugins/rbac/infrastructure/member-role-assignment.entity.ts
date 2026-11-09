import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { type MemberStoreAccess, STORE_ACCESS_MAX_LENGTH } from '../domain/constants';

/** A member holding a role, on all stores or on selected ones (D54). */
@Entity('member_role_assignment')
@Index(['businessId', 'administratorId', 'businessRoleId'], { unique: true })
@Index(['businessId', 'businessRoleId'])
export class MemberRoleAssignmentEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'int' })
  administratorId!: number;

  @Column({ type: 'bigint' })
  businessRoleId!: string;

  @Column({ type: 'varchar', length: STORE_ACCESS_MAX_LENGTH })
  storeAccess!: MemberStoreAccess;

  @Column({ type: 'bigint', array: true })
  storeIds!: string[];

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
