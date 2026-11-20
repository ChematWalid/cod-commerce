import type { Quote } from '@cod/shared';

/** One line as the quote token signs it (ADR 0004 `l`): whole DZD, ids as decimal strings (D2421). */
export interface TokenLine {
  readonly variantId: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly originalPrice: number;
  readonly offerIds: readonly string[];
}

/** One order-level discount as the quote token signs it (ADR 0004 `d`); `code` when a code activated it. */
export interface TokenDiscount {
  readonly amount: number;
  readonly offerId: string;
  readonly code?: string;
}

/**
 * One applied offer as the quote token signs it (ADR 0004 `o`, D2445): every offer the quote applied, whatever its
 * class, with the code that activated it. The order stores them so an edit gives back exactly the uses it holds.
 */
export interface TokenUse {
  readonly offerId: string;
  readonly code?: string;
}

/**
 * What the engine prices, before the token: the quote without `quoteToken`/`expiresAt`, plus the token's lines,
 * discounts and applied offers and whether an applied offer read the buyer's phone (the signed `p` flag, D2421).
 */
export type PricedQuote = Omit<Quote, 'quoteToken' | 'expiresAt'> & {
  readonly tokenLines: readonly TokenLine[];
  readonly tokenDiscounts: readonly TokenDiscount[];
  readonly tokenUses: readonly TokenUse[];
  readonly phoneUsed: boolean;
};
