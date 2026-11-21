import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { COLLECTION, type CollectionResult, createCollection } from './collections-api';
import { collectionsWithSlug, IMAGE_CALLS, type ImageCall, uploadImage } from './collections-images';
import { collectionsSuite } from './collections-kit';

const suite = collectionsSuite(1018, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const IMAGE_NOT_FOUND = COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND;
const MALFORMED_IMAGE_IDS = ['abc', '-1', '99999999999999999999'];
/** Text no answer may carry: SQL, Vendure entity names and their not-found text, stacks (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /EntityNotFound/, /No Asset with/, /\s+at /];

/**
 * The test id strategy decodes a GraphQL `ID` with `Number`, so an id past the safe integers reaches the shared schema
 * as an unsafe number and is refused as invalid input before any read; every other malformed id is not found.
 */
const expectedFor = (call: string, id: string): string =>
  !call.includes('/') && !Number.isSafeInteger(Number(id)) && /^\d+$/.test(id)
    ? COLLECTIONS_ERROR_CODES.INVALID_INPUT
    : IMAGE_NOT_FOUND;

/** A slug unique to one case, so a refused create can be looked for. */
const slugOf = (prefix: string, name: string, extra = ''): string =>
  `${prefix}-${name}-${extra}`.replaceAll(/\W+/g, '-').toLowerCase();

describe('a collection image names an asset of the caller store only (D2320)', () => {
  let imageOfB: string;
  let imageOfFirstStore: string;
  let ofA: CollectionResult;
  let ofSecondStore: CollectionResult;

  beforeAll(async () => {
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    imageOfB = await uploadImage(suite.kit);
    await suite.kit.asOwner(a);
    imageOfFirstStore = await uploadImage(suite.kit);
    ofA = await createCollection(suite.kit, { title: 'A with image', featuredAssetId: imageOfFirstStore });
    await suite.kit.asOwner(a, a.stores[1]);
    ofSecondStore = await createCollection(suite.kit, { title: 'Second store' });
  });

  /** Calls `call`, checks it leaked nothing and made no collection with the slug, and returns its code. */
  async function refusalOf(
    call: ImageCall,
    target: CollectionResult,
    assetId: string,
    slug: string,
  ): Promise<string | undefined> {
    const outcome = await call(suite.kit, target, assetId, slug);
    for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
    expect(await collectionsWithSlug(suite.kit, slug)).toBe(0);
    return outcome.code;
  }

  /** The image `target` shows, read back by its own store. */
  async function imageOf(target: CollectionResult): Promise<string | undefined> {
    const { storeCollection } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: target.id,
    });
    return storeCollection?.featuredAsset?.id;
  }

  it.each(IMAGE_CALLS)("%s as A naming B's image answers image-not-found and writes nothing", async (name, call) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const code = await refusalOf(call, ofA, imageOfB, slugOf('borrowed', name));

    // Assert
    expect(code).toBe(IMAGE_NOT_FOUND);
    expect(await imageOf(ofA)).toBe(imageOfFirstStore);
  });

  it.each(IMAGE_CALLS)(
    "%s as A's second store naming the first store's image answers image-not-found",
    async (name, call) => {
      // Arrange
      const { a } = suite.fixtures;
      await suite.kit.asOwner(a, a.stores[1]);

      // Act
      const code = await refusalOf(call, ofSecondStore, imageOfFirstStore, slugOf('other-store', name));

      // Assert
      expect(code).toBe(IMAGE_NOT_FOUND);
      expect(await imageOf(ofSecondStore)).toBeUndefined();
    },
  );

  it.each(IMAGE_CALLS.flatMap(([name, call]) => MALFORMED_IMAGE_IDS.map((id) => [name, id, call] as const)))(
    '%s refuses the malformed image id "%s" and writes nothing',
    async (name, id, call) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const code = await refusalOf(call, ofA, id, slugOf('malformed', name, id));

      // Assert
      expect(code).toBe(expectedFor(name, id));
      expect(await imageOf(ofA)).toBe(imageOfFirstStore);
    },
  );

  it("B's own image stays usable by B (positive control)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const made = await createCollection(suite.kit, { featuredAssetId: imageOfB });

    // Assert
    expect(made.featuredAsset?.id).toBe(imageOfB);
  });
});
