import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OfferAdminService } from '../../application/offer-admin.service';
import {
  InvalidOfferTransitionError,
  NoActiveStoreError,
  OfferNotDeletableError,
  OfferNotFoundError,
} from '../../domain/errors';
import { aVariantIn, offersTestEnvironment, scopeOf, storeContext, twoPieceOfferOn } from './offers-kit';

/** One snowflake worker id per offers integration file (D2433). */
const SNOWFLAKE_WORKER_ID = 992;

const { server, adminClient } = offersTestEnvironment(SNOWFLAKE_WORKER_ID, 'test-offers-crud');

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

describe('OfferAdminService on a real database (D2431, D2440)', () => {
  it('creates, edits, publishes, pauses, archives and deletes an offer', async () => {
    // Arrange
    const { a } = fixtures;
    const store = a.stores[0];
    const scope = scopeOf(a, store);
    const ctx = await storeContext(server, store);
    const admin = server.app.get(OfferAdminService);
    const { variantId } = await aVariantIn(server, store);

    // Act
    const draft = await admin.createDraft(ctx, scope, twoPieceOfferOn(variantId));
    const edited = await admin.update(ctx, scope, draft.id, { title: 'Two or more' });
    const published = await admin.publish(ctx, scope, draft.id);
    const paused = await admin.setStatus(ctx, scope, draft.id, 'paused');
    const archived = await admin.setStatus(ctx, scope, draft.id, 'archived');
    const editError = await admin.update(ctx, scope, draft.id, { title: 'Again' }).catch((error: unknown) => error);
    const deleteError = await admin.delete(ctx, scope, draft.id).catch((error: unknown) => error);
    const other = await admin.createDraft(ctx, scope, twoPieceOfferOn(variantId));
    await admin.delete(ctx, scope, other.id);
    const readError = await admin.get(ctx, scope, other.id).catch((error: unknown) => error);

    // Assert
    expect(draft).toMatchObject({ status: 'draft', version: 1 });
    expect(edited).toMatchObject({ title: 'Two or more', version: 2 });
    expect(published.publishedAt).not.toBeNull();
    expect(paused.pausedAt).not.toBeNull();
    expect(archived.archivedAt).not.toBeNull();
    expect(editError).toBeInstanceOf(InvalidOfferTransitionError);
    expect(deleteError).toBeInstanceOf(OfferNotDeletableError);
    expect(readError).toBeInstanceOf(OfferNotFoundError);
  });

  it('finds offers only in the active store', async () => {
    // Arrange
    const { a, b } = fixtures;
    const admin = server.app.get(OfferAdminService);
    const ctxA1 = await storeContext(server, a.stores[0]);
    const { variantId } = await aVariantIn(server, a.stores[0]);
    const offer = await admin.createDraft(ctxA1, scopeOf(a, a.stores[0]), twoPieceOfferOn(variantId));
    const ctxA2 = await storeContext(server, a.stores[1]);
    const ctxB = await storeContext(server, b.stores[0]);

    // Act
    const { items: listedInA1 } = await admin.list(ctxA1, scopeOf(a, a.stores[0]));
    const readInA1 = await admin.get(ctxA1, scopeOf(a, a.stores[0]), offer.id);
    const { items: listedInA2 } = await admin.list(ctxA2, scopeOf(a, a.stores[1]));
    const { items: listedInB } = await admin.list(ctxB, scopeOf(b, b.stores[0]));
    const readInA2 = admin.get(ctxA2, scopeOf(a, a.stores[1]), offer.id);

    // Assert
    expect(listedInA1.map((listed) => listed.id)).toContain(offer.id);
    expect(readInA1.id).toBe(offer.id);
    expect(listedInA2.map((listed) => listed.id)).not.toContain(offer.id);
    expect(listedInB.map((listed) => listed.id)).not.toContain(offer.id);
    await expect(readInA2).rejects.toBeInstanceOf(OfferNotFoundError);
  });

  it("refuses createDraft, update and addCodes on a ctx of A1's channel for store A2 or business B (D2448)", async () => {
    // Arrange
    const { a, b } = fixtures;
    const admin = server.app.get(OfferAdminService);
    const ctxA1 = await storeContext(server, a.stores[0]);
    const owned = await Promise.all(
      [
        { scope: scopeOf(a, a.stores[1]), store: a.stores[1] },
        { scope: scopeOf(b, b.stores[0]), store: b.stores[0] },
      ].map(async ({ scope, store }) => {
        const { variantId } = await aVariantIn(server, store);
        const offer = await admin.createDraft(await storeContext(server, store), scope, {
          ...twoPieceOfferOn(variantId),
          method: 'codes',
        });
        return { scope, store, offer, variantId };
      }),
    );

    // Act
    const refusals: unknown[] = [];
    for (const { scope, offer, variantId } of owned) {
      const refusedOf = (error: unknown) => error;
      refusals.push(await admin.createDraft(ctxA1, scope, twoPieceOfferOn(variantId)).catch(refusedOf));
      refusals.push(await admin.update(ctxA1, scope, offer.id, { title: 'Taken over' }).catch(refusedOf));
      refusals.push(await admin.addCodes(ctxA1, scope, offer.id, [{ code: 'TAKEOVER10' }]).catch(refusedOf));
    }

    // Assert
    expect(refusals).toHaveLength(6);
    for (const refusal of refusals) expect(refusal).toBeInstanceOf(NoActiveStoreError);
    for (const { scope, store, offer, variantId } of owned) {
      const ownCtx = await storeContext(server, store);
      const onVariant = (await admin.list(ownCtx, scope)).items.filter((listed) =>
        listed.targets.some((target) => target.refId === variantId),
      );
      expect(onVariant.map((listed) => listed.id)).toEqual([offer.id]);
      expect(onVariant[0]).toMatchObject({ title: offer.title, version: 1 });
    }
  });
});
