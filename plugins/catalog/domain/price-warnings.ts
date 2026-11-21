import { CATALOG_WARNING_CODES, type CatalogWarningCode } from '@cod/shared';

/** A price of one product or variant. */
export interface PricePair {
  readonly price: number;
  readonly oldPrice: number | null;
}

/** Something a save reports without refusing it; `index` is the position of the price in the input. */
export interface CatalogWarning {
  readonly code: CatalogWarningCode;
  readonly index: number;
}

/** One warning per price whose old price is below its price: it warns, never blocks (brief AC3). */
export function priceWarningsOf(prices: readonly PricePair[]): readonly CatalogWarning[] {
  return prices.flatMap(({ price, oldPrice }, index) =>
    oldPrice !== null && oldPrice < price ? [{ code: CATALOG_WARNING_CODES.oldPriceBelowPrice, index }] : [],
  );
}
