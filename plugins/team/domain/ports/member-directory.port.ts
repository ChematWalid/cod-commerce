import type { Snowflake, TenantScope } from '@cod/shared';
import type { MemberGrant } from '../member-grant';
import type { OperationContext } from './operation-context';

/** Names and access Team shows beside its members but does not own: roles and access in rbac, stores in tenancy. */
export interface MemberDirectoryPort {
  /** The name of every role of the business, by role id. */
  roleNames(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<Snowflake, string>>;

  /** The access rbac gives each live role holder of the business, by administrator id (D204). */
  accessOfHolders(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<number, MemberGrant>>;

  /** The name of every store of the business, archived ones too, by store id. */
  storeNames(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<Snowflake, string>>;
}
