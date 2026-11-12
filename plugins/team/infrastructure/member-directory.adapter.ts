import { asOperationContext as asTenancyContext, StoreNamesService } from '@cod/plugin-tenancy';
import { asOperationContext as asRbacContext, MemberAccessService } from '@cod/plugin-rbac/member-access';
import { type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { MemberGrant } from '../domain/member-grant';
import type { MemberDirectoryPort } from '../domain/ports/member-directory.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** {@link MemberDirectoryPort} on rbac's member access (roles, D204) and tenancy's stores. */
@Injectable()
export class MemberDirectoryAdapter implements MemberDirectoryPort {
  constructor(
    private readonly access: MemberAccessService,
    private readonly stores: StoreNamesService,
  ) {}

  async roleNames(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<Snowflake, string>> {
    const names = await this.access.roleNames(asRbacContext(toRequestContext(ctx)), scope);
    return new Map([...names].map(([id, name]) => [toSnowflake(id), name]));
  }

  async accessOfHolders(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<number, MemberGrant>> {
    const views = await this.access.accessOfHolders(asRbacContext(toRequestContext(ctx)), scope);
    return new Map(
      [...views].map(([administratorId, view]) => [
        administratorId,
        {
          roleIds: view.roles.map((role) => toSnowflake(role.id)),
          storeAccess: view.storeAccess,
          storeIds: view.storeIds.map(toSnowflake),
        },
      ]),
    );
  }

  async storeNames(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<Snowflake, string>> {
    const names = await this.stores.namesOf(asTenancyContext(toRequestContext(ctx)), scope.businessId);
    return new Map([...names].map(([id, name]) => [toSnowflake(id), name]));
  }
}
