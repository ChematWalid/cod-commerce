import { asOperationContext as asTenancyContext, StoreSettingsReader } from '@cod/plugin-tenancy';
import type { Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreDefaultsPort } from '../domain/ports/store-defaults.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** {@link StoreDefaultsPort} on tenancy's `StoreSettingsReader`, confined to the scope's business (D2106, D3111). */
@Injectable()
export class TenancyStoreDefaults implements StoreDefaultsPort {
  constructor(private readonly settings: StoreSettingsReader) {}

  async defaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    const tenancyCtx = asTenancyContext(toRequestContext(ctx));
    const settings = await this.settings.settingsOf(tenancyCtx, scope.businessId, scope.storeId);
    return settings?.defaultDeliveryFeeGroupId ?? null;
  }
}
