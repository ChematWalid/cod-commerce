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
 * What the engine prices, before the token: the quote without `quoteToken`/`expiresAt`, plus the token's lines and
 * discounts and whether an applied offer read the buyer's phone (the signed `p` flag, D2421).
 */
export type PricedQuote = Omit<Quote, 'quoteToken' | 'expiresAt'> & {
  readonly tokenLines: readonly TokenLine[];
  readonly tokenDiscounts: readonly TokenDiscount[];
  readonly phoneUsed: boolean;
};
