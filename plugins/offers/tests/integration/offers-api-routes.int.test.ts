import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { OFFER_PAGE_MAX, PRICING_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { OFFER_FIELDS, type OfferResult, offersApiSuite } from './offers-api-kit';
import { aVariantIn, twoPieceOfferOn } from './offers-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 974;

const suite = offersApiSuite(SNOWFLAKE_WORKER_ID, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const CREATE = `mutation ($input: CreateOfferInput!) { createOffer(input: $input) { ${OFFER_FIELDS} } }`;
const UPDATE = `mutation ($id: String!, $input: UpdateOfferInput!, $version: Int) {
  updateOffer(id: $id, input: $input, version: $version) { ${OFFER_FIELDS} }
}`;
const moveOf = (name: string) => `mutation ($id: String!) { ${name}(id: $id) { ${OFFER_FIELDS} } }`;
const DELETE = 'mutation ($id: String!) { deleteOffer(id: $id) }';
const READ = 'query ($id: String!) { offer(id: $id) { id } }';
const CODE_FIELDS = 'id offerId code usageLimit usageCount createdAt';
const ADD_CODES = `mutation ($offerId: String!, $codes: [OfferCodeInput!]!) {
  addOfferCodes(offerId: $offerId, codes: $codes) { ${CODE_FIELDS} }
}`;
const GENERATE_CODES = `mutation ($offerId: String!, $input: GenerateOfferCodesInput!) {
  generateOfferCodes(offerId: $offerId, input: $input) { ${CODE_FIELDS} }
}`;
const CODES = `query ($offerId: String!) { offerCodes(offerId: $offerId) { ${CODE_FIELDS} } }`;
const REMOVE_CODE = 'mutation ($offerId: String!, $code: String!) { removeOfferCode(offerId: $offerId, code: $code) }';

/** A code as the API tests read it. */
interface CodeResult {
  readonly code: string;
  readonly usageLimit: number | null;
}

/** A quantity draft of the owner of A's first store, on a fresh variant, created over GraphQL. */
async function aDraftOfA(method: 'automatic' | 'codes' = 'automatic'): Promise<OfferResult> {
  const store = suite.fixtures.a.stores[0];
  const { variantId } = await aVariantIn(suite.server, store);
  await suite.kit.asOwner(suite.fixtures.a, store);
  const input = { ...twoPieceOfferOn(variantId), method };
  return (await suite.kit.gql<{ createOffer: OfferResult }>(CREATE, { input })).createOffer;
}

/** Runs the lifecycle mutation `name` on `id` over GraphQL. */
async function moved(name: string, id: string): Promise<OfferResult> {
  return (await suite.kit.gql<Record<string, OfferResult>>(moveOf(name), { id }))[name] as OfferResult;
}

describe('the offers lifecycle over GraphQL and REST (D2510, D2511, D2521)', () => {
  it('updates an offer over GraphQL, a null on a field that cannot be null keeping the stored value', async () => {
    // Arrange
    const offer = await aDraftOfA('codes');

    // Act
    const { updateOffer } = await suite.kit.gql<{ updateOffer: OfferResult }>(UPDATE, {
      id: offer.id,
      input: { title: 'Renamed', method: null, label: null, targets: null },
      version: offer.version,
    });

    // Assert
    expect(updateOffer).toMatchObject({ title: 'Renamed', method: 'codes', version: offer.version + 1 });
  });

  it('stores a target sent with a null role as a buy target', async () => {
    // Arrange
    const store = suite.fixtures.a.stores[0];
    const { variantId } = await aVariantIn(suite.server, store);
    await suite.kit.asOwner(suite.fixtures.a, store);
    const targets = [{ role: null, refType: 'variant', refId: variantId }];

    // Act
    const { createOffer } = await suite.kit.gql<{ createOffer: { targets: unknown[] } }>(CREATE, {
      input: { ...twoPieceOfferOn(variantId), targets },
    });

    // Assert
    expect(createOffer.targets).toEqual([{ role: 'buy', refType: 'variant', refId: variantId }]);
  });

  it('pauses, resumes, archives, duplicates and deletes over GraphQL', async () => {
    // Arrange
    const offer = await aDraftOfA();
    await moved('publishOffer', offer.id);

    // Act
    const paused = await moved('pauseOffer', offer.id);
    const resumed = await moved('resumeOffer', offer.id);
    const copy = await moved('duplicateOffer', offer.id);
    const archived = await moved('archiveOffer', offer.id);
    const { deleteOffer } = await suite.kit.gql<{ deleteOffer: boolean }>(DELETE, { id: copy.id });
    const { offer: deletedRead } = await suite.kit.gql<{ offer: unknown }>(READ, { id: copy.id });

    // Assert
    expect([paused.status, resumed.status, archived.status]).toEqual(['paused', 'active', 'archived']);
    expect(copy).toMatchObject({ status: 'draft', publishedAt: null, codeCount: 0 });
    expect(deleteOffer).toBe(true);
    expect(deletedRead).toBeNull();
  });

  it('pauses, resumes, archives with 200, duplicates with 201 and deletes a draft over REST', async () => {
    // Arrange
    const offer = await aDraftOfA();
    await suite.kit.rest('POST', `/offers/${offer.id}/publish`);

    // Act
    const paused = await suite.kit.rest('POST', `/offers/${offer.id}/pause`);
    const resumed = await suite.kit.rest('POST', `/offers/${offer.id}/resume`);
    const copy = await suite.kit.rest('POST', `/offers/${offer.id}/duplicate`);
    const archived = await suite.kit.rest('POST', `/offers/${offer.id}/archive`);
    const copyId = (copy.body as { id: string }).id;
    const deleted = await suite.kit.rest('DELETE', `/offers/${copyId}`);
    const deletedRead = await suite.kit.rest('GET', `/offers/${copyId}`);

    // Assert
    expect(paused).toMatchObject({ status: 200, body: { status: 'paused' } });
    expect(resumed).toMatchObject({ status: 200, body: { status: 'active' } });
    expect(copy).toMatchObject({ status: 201, body: { status: 'draft', publishedAt: null } });
    expect(archived).toMatchObject({ status: 200, body: { status: 'archived' } });
    expect(deleted).toEqual({ status: 200, body: { success: true } });
    expect(deletedRead.status).toBe(404);
  });

  it('refuses to delete a published offer with 409 offer-not-deletable', async () => {
    // Arrange
    const offer = await aDraftOfA();
    await moved('publishOffer', offer.id);

    // Act
    const rest = await suite.kit.rest('DELETE', `/offers/${offer.id}`);
    const failure = await failureOf(suite.kit.gql(DELETE, { id: offer.id }));

    // Assert
    expect(rest).toMatchObject({ status: 409, body: { code: PRICING_ERROR_CODES.OFFER_NOT_DELETABLE } });
    expect(failure.codes).toEqual([PRICING_ERROR_CODES.OFFER_NOT_DELETABLE]);
  });
});

describe('the offer codes over GraphQL and REST (D2406, D2512)', () => {
  it('adds, generates, lists and removes codes over GraphQL', async () => {
    // Arrange
    const offer = await aDraftOfA('codes');

    // Act
    const { addOfferCodes } = await suite.kit.gql<{ addOfferCodes: CodeResult[] }>(ADD_CODES, {
      offerId: offer.id,
      codes: [{ code: 'eid10', usageLimit: 3 }, { code: 'SUMMER' }],
    });
    const { generateOfferCodes } = await suite.kit.gql<{ generateOfferCodes: CodeResult[] }>(GENERATE_CODES, {
      offerId: offer.id,
      input: { count: 2, prefix: 'VIP' },
    });
    const removed = await suite.kit.gql<{ removeOfferCode: boolean }>(REMOVE_CODE, {
      offerId: offer.id,
      code: 'eid10',
    });
    const absent = await suite.kit.gql<{ removeOfferCode: boolean }>(REMOVE_CODE, { offerId: offer.id, code: 'NOPE1' });
    const { offerCodes } = await suite.kit.gql<{ offerCodes: CodeResult[] }>(CODES, { offerId: offer.id });

    // Assert
    expect(addOfferCodes).toMatchObject([
      { code: 'EID10', usageLimit: 3 },
      { code: 'SUMMER', usageLimit: null },
    ]);
    expect(generateOfferCodes.every(({ code }) => code.startsWith('VIP'))).toBe(true);
    expect([removed.removeOfferCode, absent.removeOfferCode]).toEqual([true, false]);
    expect(offerCodes.map(({ code }) => code)).toEqual(['SUMMER', ...generateOfferCodes.map(({ code }) => code)]);
  });

  it('adds codes with 201 and removes one with its success over REST', async () => {
    // Arrange
    const offer = await aDraftOfA('codes');

    // Act
    const added = await suite.kit.rest('POST', `/offers/${offer.id}/codes`, { codes: [{ code: 'RAMADAN' }] });
    const removed = await suite.kit.rest('DELETE', `/offers/${offer.id}/codes/RAMADAN`);
    const absent = await suite.kit.rest('DELETE', `/offers/${offer.id}/codes/RAMADAN`);
    const listed = await suite.kit.rest('GET', `/offers/${offer.id}/codes`);

    // Assert
    expect(added).toMatchObject({ status: 201, body: [{ code: 'RAMADAN', usageCount: 0 }] });
    expect(removed).toEqual({ status: 200, body: { success: true } });
    expect(absent).toEqual({ status: 200, body: { success: false } });
    expect(listed).toEqual({ status: 200, body: [] });
  });
});

describe('the offers API refusals of bad input (D2520)', () => {
  it('answers 400 invalid-request for a page larger than OFFER_PAGE_MAX', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const rest = await suite.kit.rest('GET', `/offers?take=${String(OFFER_PAGE_MAX + 1)}`);
    const failure = await failureOf(
      suite.kit.gql('query ($options: OfferListInput) { offers(options: $options) { totalItems } }', {
        options: { take: OFFER_PAGE_MAX + 1 },
      }),
    );

    // Assert
    expect(rest).toMatchObject({ status: 400, body: { code: PRICING_ERROR_CODES.INVALID_REQUEST } });
    expect(failure.codes).toEqual([PRICING_ERROR_CODES.INVALID_REQUEST]);
  });

  it('answers 400 invalid-config for an offer with a bad config', async () => {
    // Arrange
    const store = suite.fixtures.a.stores[0];
    const { variantId } = await aVariantIn(suite.server, store);
    await suite.kit.asOwner(suite.fixtures.a, store);
    const input = { ...twoPieceOfferOn(variantId), config: { priceMode: 'percent', tiers: [] } };

    // Act
    const rest = await suite.kit.rest('POST', '/offers', input);
    const failure = await failureOf(suite.kit.gql(CREATE, { input }));

    // Assert
    expect(rest).toMatchObject({ status: 400, body: { code: PRICING_ERROR_CODES.INVALID_CONFIG } });
    expect(failure.codes).toEqual([PRICING_ERROR_CODES.INVALID_CONFIG]);
  });
});
