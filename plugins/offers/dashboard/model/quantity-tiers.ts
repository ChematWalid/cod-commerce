import { MAX_LINE_QUANTITY, MAX_TIERS, type QuantityConfig, type QuantityTier } from '@cod/shared';

/** The percents a tier offers as one-click chips; any other whole percent can be typed. */
export const PERCENT_CHIPS = [5, 10, 15, 20] as const;

const lastTierOf = (config: QuantityConfig): QuantityTier | undefined => config.tiers.at(-1);

/** Whether one more tier fits: fewer than `MAX_TIERS`, and the last one below the most pieces of a line. */
export function canAddTier(config: QuantityConfig): boolean {
  const last = lastTierOf(config);
  return config.tiers.length < MAX_TIERS && (last?.quantity ?? 0) < MAX_LINE_QUANTITY;
}

/**
 * The tiers with one more after the last: one piece more at the last tier's price, so quantities stay strictly
 * ascending (D2409); unchanged when no tier fits.
 */
export function addTier(config: QuantityConfig): QuantityConfig {
  if (!canAddTier(config)) return config;
  const last = lastTierOf(config);
  const added: QuantityTier = {
    quantity: (last?.quantity ?? 0) + 1,
    price: last?.price ?? 0,
    preselected: false,
    freeDelivery: false,
  };
  return { ...config, tiers: [...config.tiers, added] };
}

/** The tiers without the one at `index`; the last tier stays, as an offer has at least one. */
export function removeTier(config: QuantityConfig, index: number): QuantityConfig {
  if (config.tiers.length <= 1) return config;
  return { ...config, tiers: config.tiers.filter((_, each) => each !== index) };
}

/** The tiers with `change` applied to the one at `index`. */
export function changeTier(config: QuantityConfig, index: number, change: Partial<QuantityTier>): QuantityConfig {
  return { ...config, tiers: config.tiers.map((tier, each) => (each === index ? { ...tier, ...change } : tier)) };
}

/**
 * The tiers with the one at `index` as the only one picked on the form at first (D2410: at most one); picking the
 * picked tier again clears it.
 */
export function preselectTier(config: QuantityConfig, index: number): QuantityConfig {
  const turnOn = config.tiers[index]?.preselected !== true;
  return {
    ...config,
    tiers: config.tiers.map((tier, each) => {
      const preselected = turnOn && each === index;
      return tier.preselected === preselected ? tier : { ...tier, preselected };
    }),
  };
}
