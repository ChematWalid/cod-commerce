import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BINDING_SCOPE_MAX_LENGTH, type BindingScope } from '../domain/constants';

/**
 * One Vendure Role projecting a business role on a scope (D53). `scope` is a column rather than a nullable store id,
 * so uniqueness needs no partial index, which the migration-drift test would reject.
 */
@Entity('role_binding')
@Index(['businessRoleId', 'scope'], { unique: true })
export class RoleBindingEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  businessRoleId!: string;

  @Column({ type: 'varchar', length: BINDING_SCOPE_MAX_LENGTH })
  scope!: BindingScope;

  @Column({ type: 'int' })
  vendureRoleId!: number;
}
