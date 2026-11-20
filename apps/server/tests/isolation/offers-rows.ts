import type { BusinessWorld } from './world-types';

/*
 * The shape of the seeded offers rows, apart from the code that seeds them in process (offers-world.ts, which boots
 * on the offers plugin), so the runner and the endpoint lists can name them without importing the plugin.
 */

/** The code both businesses hold on their own offer (D2528): unique per business and store, never across them. */
export const SHARED_CODE = 'SAME10';

/**
 * The offers rows (plugins/offers, P2.S4) of one business, on its first store: an automatic offer on every line, a
 * code offer with one code unique to the run, and a code offer holding {@link SHARED_CODE} (D2528), each targeting the
 * first variant of the business's catalog product. `appliesTo: 'all'` makes a leaked offer visible on any cart,
 * whatever its variants.
 */
export interface OffersWorld {
  readonly automaticOfferId: string;
  readonly codeOfferId: string;
  /** The code as stored (normalised, D2406): unique to the run, since it carries the business id. */
  readonly code: string;
  /** The offer holding {@link sharedCode}. */
  readonly sharedCodeOfferId: string;
  /** {@link SHARED_CODE}, as stored. */
  readonly sharedCode: string;
  /** The catalog product's first variant, as the pricing core takes it (no `T_` prefix). */
  readonly variantId: string;
}

/** The offers rows of businesses A and B, filled by the controller with `seedOffers`, like `CATALOG_WORLDS`. */
export const OFFERS_WORLDS = new Map<'A' | 'B', OffersWorld>();

/** The offers rows of `business`. @throws Error when the controller has not run `seedOffers` (`offers-world.ts`) for it. */
export function offersOf(business: BusinessWorld): OffersWorld {
  const offers = OFFERS_WORLDS.get(business.label);
  if (offers === undefined) throw new Error(`no offers rows for business ${business.label}: seedOffers must run`);
  return offers;
}

/** The offer ids of `offers`: none may show in another business's answer. */
export const offersFingerprints = (offers: OffersWorld): string[] => [
  offers.automaticOfferId,
  offers.codeOfferId,
  offers.sharedCodeOfferId,
  offers.code,
];
