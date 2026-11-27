import type { PlatformLanguageCode } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ChannelService, LanguageCode, type RequestContext, RequestContextService } from '@vendure/core';
import type { StorefrontContext, StorefrontContextsPort } from '../application/ports/storefront-contexts.port';
import { toSignedStoreId, toStorefrontStore } from '../domain/storefront-store';
import { PlatformStoreLookup } from './platform-store-lookup';

const VENDURE_LANGUAGES: Readonly<Record<PlatformLanguageCode, LanguageCode>> = {
  ar: LanguageCode.ar,
  fr: LanguageCode.fr,
  en: LanguageCode.en,
};

/**
 * Shop-API contexts on a store's own channel for storefront calls (D3201), pattern of collections-rules'
 * `StoreChannelContexts`. Store and business status are read from our rows on each call, not a cache (ADR 0002 §7).
 */
@Injectable()
export class VendureStorefrontContexts implements StorefrontContextsPort<RequestContext> {
  constructor(
    private readonly lookup: PlatformStoreLookup,
    private readonly channels: ChannelService,
    private readonly contexts: RequestContextService,
  ) {}

  async forStore(rawStoreId: string): Promise<StorefrontContext<RequestContext> | undefined> {
    const id = toSignedStoreId(rawStoreId);
    if (id === undefined) return undefined;
    const row = await this.lookup.findById(id);
    const store = row === null ? undefined : toStorefrontStore(row);
    if (store === undefined) return undefined;
    const channel = await this.channels.findOne(await this.contexts.create({ apiType: 'shop' }), store.channelId);
    if (channel === undefined) return undefined;
    // No `req`: the tenant is anchored on this context alone, never on the request Vendure's own context shares.
    const ctx = await this.contexts.create({
      apiType: 'shop',
      channelOrToken: channel,
      languageCode: VENDURE_LANGUAGES[store.language],
    });
    return { ctx, store };
  }
}
