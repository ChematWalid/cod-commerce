import type { INestApplicationContext } from '@nestjs/common';
import { asOperationContext, OfferAdminService, type OperationContext, type StoreScope } from '@cod/plugin-offers';
import { type OfferInput, toBusinessId, toStoreId } from '@cod/shared';
import { RequestContextService } from '@vendure/core';
import { catalogOf, restIdOf } from './catalog-world';
import type { BusinessWorld, WorldStore } from './world-types';

/** What each seeded offer takes off every unit (D2409 percent); different, so a leak names its owner in the amounts. */
const AUTOMATIC_PERCENT = 10;
const CODE_PERCENT = 20;

/**
 * The offers rows (plugins/offers, P2.S4) of one business, on its first store: an automatic offer on every line and a
 * code offer with one code, each targeting the first variant of the business's catalog product. `appliesTo: 'all'`
 * makes a leaked offer visible on any cart, whatever its variants.
 */
export interface OffersWorld {
  readonly automaticOfferId: string;
  readonly codeOfferId: string;
  /** The code as stored (normalised, D2406): unique to the run, since it carries the business id. */
  readonly code: string;
  /** The catalog product's first variant, as the pricing core takes it (no `T_` prefix). */
  readonly variantId: string;
}

/** The offers rows of businesses A and B, filled by the controller with {@link seedOffers}, like `CATALOG_WORLDS`. */
export const OFFERS_WORLDS = new Map<'A' | 'B', OffersWorld>();

/** A context on `store`'s own channel, as the scoped pricing and admin cores are called (D2408). */
export async function storeContextOf(app: INestApplicationContext, store: WorldStore): Promise<OperationContext> {
  const ctx = await app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: store.channelToken });
  return asOperationContext(ctx);
}

/** The scope of `business`'s `store`. */
export const scopeOf = (business: BusinessWorld, store: WorldStore): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

const offerInputOf = (variantId: string, method: 'automatic' | 'codes', percent: number): OfferInput => ({
  kind: 'product_discount',
  method,
  title: `Isolation ${method} offer`,
  config: { valueType: 'percent', value: percent, appliesTo: 'all' },
  targets: [{ refType: 'variant', refId: variantId }],
});

/**
 * Seeds `business`'s offers in process (the offers have no Admin API before P2.S5): both offers are published, the
 * code offer gets one code. Runs after `seedCatalog` (the targets name the catalog product's variant).
 *
 * @throws Error when the business has no catalog rows or the catalog product has no variant.
 */
export async function seedOffers(app: INestApplicationContext, business: BusinessWorld): Promise<OffersWorld> {
  const [variant] = catalogOf(business).product.variantIds;
  if (variant === undefined) throw new Error(`business ${business.label}: the catalog product has no variant`);
  const variantId = restIdOf(variant);
  const store = business.stores[0];
  const admin = app.get(OfferAdminService);
  const ctx = await storeContextOf(app, store);
  const scope = scopeOf(business, store);
  const publish = async (input: OfferInput): Promise<string> => {
    const draft = await admin.createDraft(ctx, scope, input);
    return (await admin.setStatus(ctx, scope, draft.id, 'active')).id;
  };
  const automaticOfferId = await publish(offerInputOf(variantId, 'automatic', AUTOMATIC_PERCENT));
  const codeOfferId = await publish(offerInputOf(variantId, 'codes', CODE_PERCENT));
  const [stored] = await admin.addCodes(ctx, scope, codeOfferId, [
    { code: `iso-${business.label}-${business.businessId}` },
  ]);
  if (stored === undefined) throw new Error(`business ${business.label}: the offer code was not stored`);
  return { automaticOfferId, codeOfferId, code: stored.code, variantId };
}

/** The offers rows of `business`. @throws Error when the controller has not run {@link seedOffers} for it. */
export function offersOf(business: BusinessWorld): OffersWorld {
  const offers = OFFERS_WORLDS.get(business.label);
  if (offers === undefined) throw new Error(`no offers rows for business ${business.label}: seedOffers must run`);
  return offers;
}
