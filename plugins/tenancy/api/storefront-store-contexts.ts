import { Inject, Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { StorefrontContextsPort } from '../application/ports/storefront-contexts.port';
import { STOREFRONT_CONTEXTS } from '../application/tokens';
import { anchoredStorefrontContext } from './storefront-store.guard';

/**
 * Storefront contexts for code that serves the storefront outside a request: the storefront projection's outbox
 * consumer and backfill (P3.S2). The same context the storefront guard builds (D3201): a shop context on the store's
 * channel with that store as tenant, for an active store of an active business only. The caller names the store from
 * its own trusted data (an outbox row, a store list), never from client input, and checks the business it expects.
 */
@Injectable()
export class StorefrontStoreContexts {
  constructor(@Inject(STOREFRONT_CONTEXTS) private readonly storefronts: StorefrontContextsPort<RequestContext>) {}

  /** The storefront context of `storeId`, or `undefined` for a malformed or unknown id or an inactive store. */
  async forStore(storeId: string): Promise<RequestContext | undefined> {
    const found = await this.storefronts.forStore(storeId);
    return found === undefined ? undefined : anchoredStorefrontContext(found);
  }
}
