import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OfferAdminService } from '../../application/offer-admin.service';
import { InvalidOfferTransitionError, OfferNotFoundError } from '../../domain/errors';
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
    const published = await admin.setStatus(ctx, scope, draft.id, 'active');
    const paused = await admin.setStatus(ctx, scope, draft.id, 'paused');
    const archived = await admin.setStatus(ctx, scope, draft.id, 'archived');
    const editError = await admin.update(ctx, scope, draft.id, { title: 'Again' }).catch((error: unknown) => error);
    await admin.delete(ctx, scope, draft.id);
    const readError = await admin.get(ctx, scope, draft.id).catch((error: unknown) => error);

    // Assert
    expect(draft).toMatchObject({ status: 'draft', version: 1 });
    expect(edited).toMatchObject({ title: 'Two or more', version: 2 });
    expect(published.publishedAt).not.toBeNull();
    expect(paused.pausedAt).not.toBeNull();
    expect(archived.archivedAt).not.toBeNull();
    expect(editError).toBeInstanceOf(InvalidOfferTransitionError);
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
    const listedInA1 = await admin.list(ctxA1, scopeOf(a, a.stores[0]));
    const readInA1 = await admin.get(ctxA1, scopeOf(a, a.stores[0]), offer.id);
    const listedInA2 = await admin.list(ctxA2, scopeOf(a, a.stores[1]));
    const listedInB = await admin.list(ctxB, scopeOf(b, b.stores[0]));
    const readInA2 = admin.get(ctxA2, scopeOf(a, a.stores[1]), offer.id);

    // Assert
    expect(listedInA1.map((listed) => listed.id)).toContain(offer.id);
    expect(readInA1.id).toBe(offer.id);
    expect(listedInA2.map((listed) => listed.id)).not.toContain(offer.id);
    expect(listedInB.map((listed) => listed.id)).not.toContain(offer.id);
    await expect(readInA2).rejects.toBeInstanceOf(OfferNotFoundError);
  });
});
