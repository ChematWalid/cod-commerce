import type { BusinessWorld } from './world-types';

/*
 * The shape of the seeded delivery-pricing rows, apart from the code that seeds them (delivery-pricing-world.ts), so the
 * runner and the endpoint lists can name them without importing the seeder.
 */

/**
 * The delivery-pricing rows (plugins/delivery-pricing, P3.S1) of one business. On its first store: a group linked as
 * the store's default, with one commune override in Alger; a spare group, the delete's target; and the seeded
 * "Platform default prices" table. On its second store: its own seeded table, which the first store's list must never
 * hold. Each business prices home delivery differently, so a quote read across businesses shows in its fee.
 */
export interface DeliveryPricingWorld {
  readonly groupId: string;
  readonly groupName: string;
  readonly spareGroupId: string;
  readonly spareGroupName: string;
  /** The first store's seeded "Platform default prices" table (D3112). */
  readonly platformDefaultId: string;
  /** The second store's seeded table. */
  readonly otherStoreGroupId: string;
  /** The home price of {@link groupId} in every wilaya. */
  readonly homePrice: number;
  /** The home price of {@link groupId}'s override of Alger-Centre (ONS 1601). */
  readonly communeHomePrice: number;
  /** The delivery role the world's member holds on the first store only (D2132), beside its own roles. */
  readonly pricingRole: { readonly id: string; readonly name: string };
}

/** The delivery-pricing rows of businesses A and B, filled by the controller with `seedDeliveryPricing`. */
export const DELIVERY_PRICING_WORLDS = new Map<'A' | 'B', DeliveryPricingWorld>();

/**
 * The delivery-pricing rows of `business`.
 *
 * @throws Error when the controller has not run `seedDeliveryPricing` (`delivery-pricing-world.ts`) for it.
 */
export function deliveryPricingOf(business: BusinessWorld): DeliveryPricingWorld {
  const rows = DELIVERY_PRICING_WORLDS.get(business.label);
  if (rows === undefined) {
    throw new Error(`no delivery-pricing rows for business ${business.label}: seedDeliveryPricing must run`);
  }
  return rows;
}

/** The group ids, names and member's role of `rows`: none may show in another business's answer. */
export const deliveryPricingFingerprints = (rows: DeliveryPricingWorld): string[] => [
  rows.groupId,
  rows.groupName,
  rows.spareGroupId,
  rows.spareGroupName,
  rows.platformDefaultId,
  rows.otherStoreGroupId,
  rows.pricingRole.id,
  rows.pricingRole.name,
];
