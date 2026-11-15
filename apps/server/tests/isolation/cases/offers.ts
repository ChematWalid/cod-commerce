import type { INestApplicationContext } from '@nestjs/common';
import { PricingService } from '@cod/plugin-offers';
import type { Quote, QuoteRequestInput } from '@cod/shared';
import { TransactionalConnection } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { offersOf, scopeOf, storeContextOf } from '../offers-world';
import { OFFERS_TABLE_COUNTS } from '../tenant-tables';
import type { BusinessWorld, World } from '../world-types';

/** What the offers rows need from the controller: the seeded world and the booted server, read once they exist. */
export interface OffersIsolationHarness {
  readonly world: () => World;
  readonly app: () => INestApplicationContext;
}

/** Algiers, home delivery: any destination works, no shipping source is registered before P3.S1 (D2423). */
const DESTINATION = { provinceCode: '16', stopdesk: false } as const;

/** One piece of `business`'s seeded variant, with `codes`. */
const requestFor = (business: BusinessWorld, codes: string[] = []): QuoteRequestInput => ({
  channel: 'storefront',
  lines: [{ variantId: offersOf(business).variantId, quantity: 1 }],
  destination: DESTINATION,
  codes,
});

/** Every offer id the quote names, applied or skipped, on the order or on a line. */
const offerIdsOf = (quote: Quote): string[] => [
  ...quote.applied.map((offer) => offer.offerId),
  ...quote.skipped.map((offer) => offer.offerId),
  ...quote.lines.flatMap((line) => line.discounts.map((discount) => discount.offerId)),
];

/** `business`'s rows in every offers table, ordered by id: a quote of another business must leave them as they were. */
async function offerRowsOf(app: INestApplicationContext, business: BusinessWorld): Promise<Record<string, unknown>> {
  const sql = app.get(TransactionalConnection).rawConnection;
  const entries = await Promise.all(
    Object.keys(OFFERS_TABLE_COUNTS).map(async (table) => {
      const rows: unknown = await sql.query(`SELECT * FROM "${table}" WHERE "businessId" = $1 ORDER BY "id"`, [
        business.businessId,
      ]);
      return [table, rows] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * The offers rows of the P2 isolation suite (P2.S4 Task 14): A quotes on its first store through the scoped pricing
 * core (D2408) while B has an automatic offer on every line and a code; none of B's offers, codes or tokens may work
 * in A, and A's quotes write nothing to B's rows.
 */
export function describeOffersIsolation({ world, app }: OffersIsolationHarness): void {
  const pricing = () => app().get(PricingService);
  const quoteInA = async (codes: string[] = []): Promise<Quote> => {
    const { a } = world();
    const store = a.stores[0];
    return pricing().quoteForScope(await storeContextOf(app(), store), scopeOf(a, store), requestFor(a, codes));
  };

  describe('offers: a business prices only with its own offers', () => {
    it("quotes store A without B's offers", async () => {
      const { a, b } = world();

      const quote = await quoteInA();

      expect(quote.applied.map((offer) => offer.offerId)).toContain(offersOf(a).automaticOfferId);
      expect(offerIdsOf(quote)).not.toContain(offersOf(b).automaticOfferId);
      expect(offerIdsOf(quote)).not.toContain(offersOf(b).codeOfferId);
    });

    it("rejects B's code in A as not_found", async () => {
      const { b } = world();
      const { code, codeOfferId } = offersOf(b);

      const quote = await quoteInA([code]);

      expect(quote.rejectedCodes).toEqual([{ code, reason: 'not_found' }]);
      expect(offerIdsOf(quote)).not.toContain(codeOfferId);
    });

    it("fails A's token in B", async () => {
      const { a, b } = world();
      const token = (await quoteInA()).quoteToken;
      const storeB = b.stores[0];

      const verdict = await pricing().verifyQuoteForScope(
        await storeContextOf(app(), storeB),
        scopeOf(b, storeB),
        token ?? '',
        requestFor(a),
      );

      expect(token).not.toBeNull();
      expect(verdict).toEqual({ ok: false, reason: 'business_mismatch' });
    });

    it("leaves B's offer rows unchanged after A's quotes", async () => {
      const { b } = world();
      const before = await offerRowsOf(app(), b);

      await quoteInA();
      await quoteInA([offersOf(b).code]);

      expect(await offerRowsOf(app(), b)).toEqual(before);
    });
  });
}
