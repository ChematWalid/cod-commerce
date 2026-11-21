import { addonConfigSchema, type AddonConfig } from '@cod/shared';
import type { CartAddon } from '../../domain/cart';
import type { Offer } from '../../domain/offer';
import { anOffer } from './builders';

/** The id of the add-on offer of these tests. */
export const ADDON_ID = '7006';

/** The add-on variant 21 of product 3, listed at 2,000 DZD. */
export const ADDON_VARIANT = '21';
export const ADDON_LIST_PRICE = 2_000;

/** The quote line key of the add-on of {@link ADDON_ID} on {@link ADDON_VARIANT}. */
export const ADDON_KEY = `${ADDON_VARIANT}:addon:${ADDON_ID}`;

/** An add-on at a fixed 1,200 DZD on any order of the order form, at most 3 pieces, changed by `raw`. */
export const anAddonConfig = (raw: Record<string, unknown> = {}): AddonConfig =>
  addonConfigSchema.parse({
    condition: 'any_order',
    price: { mode: 'fixed', value: 1_200 },
    maxPiecesPerOrder: 3,
    placement: 'order_form',
    ...raw,
  });

/** The add-on target of variant {@link ADDON_VARIANT}. */
export const ADDON_TARGET: Offer['targets'][number] = { role: 'addon', refType: 'variant', refId: ADDON_VARIANT };

/** The add-on offer {@link ADDON_ID} offering variant {@link ADDON_VARIANT}, with {@link anAddonConfig} of `raw`. */
export const anAddonOffer = (raw: Record<string, unknown> = {}, overrides: Partial<Offer> = {}): Offer =>
  anOffer({ id: ADDON_ID, kind: 'addon', config: anAddonConfig(raw), targets: [ADDON_TARGET], ...overrides });

/** One accepted piece of the add-on of {@link ADDON_ID} on {@link ADDON_VARIANT}, as the gate priced it. */
export const anAddon = (overrides: Partial<CartAddon> = {}): CartAddon => ({
  offerId: ADDON_ID,
  variantId: ADDON_VARIANT,
  quantity: 1,
  priced: { productId: '3', originalPrice: ADDON_LIST_PRICE, collectionIds: [] },
  ...overrides,
});
