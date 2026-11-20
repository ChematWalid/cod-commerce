import { StoreSettingsReader, asOperationContext } from '@cod/plugin-tenancy';
import type { BusinessId, StoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ChannelService, type RequestContext, RequestContextService } from '@vendure/core';

type ContextWithSymbols = RequestContext & Record<symbol, unknown>;

/**
 * Vendure keeps a context's transaction under a symbol it does not export, and that symbol is a context's only one;
 * copying it makes `to` run its queries in `from`'s transaction (pattern of tenancy's `share-transaction.ts`).
 */
function shareTransaction(from: RequestContext, to: RequestContext): RequestContext {
  for (const key of Object.getOwnPropertySymbols(from)) {
    (to as ContextWithSymbols)[key] = (from as ContextWithSymbols)[key];
  }
  return to;
}

/**
 * Admin contexts on a store's own channel for code that runs outside a request (D2313): the outbox consumer and the
 * reconcile job get a default-channel context without tenant, where store products are absent (D2133).
 */
@Injectable()
export class StoreChannelContexts {
  constructor(
    private readonly stores: StoreSettingsReader,
    private readonly channels: ChannelService,
    private readonly contexts: RequestContextService,
  ) {}

  /**
   * A context on the channel of `storeId` that shares `ctx`'s transaction, or `undefined` when the business has no such
   * store or it is archived. The business is the one the job or delivery was made for, never one read from input.
   */
  async forStore(ctx: RequestContext, businessId: BusinessId, storeId: StoreId): Promise<RequestContext | undefined> {
    const settings = await this.stores.settingsOf(asOperationContext(ctx), businessId, storeId);
    if (settings === null || settings.status !== 'active') return undefined;
    const channel = await this.channels.findOne(ctx, settings.channelId);
    if (channel === undefined) return undefined;
    const onChannel = await this.contexts.create({ apiType: 'admin', channelOrToken: channel });
    return shareTransaction(ctx, onChannel);
  }

  /** A context on the channel of `storeId` for a job, which has no context of its own; no transaction yet. */
  async forJob(businessId: BusinessId, storeId: StoreId): Promise<RequestContext | undefined> {
    return this.forStore(await this.contexts.create({ apiType: 'admin' }), businessId, storeId);
  }
}
