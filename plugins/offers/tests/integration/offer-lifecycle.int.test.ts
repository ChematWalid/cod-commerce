import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OfferAdminService } from '../../application/offer-admin.service';
import { OfferLifecycleService } from '../../application/offer-lifecycle.service';
import { InvalidOfferTransitionError, OfferNotDeletableError, OfferPublishInvalidError } from '../../domain/errors';
import { aVariantIn, offersTestEnvironment, scopeOf, storeContext, twoPieceOfferOn } from './offers-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 978;

const { server, adminClient } = offersTestEnvironment(SNOWFLAKE_WORKER_ID, 'test-offers-lifecycle');

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

describe('OfferLifecycleService on a real database (D2510, D2511, D2521)', () => {
  it('publishes, pauses, resumes and archives over the service and refuses edits after archive', async () => {
    // Arrange
    const store = fixtures.a.stores[0];
    const scope = scopeOf(fixtures.a, store);
    const ctx = await storeContext(server, store);
    const admin = server.app.get(OfferAdminService);
    const lifecycle = server.app.get(OfferLifecycleService);
    const { variantId } = await aVariantIn(server, store);
    const draft = await admin.createDraft(ctx, scope, twoPieceOfferOn(variantId));

    // Act
    const published = await lifecycle.publish(ctx, scope, draft.id);
    const paused = await lifecycle.pause(ctx, scope, draft.id);
    const resumed = await lifecycle.resume(ctx, scope, draft.id);
    const deleteRefusal = await admin.delete(ctx, scope, draft.id).catch((error: unknown) => error);
    const archived = await lifecycle.archive(ctx, scope, draft.id);
    const editRefusal = await admin.update(ctx, scope, draft.id, { title: 'Late' }).catch((error: unknown) => error);
    const publishRefusal = await lifecycle.publish(ctx, scope, draft.id).catch((error: unknown) => error);
    const copy = await lifecycle.duplicate(ctx, scope, draft.id);

    // Assert
    expect(published).toMatchObject({ status: 'active', version: 2 });
    expect(paused).toMatchObject({ status: 'paused', publishedAt: published.publishedAt });
    expect(resumed).toMatchObject({ status: 'active', pausedAt: null, publishedAt: published.publishedAt });
    expect(deleteRefusal).toBeInstanceOf(OfferNotDeletableError);
    expect(archived.status).toBe('archived');
    expect(editRefusal).toBeInstanceOf(InvalidOfferTransitionError);
    expect(publishRefusal).toBeInstanceOf(InvalidOfferTransitionError);
    await expect(admin.get(ctx, scope, draft.id)).resolves.toEqual(archived);
    expect(copy).toMatchObject({ status: 'draft', version: 1, publishedAt: null, targets: archived.targets });
  });

  it('keeps an incomplete draft unpublished and lists it with its code count', async () => {
    // Arrange
    const store = fixtures.b.stores[0];
    const scope = scopeOf(fixtures.b, store);
    const ctx = await storeContext(server, store);
    const admin = server.app.get(OfferAdminService);
    const { productId, variantId } = await aVariantIn(server, store);
    const draft = await admin.createDraft(ctx, scope, { ...twoPieceOfferOn(variantId), method: 'codes', targets: [] });
    await admin.addCodes(ctx, scope, draft.id, [{ code: 'LIFE10' }]);

    // Act
    const refusal = await admin.publish(ctx, scope, draft.id).catch((error: unknown) => error);
    await admin.update(ctx, scope, draft.id, { targets: [{ refType: 'variant', refId: variantId }] });
    const byProduct = await admin.list(ctx, scope, { productId });

    // Assert
    expect(refusal).toBeInstanceOf(OfferPublishInvalidError);
    expect(refusal).toMatchObject({ problems: ['targets'] });
    expect(byProduct.items.map((offer) => [offer.id, offer.status, offer.codeCount])).toEqual([[draft.id, 'draft', 1]]);
  });
});
