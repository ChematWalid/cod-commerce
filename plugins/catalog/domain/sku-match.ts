import type { CoreId } from './core-id';
import { comparableText } from './comparable-text';
import type { SkuCandidate } from './ports/product-lookup.port';

/**
 * What one SKU names in a store (D2201): nothing, one product (and its variant, or `null` for the product's own SKU on
 * a product with options), or more than one, which an import must not guess between (D2209).
 */
export type SkuMatch =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly productId: CoreId; readonly variantId: CoreId | null }
  | { readonly kind: 'ambiguous' };

const NO_MATCH: SkuMatch = { kind: 'none' };
const AMBIGUOUS: SkuMatch = { kind: 'ambiguous' };

/**
 * The distinct holders of one SKU. A product's own SKU names the product only when none of its variants holds the same
 * SKU: without options the one variant carries the product SKU, and that is one holder, not two.
 */
function holdersOf(candidates: readonly SkuCandidate[]): readonly SkuCandidate[] {
  const variantProducts = new Set<string>(
    candidates.flatMap((held) => (held.variantId === null ? [] : [held.productId])),
  );
  const kept = candidates.filter((held) => held.variantId !== null || !variantProducts.has(held.productId));
  const distinct = new Map(kept.map((held) => [`${held.productId}:${held.variantId ?? ''}`, held]));
  return [...distinct.values()];
}

function matchOf(candidates: readonly SkuCandidate[]): SkuMatch {
  const holders = holdersOf(candidates);
  const [only] = holders;
  if (only === undefined) return NO_MATCH;
  if (holders.length > 1) return AMBIGUOUS;
  return { kind: 'one', productId: only.productId, variantId: only.variantId };
}

/**
 * What each of `skus` names among `candidates`, compared exactly after trimming, case and Unicode folding
 * (`comparableText`); the map is keyed by each SKU as given.
 */
export function skuMatchesOf(
  skus: readonly string[],
  candidates: readonly SkuCandidate[],
): ReadonlyMap<string, SkuMatch> {
  const byKey = new Map<string, SkuCandidate[]>();
  for (const candidate of candidates) {
    const key = comparableText(candidate.sku);
    byKey.set(key, [...(byKey.get(key) ?? []), candidate]);
  }
  return new Map(skus.map((sku) => [sku, matchOf(byKey.get(comparableText(sku)) ?? [])]));
}
