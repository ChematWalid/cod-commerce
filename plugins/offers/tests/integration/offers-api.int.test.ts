import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { PRICING_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { OFFER_FIELDS, type OfferResult, offersApiSuite } from './offers-api-kit';
import { aVariantIn, twoPieceOfferOn } from './offers-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 979;

const suite = offersApiSuite(SNOWFLAKE_WORKER_ID, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const CREATE = `mutation ($input: CreateOfferInput!) { createOffer(input: $input) { ${OFFER_FIELDS} } }`;
const PUBLISH = `mutation ($id: String!) { publishOffer(id: $id) { ${OFFER_FIELDS} } }`;
const RESUME = `mutation ($id: String!) { resumeOffer(id: $id) { id } }`;
const OFFERS = `query ($options: OfferListInput) { offers(options: $options) { totalItems items { ${OFFER_FIELDS} } } }`;
const STATS = 'query ($id: String!) { offerStats(id: $id) { orders deliveredRevenue discountGiven } }';
const PREVIEW = `query ($input: OfferPreviewInput!) {
  previewOffer(input: $input) { warnings scenarios { pieces addonAccepted quote } }
}`;

/** An offer id no store holds. */
const UNKNOWN_ID = '1399999999999999999';

/** A quantity draft of the owner of A's first store, on a fresh variant, created over GraphQL. */
async function aDraftOfA(): Promise<{ offer: OfferResult; productId: string; variantId: string }> {
  const store = suite.fixtures.a.stores[0];
  const { productId, variantId } = await aVariantIn(suite.server, store);
  await suite.kit.asOwner(suite.fixtures.a, store);
  const { createOffer } = await suite.kit.gql<{ createOffer: OfferResult }>(CREATE, {
    input: twoPieceOfferOn(variantId),
  });
  return { offer: createOffer, productId, variantId };
}

describe('the offers Admin API and REST routes (D2517-D2520)', () => {
  it('creates a draft over GraphQL and REST with status 201', async () => {
    // Arrange
    const { offer, variantId } = await aDraftOfA();

    // Act
    const rest = await suite.kit.rest('POST', '/offers', twoPieceOfferOn(variantId));

    // Assert
    expect(offer).toMatchObject({ kind: 'quantity', status: 'draft', version: 1, codeCount: 0, publishedAt: null });
    expect(offer).toMatchObject({ allowedMoves: ['publish', 'archive'], editable: true, deletable: true });
    expect(rest.status).toBe(201);
    expect(rest.body).toMatchObject({ kind: 'quantity', status: 'draft', title: 'Two pieces', deletable: true });
  });

  it('publishes and returns publishedAt', async () => {
    // Arrange
    const { offer } = await aDraftOfA();

    // Act
    const { publishOffer } = await suite.kit.gql<{ publishOffer: OfferResult }>(PUBLISH, { id: offer.id });

    // Assert
    expect(publishOffer.status).toBe('active');
    expect(publishOffer).toMatchObject({ allowedMoves: ['pause', 'archive'], editable: true, deletable: false });
    expect(publishOffer.publishedAt).not.toBeNull();
  });

  it('answers publish-invalid with the problem list', async () => {
    // Arrange
    const { offer } = await aDraftOfA();
    await suite.kit.rest('PATCH', `/offers/${offer.id}`, { targets: [] });

    // Act
    const rest = await suite.kit.rest('POST', `/offers/${offer.id}/publish`);
    const failure = await suite.kit.gql(PUBLISH, { id: offer.id }).catch((error: unknown) => error);

    // Assert
    expect(rest).toMatchObject({
      status: 422,
      body: { code: PRICING_ERROR_CODES.PUBLISH_INVALID, problems: ['targets'] },
    });
    expect(failure).toMatchObject({
      response: { errors: [{ extensions: { code: PRICING_ERROR_CODES.PUBLISH_INVALID, problems: ['targets'] } }] },
    });
  });

  it('resumeOffer on a draft answers invalid-transition', async () => {
    // Arrange
    const { offer } = await aDraftOfA();

    // Act
    const failure = await failureOf(suite.kit.gql(RESUME, { id: offer.id }));

    // Assert
    expect(failure.codes).toEqual([PRICING_ERROR_CODES.INVALID_TRANSITION]);
  });

  it('lists offers by product', async () => {
    // Arrange
    const { offer, productId } = await aDraftOfA();
    await aDraftOfA();

    // Act
    const { offers } = await suite.kit.gql<{ offers: { totalItems: number; items: OfferResult[] } }>(OFFERS, {
      options: { productId },
    });
    const rest = await suite.kit.rest('GET', `/offers?productId=${productId}&take=5`);

    // Assert
    expect(offers.totalItems).toBe(1);
    expect(offers.items.map((item) => item.id)).toEqual([offer.id]);
    expect(rest).toMatchObject({ status: 200, body: { totalItems: 1, items: [{ id: offer.id }] } });
  });

  it('generates codes over REST', async () => {
    // Arrange
    const { offer } = await aDraftOfA();
    await suite.kit.rest('PATCH', `/offers/${offer.id}`, { method: 'codes', version: offer.version });

    // Act
    const generated = await suite.kit.rest('POST', `/offers/${offer.id}/codes/generate`, {
      count: 3,
      prefix: 'EID',
      usageLimit: 2,
    });
    const listed = await suite.kit.rest('GET', `/offers/${offer.id}/codes`);
    const read = await suite.kit.rest('GET', `/offers/${offer.id}`);

    // Assert
    expect(generated.status).toBe(201);
    const codes = generated.body as { code: string; usageLimit: number | null }[];
    expect(codes).toHaveLength(3);
    expect(codes.every(({ code, usageLimit }) => code.startsWith('EID') && usageLimit === 2)).toBe(true);
    expect(listed.body).toHaveLength(3);
    expect(read.body).toMatchObject({ method: 'codes', codeCount: 3 });
  });

  it('returns zero stats before any order', async () => {
    // Arrange
    const { offer } = await aDraftOfA();

    // Act
    const { offerStats } = await suite.kit.gql<{ offerStats: unknown }>(STATS, { id: offer.id });
    const rest = await suite.kit.rest('GET', `/offers/${offer.id}/stats`);

    // Assert
    expect(offerStats).toEqual({ orders: 0, deliveredRevenue: 0, discountGiven: 0 });
    expect(rest).toMatchObject({ status: 200, body: { orders: 0, deliveredRevenue: 0, discountGiven: 0 } });
  });

  it('serves app types before the id route', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const rest = await suite.kit.rest('GET', '/offers/app-types');
    const { offerAppTypes } = await suite.kit.gql<{ offerAppTypes: { id: string }[] }>('{ offerAppTypes { id } }');

    // Assert
    expect(rest.status).toBe(200);
    expect(rest.body).toHaveLength(7);
    expect(offerAppTypes.map((appType) => appType.id)).toContain('discount_codes');
  });

  it('previews without writing a row', async () => {
    // Arrange
    const { variantId } = await aDraftOfA();
    const countRows = async () =>
      (await suite.kit.query<{ count: string }>('SELECT count(*) AS count FROM offers_offer'))[0]?.count;
    const before = await countRows();

    // Act
    const { previewOffer } = await suite.kit.gql<{ previewOffer: { scenarios: unknown[] } }>(PREVIEW, {
      input: { offer: twoPieceOfferOn(variantId), samplePrice: 4_900 },
    });
    const rest = await suite.kit.rest('POST', '/offers/preview', { offer: twoPieceOfferOn(variantId) });

    // Assert
    expect(previewOffer.scenarios.length).toBeGreaterThan(0);
    expect(rest.status).toBe(200);
    expect(await countRows()).toBe(before);
  });

  it('answers 404 for an unknown id', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const rest = await suite.kit.rest('GET', `/offers/${UNKNOWN_ID}`);
    const malformed = await suite.kit.rest('GET', '/offers/not-an-id/stats');
    const { offer } = await suite.kit.gql<{ offer: unknown }>('query ($id: String!) { offer(id: $id) { id } }', {
      id: UNKNOWN_ID,
    });

    // Assert
    expect(rest).toMatchObject({ status: 404, body: { code: PRICING_ERROR_CODES.OFFER_NOT_FOUND } });
    expect(malformed).toMatchObject({ status: 404, body: { code: PRICING_ERROR_CODES.OFFER_NOT_FOUND } });
    expect(offer).toBeNull();
  });

  it('answers Arabic error messages with Accept-Language ar', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const arabic = await suite.kit.rest('GET', `/offers/${UNKNOWN_ID}`, undefined, { 'accept-language': 'ar' });
    const english = await suite.kit.rest('GET', `/offers/${UNKNOWN_ID}`, undefined, { 'accept-language': 'en' });

    // Assert
    expect(arabic.body).toMatchObject({ message: 'العرض غير موجود.' });
    expect(english.body).toMatchObject({ message: 'Offer not found.' });
  });
});
