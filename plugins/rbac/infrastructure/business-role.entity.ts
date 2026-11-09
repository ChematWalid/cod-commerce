import { TenantEntity } from '@cod/plugin-tenancy';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BUILT_IN_KEY_MAX_LENGTH, ROLE_NAME_KEY_MAX_LENGTH } from '../domain/constants';

/** A role of a business: a built-in or one the merchant made (D53, D61). */
@Entity('business_role')
@Index(['businessId', 'nameKey'], { unique: true })
@Index(['businessId', 'builtInKey'], { unique: true })
export class BusinessRoleEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: ROLE_NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'varchar', length: ROLE_NAME_KEY_MAX_LENGTH })
  nameKey!: string;

  @Column({ type: 'varchar', length: ROLE_DESCRIPTION_MAX_LENGTH, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: BUILT_IN_KEY_MAX_LENGTH, nullable: true })
  builtInKey!: string | null;

  @Column({ type: 'text', array: true })
  permissions!: string[];

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
