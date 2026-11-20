import {
  addonConfigSchema,
  MAX_ADDON_PRODUCTS,
  percentOf,
  STAGE_ADDON,
  type AddonCondition,
  type AddonConfig,
  type AddonPrice,
  type OfferTargetRole,
} from '@cod/shared';
import { addonLineKey, type AddonItem, type RunningLine } from '../cart';
import { compareOfferIds } from '../engine/combine';
import type { OfferKindCalculator, PreviewCart, TargetRules } from '../engine/kind-registry';
import type { AddonOutcome, KindInput, OfferOutcome } from '../engine/outcome';
import { matchingLines } from '../engine/targets';

type PriceOf<M extends AddonPrice['mode']> = Extract<AddonPrice, { mode: M }>;

/**
 * The add-on unit price from its list price, by price mode (§3a.7, D2505): a fixed price never above the list price,
 * a percent off half up, or an amount off clamped at 0.
 */
const ADDON_PRICERS: { readonly [M in AddonPrice['mode']]: (price: PriceOf<M>, listPrice: number) => number } = {
  fixed: ({ value }, listPrice) => Math.min(value, listPrice),
  percent: ({ value }, listPrice) => listPrice - percentOf(listPrice, value),
  amount_off: ({ value }, listPrice) => Math.max(0, listPrice - value),
};

const addonPriceOf = (price: AddonPrice, listPrice: number): number =>
  (ADDON_PRICERS[price.mode] as (price: AddonPrice, listPrice: number) => number)(price, listPrice);

/** The variant id of the smallest buy line of the cart, or undefined when no line matches a buy target. */
function smallestBuyLineOf(input: KindInput<AddonConfig>): string | undefined {
  const ids = matchingLines(input.offer, input.lines).map((line) => line.variantId);
  return [...ids].sort(compareOfferIds)[0];
}

/**
 * The cart variant an add-on rides with, by condition (§3a.7, D2506): none on any order (`null`), the smallest buy
 * line with a targets condition, `undefined` when that condition is not met.
 */
const PARENTS: Readonly<Record<AddonCondition, (input: KindInput<AddonConfig>) => string | null | undefined>> = {
  any_order: () => null,
  targets: smallestBuyLineOf,
};

/** The add-on lines of the accepted add-ons, their pieces capped together at `maxPiecesPerOrder` in request order. */
function addonLinesOf(input: KindInput<AddonConfig>, parentVariantId: string | null): RunningLine[] {
  const { config, offer } = input;
  let left = config.maxPiecesPerOrder;
  return input.addons.flatMap((item: AddonItem) => {
    const quantity = Math.min(item.quantity, left);
    left -= quantity;
    if (quantity === 0) return [];
    const { variantId, productId, originalPrice, collectionIds } = item;
    const unitPrice = addonPriceOf(config.price, originalPrice);
    const key = addonLineKey(variantId, offer.id);
    return [
      {
        key,
        productId,
        variantId,
        quantity,
        originalPrice,
        unitPrice,
        collectionIds,
        addonOf: offer.id,
        parentVariantId,
      },
    ];
  });
}

const NO_ADDON: AddonOutcome = { kind: 'addon', lines: [], value: 0 };

/**
 * An add-on offer (D2505, D2506): silent when the buyer accepted none of its add-ons, skipped `min_not_met` when its
 * targets condition has no buy line, else the accepted add-ons as lines at the add-on price.
 */
function evaluateAddon(input: KindInput<AddonConfig>): OfferOutcome {
  if (input.addons.length === 0) return NO_ADDON;
  const parentVariantId = PARENTS[input.config.condition](input);
  if (parentVariantId === undefined) return { kind: 'skip', reason: 'min_not_met' };
  const lines = addonLinesOf(input, parentVariantId);
  const value = lines.reduce((sum, line) => sum + (line.originalPrice - line.unitPrice) * line.quantity, 0);
  return { kind: 'addon', lines, value };
}

/** Buy targets a targets condition needs, by condition (D2505). */
const REQUIRED_BY_CONDITION: Readonly<Record<AddonCondition, readonly OfferTargetRole[]>> = {
  any_order: ['addon'],
  targets: ['addon', 'buy'],
};

/** Add-on products (1 to {@link MAX_ADDON_PRODUCTS}), and buy targets a targets condition reads (D2505). */
const addonTargetRules = (config: AddonConfig): TargetRules => ({
  allowed: ['addon', 'buy'],
  required: REQUIRED_BY_CONDITION[config.condition],
  maxPerRole: { addon: MAX_ADDON_PRODUCTS },
});

/** One piece of the product with the add-on accepted (D2516). */
const ADDON_PREVIEW_CARTS: readonly PreviewCart[] = [{ pieces: 1, withGet: false, withAddon: true }];

/** The `addon` kind: products the buyer adds at an add-on price, on the order form or after it (D2505-D2507). */
export const addonCalculator: OfferKindCalculator<AddonConfig> = {
  kind: 'addon',
  combinationClass: 'product',
  stage: STAGE_ADDON,
  configSchema: addonConfigSchema,
  evaluate: evaluateAddon,
  targetRules: addonTargetRules,
  combinesAlways: true,
  previewCarts: () => ADDON_PREVIEW_CARTS,
  addonPlacement: (config) => config.placement,
};
