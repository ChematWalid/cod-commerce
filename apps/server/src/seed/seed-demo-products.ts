import {
  asCatalogOperationContext,
  DemoCatalogSeedService,
  type DemoCollectionKey,
  type DemoCollectionSpec,
  demoCollectionsFor,
} from '@cod/plugin-catalog';
import { asCollectionsOperationContext, DemoCollectionSeedService } from '@cod/plugin-collections-rules';
import { asOperationContext, BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { type BusinessId, type StoreId, toBusinessId } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { ChannelService, type RequestContext, RequestContextService, type User } from '@vendure/core';
import { demoImagePng } from './demo-image';

/** A demo business's owner has no administrator user: the seed cannot act as them, so the run stops. */
export class DemoOwnerMissingError extends Error {
  constructor(readonly ownerEmail: string) {
    super(`The demo owner ${ownerEmail} has no administrator user`);
    this.name = 'DemoOwnerMissingError';
  }
}

/** A demo store's channel is gone: the seed cannot write its catalog anywhere, so the run stops. */
export class DemoStoreChannelMissingError extends Error {
  constructor(readonly channelId: number) {
    super(`The demo store channel ${String(channelId)} does not exist`);
    this.name = 'DemoStoreChannelMissingError';
  }
}

/** A store of a demo business and the Vendure channel its catalog lives in. */
export interface DemoStore {
  readonly id: StoreId;
  readonly channelId: number;
}

/** The store a demo business gets its products in. */
export interface DemoStoreTarget {
  readonly businessId: BusinessId;
  readonly store: DemoStore;
  /** The owner the seed acts as: the media library lets only a member with access to the store reach its images. */
  readonly ownerEmail: string;
}

/** What the product seed reads and writes through; the server wires it to tenancy and the catalog. */
export interface DemoProductSeedPorts {
  /** The business of the demo owner `ownerEmail`, or `undefined` when the seed made none. */
  businessOf(ownerEmail: string): Promise<string | undefined>;
  /** Every store of the business, in any order. */
  storesOf(businessId: BusinessId): Promise<readonly DemoStore[]>;
  /** Seeds the store and returns the collection slugs and SKUs it created. */
  seedStore(target: DemoStoreTarget): Promise<readonly string[]>;
}

/** The store a business was provisioned with: snowflakes grow, so the lowest id is the oldest store. */
function firstStoreOf(stores: readonly DemoStore[]): DemoStore | undefined {
  return [...stores].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))[0];
}

/**
 * Gives the first store of each demo business its two demo collections and ten synthetic products with images (D2129,
 * P3.S2). The catalog and the collections skip what a store already holds, so a second run creates nothing.
 *
 * @returns the collection slugs and SKUs it created, in business order
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
    created.push(...(await ports.seedStore({ businessId: toBusinessId(businessId), store, ownerEmail: email })));
  }
  return created;
}

/** Finds the administrator user of a demo owner, or `undefined` when there is none. */
export type DemoOwnerUserOf = (ownerEmail: string) => Promise<User | undefined>;

/**
 * A context in the store's channel, so the catalog writes there and in the store's language (D2112), acting as the
 * business owner: a context without a user reaches no store's media, so the product would not find its own image.
 */
async function storeContext(
  app: INestApplicationContext,
  ctx: RequestContext,
  target: DemoStoreTarget,
  ownerUserOf: DemoOwnerUserOf,
): Promise<RequestContext> {
  const channel = await app.get(ChannelService).findOne(ctx, target.store.channelId);
  if (channel === undefined) throw new DemoStoreChannelMissingError(target.store.channelId);
  const user = await ownerUserOf(target.ownerEmail);
  if (user === undefined) throw new DemoOwnerMissingError(target.ownerEmail);
  return app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: channel, user });
}

/** The id of each demo collection key, from the ids the collection seed answered by slug. */
function collectionIdsByKey(
  specs: readonly DemoCollectionSpec[],
  idsBySlug: ReadonlyMap<string, string>,
): (key: DemoCollectionKey) => string | undefined {
  const byKey = new Map(specs.map((spec) => [spec.key, idsBySlug.get(spec.slug)]));
  return (key) => byKey.get(key);
}

/**
 * The demo collections, then the products in them with their images, in the store channel of `storeCtx` and in the
 * store's language (D2112): a product names its collections by id, so they must exist first.
 */
async function seedStoreCatalog(
  app: INestApplicationContext,
  storeCtx: RequestContext,
  scope: { readonly businessId: BusinessId; readonly storeId: StoreId },
): Promise<readonly string[]> {
  const language = storeCtx.channel.defaultLanguageCode;
  const specs = demoCollectionsFor(language);
  const inputs = specs.map(({ title, slug, position }) => ({ title, slug, position }));
  const collections = await app
    .get(DemoCollectionSeedService)
    .ensureManual(asCollectionsOperationContext(storeCtx), scope, inputs);
  const extras = { imageOf: demoImagePng, collectionIdOf: collectionIdsByKey(specs, collections.idsBySlug) };
  const skus = await app
    .get(DemoCatalogSeedService)
    .seedStore(asCatalogOperationContext(storeCtx), scope, language, extras);
  return [...collections.created, ...skus];
}

/**
 * {@link DemoProductSeedPorts} on the running server; `businessOf` and `ownerUserOf` are the business seed's own owner
 * lookups.
 */
export function demoProductSeedPorts(
  app: INestApplicationContext,
  ctx: RequestContext,
  businessOf: (ownerEmail: string) => Promise<string | undefined>,
  ownerUserOf: DemoOwnerUserOf,
): DemoProductSeedPorts {
  return {
    businessOf,
    storesOf: (businessId) => app.get(BusinessStoreDirectory).storesOf(asOperationContext(ctx), businessId),
    seedStore: async (target) => {
      const storeCtx = await storeContext(app, ctx, target, ownerUserOf);
      return seedStoreCatalog(app, storeCtx, { businessId: target.businessId, storeId: target.store.id });
    },
  };
}
