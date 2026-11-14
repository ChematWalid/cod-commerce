import {
  type CatalogOperationContext,
  ORDER_MANAGER_CHECK_REGISTRAR,
  type OrderManagerCheck,
  type OrderManagerCheckRegistrar,
} from '@cod/plugin-catalog';
import { type BusinessId, type Snowflake, type StoreId, toSnowflake, toStoreId } from '@cod/shared';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AdministratorService } from '@vendure/core';
import { MEMBER_ACCESS, MEMBER_REPOSITORY } from '../application/tokens';
import { managesStore } from '../domain/order-manager';
import type { MemberAccessPort } from '../domain/ports/member-access.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

const NO_RELATIONS: never[] = [];

/** Team's context for the catalog's: both brand the same Vendure request context. */
const teamContextOf = (ctx: CatalogOperationContext): OperationContext => asOperationContext(ctx);

/**
 * The catalog's {@link OrderManagerCheck} on Team's members and rbac's store access (D2114, D2132), registered with
 * the catalog on bootstrap (D2137). It reads only; a member's store access comes from rbac, the source of truth (D204).
 */
@Injectable()
export class CatalogOrderManagerCheck implements OrderManagerCheck, OnApplicationBootstrap {
  constructor(
    @Inject(ORDER_MANAGER_CHECK_REGISTRAR) private readonly registrar: OrderManagerCheckRegistrar,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepositoryPort,
    @Inject(MEMBER_ACCESS) private readonly access: MemberAccessPort,
    private readonly administrators: AdministratorService,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  async unknownIds(
    ctx: CatalogOperationContext,
    businessId: BusinessId,
    storeId: StoreId,
    ids: readonly Snowflake[],
  ): Promise<readonly Snowflake[]> {
    const teamCtx = teamContextOf(ctx);
    const accepted = await Promise.all(ids.map((id) => this.manages(teamCtx, businessId, storeId, id)));
    return ids.filter((_id, index) => accepted[index] !== true);
  }

  async accessibleStoreIds(
    ctx: CatalogOperationContext,
    businessId: BusinessId,
  ): Promise<ReadonlySet<StoreId> | 'all'> {
    const teamCtx = teamContextOf(ctx);
    const request = toRequestContext(teamCtx);
    const userId = request.activeUserId;
    const administrator =
      userId === undefined ? undefined : await this.administrators.findOneByUserId(request, userId, NO_RELATIONS);
    if (administrator === undefined) return new Set();
    const reach = await this.access.reachOf(teamCtx, {
      administratorId: administrator.id as number,
      scope: { businessId },
    });
    return reach.allStores ? 'all' : new Set(reach.storeIds.map((id) => toStoreId(id)));
  }

  private async manages(ctx: OperationContext, businessId: BusinessId, storeId: StoreId, id: Snowflake) {
    const scope = { businessId };
    const member = await this.members.findById(ctx, scope, id);
    if (member?.administratorId === undefined || member.administratorId === null) return false;
    const grant = await this.access.accessOf(ctx, scope, member.administratorId);
    return managesStore(member, grant, toSnowflake(storeId));
  }
}
