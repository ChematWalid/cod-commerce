import type { INestApplicationContext } from '@nestjs/common';
import { OfferAdminService, PricingService } from '@cod/plugin-offers';
import type { Quote, QuoteRequestInput } from '@cod/shared';
import { TransactionalConnection } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { offersOf, scopeOf, storeContextOf } from '../offers-world';
import { OFFERS_TABLE_COUNTS } from '../tenant-tables';
import type { BusinessWorld, World } from '../world-types';

/** Each business's offers rows as {@link offerRowsOf} read them. */
export interface OfferRowsOfBoth {
  readonly a: Record<string, unknown>;
  readonly b: Record<string, unknown>;
}

/**
 * What the offers rows need from the controller: the seeded world, the booted server and both businesses' offers rows
 * as {@link offerRowsOf} read them right before the matrix ran (its cells write in both directions), each read once it
 * exists.
 */
export interface OffersIsolationHarness {
  readonly world: () => World;
  readonly app: () => INestApplicationContext;
  readonly rowsBeforeMatrix: () => OfferRowsOfBoth;
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

/** `business`'s rows in every offers table, ordered by id: another business's calls must leave them as they were. */
export async function offerRowsOf(
  app: INestApplicationContext,
  business: BusinessWorld,
): Promise<Record<string, unknown>> {
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

/** A quote of one piece of `business`'s variant on its first store, through the scoped pricing core (D2408). */
async function quoteIn(app: INestApplicationContext, business: BusinessWorld, codes: string[] = []): Promise<Quote> {
  const store = business.stores[0];
  const pricing = app.get(PricingService);
  return pricing.quoteForScope(await storeContextOf(app, store), scopeOf(business, store), requestFor(business, codes));
}

/**
 * The offers rows of the P2 isolation suite (P2.S4 Task 14, P2.S5 Task 11): A quotes on its first store through the
 * scoped pricing core (D2408) while B has an automatic offer on every line and a code; none of B's offers, codes or
 * tokens may work in A, and A's quotes write nothing to B's rows. Both businesses hold `SAME10` (D2528), each applying
 * its own offer; and each business's rows are as they were before the HTTP matrix (`cases/offers-sweep.ts`) ran, whose
 * cells write in both directions.
 */
export function describeOffersIsolation(harness: OffersIsolationHarness): void {
  const { world, app } = harness;
  const pricing = () => app().get(PricingService);
  const quoteInA = (codes: string[] = []): Promise<Quote> => quoteIn(app(), world().a, codes);

  describe('offers: a business prices only with its own offers', () => {
    // First: the shared-code rows below change A's rows on purpose.
    it("leaves B's offers_* rows unchanged after A's calls, and A's after B's", async () => {
      const { a, b } = world();

      const after = { a: await offerRowsOf(app(), a), b: await offerRowsOf(app(), b) };

      expect(after.b).toEqual(harness.rowsBeforeMatrix().b);
      expect(after.a).toEqual(harness.rowsBeforeMatrix().a);
    });

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

  describeSharedCode(harness);
}

/** The same code in two businesses (D2528): each applies its own offer, and either may add it while the other holds it. */
function describeSharedCode({ world, app }: OffersIsolationHarness): void {
  describe('offers: the same code in two businesses stays apart', () => {
    it.each([
      ['A', 'B'],
      ['B', 'A'],
    ] as const)("applies %s's SAME10 in its own store, not %s's offer", async (label, otherLabel) => {
      const businessOf = (of: 'A' | 'B'): BusinessWorld => (of === 'A' ? world().a : world().b);
      const own = businessOf(label);
      const other = businessOf(otherLabel);
      const { sharedCode, sharedCodeOfferId } = offersOf(own);

      const quote = await quoteIn(app(), own, [sharedCode]);

      expect(quote.rejectedCodes).toEqual([]);
      expect(quote.applied.map((offer) => offer.offerId)).toContain(sharedCodeOfferId);
      expect(offerIdsOf(quote)).not.toContain(offersOf(other).sharedCodeOfferId);
    });

    it('adds SAME10 in A while B holds it', async () => {
      const { a, b } = world();
      const { sharedCode, sharedCodeOfferId } = offersOf(a);
      const store = a.stores[0];
      const admin = app().get(OfferAdminService);
      const ctx = await storeContextOf(app(), store);
      const bRows = await offerRowsOf(app(), b);
      await admin.removeCode(ctx, scopeOf(a, store), sharedCodeOfferId, sharedCode);

      const added = await admin.addCodes(ctx, scopeOf(a, store), sharedCodeOfferId, [{ code: sharedCode }]);

      expect(added.map((stored) => stored.code)).toEqual([sharedCode]);
      expect(await offerRowsOf(app(), b)).toEqual(bRows);
    });
  });
}
