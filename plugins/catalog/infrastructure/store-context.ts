import { asOperationContext as asTenancyContext, BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { ChannelService, idsAreEqual, type RequestContext, RequestContextService } from '@vendure/core';
import { ProductNotFoundError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';

/** A store tenancy keeps, as far as the check needs it. */
interface StoreChannel {
  readonly channelId: number;
}

/**
 * The store-channel contexts of the explicit-scope facade (D2201): a check that a context and a scope name one live
 * store of one business, and the context a worker or an outbox consumer runs in, built from the scope alone. A
 * refusal answers like a missing product, so a guessed scope learns nothing (D2136).
 */
@Injectable()
export class CatalogStoreContexts {
  constructor(
    private readonly directory: BusinessStoreDirectory,
    private readonly channels: ChannelService,
    private readonly contexts: RequestContextService,
  ) {}

  /**
   * A context in the store channel of `scope`, admin API, no user: what a job or an outbox consumer writes with,
   * where no request and no tenant guard exist.
   *
   * @throws {ProductNotFoundError} when the store is not a live store of the business.
   */
  async storeContext(scope: StoreScope): Promise<RequestContext> {
    const base = await this.contexts.create({ apiType: 'admin' });
    const store = await this.liveStore(base, scope);
    const channel = await this.channels.findOne(base, store.channelId);
    if (channel === undefined) throw new ProductNotFoundError();
    const ctx = await this.contexts.create({ apiType: 'admin', channelOrToken: channel });
    await this.assertScope(ctx, scope);
    return ctx;
  }

  /**
   * Checks that `scope` names a live store of its business whose channel is the one `ctx` runs in, and that this is
   * not Vendure's default channel (D2133, D2170): products follow the channel and their links the scope, so the two
   * must agree.
   *
   * @throws {ProductNotFoundError} otherwise.
   */
  async assertScope(ctx: RequestContext, scope: StoreScope): Promise<void> {
    const defaultChannel = await this.channels.getDefaultChannel(ctx);
    if (idsAreEqual(ctx.channelId, defaultChannel.id)) throw new ProductNotFoundError();
    const store = await this.liveStore(ctx, scope);
    if (!idsAreEqual(store.channelId, ctx.channelId)) throw new ProductNotFoundError();
  }

  private async liveStore(ctx: RequestContext, scope: StoreScope): Promise<StoreChannel> {
    const stores = await this.directory.storesOf(asTenancyContext(ctx), scope.businessId);
    const store = stores.find((held) => held.id === scope.storeId);
    if (store?.status !== 'active') throw new ProductNotFoundError();
    return store;
  }
}
