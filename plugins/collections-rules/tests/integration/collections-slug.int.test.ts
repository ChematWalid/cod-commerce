import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { codeOf, type CollectionResult, createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { SLUG_AVAILABILITY } from './collections-products';

const suite = collectionsSuite(1018, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** An Arabic slug with a letter NFD decomposes (alef with madda), typed in its composed form. */
const ARABIC_SLUG = 'آلات-موسيقية';

interface Availability {
  readonly slug: string;
  readonly available: boolean;
}

async function availability(slug: string, collectionId?: string): Promise<Availability> {
  const { storeCollectionSlugAvailability } = await suite.kit.gql<{ storeCollectionSlugAvailability: Availability }>(
    SLUG_AVAILABILITY,
    { slug, collectionId },
  );
  return storeCollectionSlugAvailability;
}

describe('collection slug availability (D2319)', () => {
  let arabic: CollectionResult;
  let latin: CollectionResult;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    arabic = await createCollection(suite.kit, { slug: ARABIC_SLUG });
    latin = await createCollection(suite.kit, { slug: 'summer-sale' });
  });

  it('reports an Arabic slug taken whatever its normal form', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const composed = await availability(ARABIC_SLUG.normalize('NFC'));
    const decomposed = await availability(ARABIC_SLUG.normalize('NFD'));

    // Assert
    expect(composed.available).toBe(false);
    expect(decomposed.available).toBe(false);
    expect(decomposed.slug).toBe(arabic.slug);
  });

  it('reports a slug taken whatever its case or spacing, over GraphQL and REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await availability('  Summer Sale ');
    const rest = await suite.kit.rest('GET', '/catalog/collections/slug-availability?slug=SUMMER-SALE');

    // Assert
    expect(answer).toEqual({ slug: 'summer-sale', available: false });
    expect(rest).toMatchObject({ status: 200, body: { slug: 'summer-sale', available: false } });
  });

  it("reports the edited collection's own slug available", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const overGraphql = await availability(latin.slug, latin.id);
    const overRest = await suite.kit.rest(
      'GET',
      `/catalog/collections/slug-availability?slug=${latin.slug}&collectionId=${rawId(latin.id)}`,
    );

    // Assert
    expect(overGraphql.available).toBe(true);
    expect(overRest).toMatchObject({ status: 200, body: { available: true } });
  });

  it("the same slug is available in B's store and in A's second store", async () => {
    // Arrange
    const { a, b } = suite.fixtures;

    // Act
    await suite.kit.asOwner(b);
    const inB = await availability(latin.slug);
    await suite.kit.asOwner(a, a.stores[1]);
    const inSecondStore = await availability(ARABIC_SLUG);

    // Assert
    expect(inB.available).toBe(true);
    expect(inSecondStore.available).toBe(true);
  });

  it('create refuses a taken slug, never adding a suffix', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const body = { title: 'Again', slug: ARABIC_SLUG.normalize('NFD'), visible: true, position: 0, mode: 'manual' };

    // Act
    const code = await codeOf(createCollection(suite.kit, { slug: latin.slug }));
    const rest = await suite.kit.rest('POST', '/catalog/collections', body);

    // Assert
    expect(code).toBe(COLLECTIONS_ERROR_CODES.SLUG_TAKEN);
    expect(rest).toMatchObject({ status: 409, body: { code: COLLECTIONS_ERROR_CODES.SLUG_TAKEN } });
  });

  it('refuses a blank slug with invalid-input', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const code = await codeOf(availability('   '));
    const rest = await suite.kit.rest('GET', '/catalog/collections/slug-availability?slug=');

    // Assert
    expect(code).toBe(COLLECTIONS_ERROR_CODES.INVALID_INPUT);
    expect(rest).toMatchObject({ status: 400, body: { code: COLLECTIONS_ERROR_CODES.INVALID_INPUT } });
  });
});
