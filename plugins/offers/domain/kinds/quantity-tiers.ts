import { percentOf, roundHalfUp, type QuantityConfig, type QuantityTier } from '@cod/shared';
import type { RunningLine } from '../cart';

/**
 * Each quantity tier price, by price mode (§3a.7): percent off the unit, or the tier total shared over its pieces,
 * never above the unit it replaces (D2409).
 */
const UNIT_PRICERS: Readonly<Record<QuantityConfig['priceMode'], (tier: QuantityTier, unitPrice: number) => number>> = {
  percent: (tier, unitPrice) => unitPrice - percentOf(unitPrice, tier.price),
  total: (tier, unitPrice) => Math.min(unitPrice, roundHalfUp(tier.price / tier.quantity)),
};

/** The highest tier whose quantity the pieces reach, or `undefined` below the first tier (D2410). */
export function tierFor(config: QuantityConfig, pieces: number): QuantityTier | undefined {
  return config.tiers.findLast((tier) => tier.quantity <= pieces);
}

/** The first tier above the pieces, or `undefined` once the top tier is reached (D2416). */
export function nextTier(config: QuantityConfig, pieces: number): QuantityTier | undefined {
  return config.tiers.find((tier) => tier.quantity > pieces);
}

/** The unit price of a piece at `tier`, from `originalPrice` (the unit the tier replaces), never higher (D2409). */
export function unitPriceAtTier(config: QuantityConfig, tier: QuantityTier, originalPrice: number): number {
  return Math.max(0, UNIT_PRICERS[config.priceMode](tier, originalPrice));
}

/** What `tier` takes off one piece of `line`, from its running unit price. */
export function unitDiscountAtTier(config: QuantityConfig, tier: QuantityTier, line: RunningLine): number {
  return line.unitPrice - unitPriceAtTier(config, tier, line.unitPrice);
}

/** The pieces of `lines`: the sum of their quantities (D2410: across variants). */
export function piecesOf(lines: readonly RunningLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
