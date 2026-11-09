import { asOperationContext as asTenancyContext } from '@cod/plugin-tenancy';
import { BusinessStoreDirectory } from '@cod/plugin-tenancy/provisioning';
import type { BusinessId, Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { BusinessDirectoryPort, ConvergeTarget } from '../domain/ports/business-directory.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { BusinessStore } from '../domain/store-access';
import { toRequestContext } from './request-context';

/** {@link BusinessDirectoryPort} on tenancy's platform-wide directory. */
@Injectable()
export class TenancyBusinessDirectory implements BusinessDirectoryPort {
  constructor(private readonly directory: BusinessStoreDirectory) {}

  page(ctx: OperationContext, afterId: Snowflake | undefined, limit: number): Promise<readonly ConvergeTarget[]> {
    return this.directory.allBusinessIds(asTenancyContext(toRequestContext(ctx)), afterId, limit);
  }

  stores(ctx: OperationContext, businessId: BusinessId): Promise<readonly BusinessStore[]> {
    return this.directory.storesOf(asTenancyContext(toRequestContext(ctx)), businessId);
  }

  ownerAdministratorOf(ctx: OperationContext, businessId: BusinessId): Promise<number | null> {
    return this.directory.ownerAdministratorOf(asTenancyContext(toRequestContext(ctx)), businessId);
  }

  async storeChannelIds(ctx: OperationContext, businessId: BusinessId): Promise<readonly number[]> {
    const stores = await this.directory.storesOf(asTenancyContext(toRequestContext(ctx)), businessId);
    return stores.map((store) => store.channelId);
  }
}
