import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OfferAdminService } from '../../application/offer-admin.service';
import { OfferCodesService } from '../../application/offer-codes.service';
import { CodeTakenError } from '../../domain/errors';
import { aVariantIn, offersTestEnvironment, productDiscountOn, scopeOf, storeContext } from './offers-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 975;

/** The code string both businesses hold (D2528). */
const SHARED_CODE = 'SAME10';

const { server, adminClient } = offersTestEnvironment(SNOWFLAKE_WORKER_ID, 'test-offers-codes');

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

describe('OfferCodesService on a real database (D2406, D2512, D2528)', () => {
  it('keeps the same code in two businesses apart', async () => {
    // Arrange
    const admin = server.app.get(OfferAdminService);
    const codes = server.app.get(OfferCodesService);
    const stores = await Promise.all(
      [fixtures.a, fixtures.b].map(async (business) => {
        const store = business.stores[0];
        const scope = scopeOf(business, store);
        const ctx = await storeContext(server, store);
        const { variantId } = await aVariantIn(server, store);
        const offerOf = async () => (await admin.createDraft(ctx, scope, productDiscountOn(variantId, 10, 'codes'))).id;
        return { scope, ctx, first: await offerOf(), second: await offerOf() };
      }),
    );
    const [a, b] = stores;
    if (a === undefined || b === undefined) throw new Error('two businesses expected');
    await codes.add(a.ctx, a.scope, a.first, [{ code: SHARED_CODE }]);
    await codes.add(b.ctx, b.scope, b.first, [{ code: SHARED_CODE }]);

    // Act
    const onSecondBeforeRemove = await codes
      .add(a.ctx, a.scope, a.second, [{ code: SHARED_CODE }])
      .catch((error: unknown) => error);
    const listedInA = await codes.list(a.ctx, a.scope, a.first);
    const removed = await codes.remove(a.ctx, a.scope, a.first, SHARED_CODE);
    const onSecondAfterRemove = await codes.add(a.ctx, a.scope, a.second, [{ code: SHARED_CODE }]);
    await codes.remove(a.ctx, a.scope, a.second, SHARED_CODE);
    const listedInB = await codes.list(b.ctx, b.scope, b.first);

    // Assert
    expect(onSecondBeforeRemove).toBeInstanceOf(CodeTakenError);
    expect(listedInA.map((code) => code.code)).toEqual([SHARED_CODE]);
    expect(removed).toBe(true);
    expect(onSecondAfterRemove.map((code) => code.code)).toEqual([SHARED_CODE]);
    expect(listedInB.map((code) => [code.offerId, code.code])).toEqual([[b.first, SHARED_CODE]]);
  });

  it('generates codes all or none and counts them per offer', async () => {
    // Arrange
    const admin = server.app.get(OfferAdminService);
    const codes = server.app.get(OfferCodesService);
    const store = fixtures.a.stores[1];
    const scope = scopeOf(fixtures.a, store);
    const ctx = await storeContext(server, store);
    const { variantId } = await aVariantIn(server, store);
    const offer = await admin.createDraft(ctx, scope, productDiscountOn(variantId, 15, 'codes'));

    // Act
    const generated = await codes.generate(ctx, scope, offer.id, { count: 20, prefix: 'GEN', usageLimit: 2 });
    const { items } = await admin.list(ctx, scope, { kind: 'product_discount' });

    // Assert
    expect(new Set(generated.map((code) => code.code)).size).toBe(20);
    for (const code of generated) expect([code.usageLimit, code.code.startsWith('GEN')]).toEqual([2, true]);
    expect(items.find((listed) => listed.id === offer.id)?.codeCount).toBe(20);
  });
});
