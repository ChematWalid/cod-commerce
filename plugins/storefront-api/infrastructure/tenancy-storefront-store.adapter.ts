import { StorefrontStoreContexts, storefrontStoreOf } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import type { StorefrontStore, StorefrontStorePort } from '../domain/ports/storefront-store.port';
import { toRequestContext } from './request-scope';

/** {@link StorefrontStorePort} over tenancy's storefront contexts (D3201). */
@Injectable()
export class TenancyStorefrontStore implements StorefrontStorePort {
  constructor(private readonly contexts: StorefrontStoreContexts) {}

  storeOf(ctx: OperationContext): StorefrontStore {
    const { businessId, storeId, soldOutBehavior } = storefrontStoreOf(toRequestContext(ctx));
    return { scope: { businessId, storeId }, soldOutBehavior };
  }

  async contextFor(storeId: string): Promise<OperationContext | undefined> {
    const ctx = await this.contexts.forStore(storeId);
    return ctx === undefined ? undefined : asOperationContext(ctx);
  }
}
