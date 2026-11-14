import { asCatalogOperationContext, DemoCatalogSeedService } from '@cod/plugin-catalog';
import { asOperationContext, BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { type BusinessId, type StoreId, toBusinessId } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { ChannelService, type RequestContext, RequestContextService } from '@vendure/core';

/** A store of a demo business and the Vendure channel its catalog lives in. */
export interface DemoStore {
  readonly id: StoreId;
  readonly channelId: number;
}

/** The store a demo business gets its products in. */
export interface DemoStoreTarget {
  readonly businessId: BusinessId;
  readonly store: DemoStore;
}

/** What the product seed reads and writes through; the server wires it to tenancy and the catalog. */
export interface DemoProductSeedPorts {
  /** The business of the demo owner `ownerEmail`, or `undefined` when the seed made none. */
  businessOf(ownerEmail: string): Promise<string | undefined>;
  /** Every store of the business, in any order. */
  storesOf(businessId: BusinessId): Promise<readonly DemoStore[]>;
  /** Seeds the store and returns the SKUs it created. */
  seedStore(target: DemoStoreTarget): Promise<readonly string[]>;
}

/** The store a business was provisioned with: snowflakes grow, so the lowest id is the oldest store. */
function firstStoreOf(stores: readonly DemoStore[]): DemoStore | undefined {
  return [...stores].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))[0];
}

/**
 * Gives the first store of each demo business its five synthetic products (D2129). The catalog skips what a store
 * already holds, so a second run creates nothing.
 *
 * @returns the SKUs it created, in business order
 */
export async function seedDemoProducts(
  ports: DemoProductSeedPorts,
  ownerEmails: readonly string[],
): Promise<readonly string[]> {
  const created: string[] = [];
  for (const email of ownerEmails) {
    const businessId = await ports.businessOf(email);
    if (businessId === undefined) continue;
    const store = firstStoreOf(await ports.storesOf(toBusinessId(businessId)));
    if (store === undefined) continue;
    created.push(...(await ports.seedStore({ businessId: toBusinessId(businessId), store })));
  }
  return created;
}

/** A context in the store's channel, so the catalog writes there and in the store's language (D2112). */
async function storeContext(
  app: INestApplicationContext,
  ctx: RequestContext,
  channelId: number,
): Promise<RequestContext> {
  const channel = await app.get(ChannelService).findOne(ctx, channelId);
  if (channel === undefined) throw new Error(`The demo store channel ${String(channelId)} does not exist`);
  return app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: channel });
}

/** {@link DemoProductSeedPorts} on the running server; `businessOf` is the business seed's own owner lookup. */
export function demoProductSeedPorts(
  app: INestApplicationContext,
  ctx: RequestContext,
  businessOf: (ownerEmail: string) => Promise<string | undefined>,
): DemoProductSeedPorts {
  return {
    businessOf,
    storesOf: (businessId) => app.get(BusinessStoreDirectory).storesOf(asOperationContext(ctx), businessId),
    seedStore: async ({ businessId, store }) => {
      const storeCtx = await storeContext(app, ctx, store.channelId);
      const scope = { businessId, storeId: store.id };
      const language = storeCtx.channel.defaultLanguageCode;
      return app.get(DemoCatalogSeedService).seedStore(asCatalogOperationContext(storeCtx), scope, language);
    },
  };
}
