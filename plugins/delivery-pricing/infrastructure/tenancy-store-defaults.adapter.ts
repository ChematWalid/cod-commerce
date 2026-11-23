import {
  asOperationContext as asTenancyContext,
  BusinessStoreDirectory,
  StoreDeliveryDefaults,
  StoreSettingsReader,
} from '@cod/plugin-tenancy';
import type { Snowflake, StoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreDefaultsPort } from '../domain/ports/store-defaults.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** Tenancy's context for ours: both brand the same Vendure request context. */
const tenancyContextOf = (ctx: OperationContext) => asTenancyContext(toRequestContext(ctx));

/**
 * {@link StoreDefaultsPort} on tenancy's exported ports (D3111): `StoreSettingsReader` (confined to the scope's
 * business, D2106), `StoreDeliveryDefaults` for the platform-only link and the store directory for the converge.
 */
@Injectable()
export class TenancyStoreDefaults implements StoreDefaultsPort {
  constructor(
    private readonly settings: StoreSettingsReader,
    private readonly deliveryDefaults: StoreDeliveryDefaults,
    private readonly directory: BusinessStoreDirectory,
  ) {}

  async defaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    const settings = await this.settings.settingsOf(tenancyContextOf(ctx), scope.businessId, scope.storeId);
    return settings?.defaultDeliveryFeeGroupId ?? null;
  }

  lockedDefaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    return this.deliveryDefaults.lockDefaultDeliveryFeeGroup(tenancyContextOf(ctx), scope);
  }

  linkDefaultGroup(ctx: OperationContext, scope: StoreScope, groupId: Snowflake): Promise<void> {
    return this.deliveryDefaults.setDefaultDeliveryFeeGroup(tenancyContextOf(ctx), scope, groupId);
  }

  async activeStores(
    ctx: OperationContext,
    afterStoreId: StoreId | undefined,
    limit: number,
  ): Promise<readonly StoreScope[]> {
    const links = await this.directory.activeStoreLinks(tenancyContextOf(ctx), afterStoreId, limit);
    return links.map(({ businessId, storeId }) => ({ businessId, storeId }));
  }
}
