import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, type StoreId } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OrderManagerCheck } from '../../index';
import { catalogSuite, PRODUCTS, rawId } from './catalog-kit';
import { createMedia, DELETE_MEDIA, MEDIA, type MediaResult, png, uploadAs } from './media-kit';

const suite = catalogSuite(1023, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = CATALOG_ERROR_CODES;

/**
 * Stands in for team's check (D2114, D2132), which this server does not run: the caller reaches the stores `reach`
 * names. Team's own answer is tested in plugins/team; here only what the catalog does with it.
 */
let reach: ReadonlySet<StoreId> | 'all' = 'all';
const teamCheck: OrderManagerCheck = {
  unknownIds: () => Promise.resolve([]),
  accessibleStoreIds: () => Promise.resolve(reach),
};

const listedIds = async (): Promise<string[]> =>
  (await suite.kit.gql<{ catalogMedia: { items: MediaResult[] } }>(MEDIA, {})).catalogMedia.items.map((m) => m.id);

describe('the media library across stores and businesses (AC7, D2132)', () => {
  let inFirst: MediaResult;
  let inSecond: MediaResult;

  beforeAll(async () => {
    suite.kit.registerOrderManagerCheck(teamCheck);
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    inFirst = await createMedia(suite.kit);
    await suite.kit.asOwner(a, a.stores[1]);
    inSecond = await createMedia(suite.kit);
  });

  it("lists it from the business's other store for the owner", async () => {
    // Arrange
    reach = 'all';
    await suite.kit.asOwner(suite.fixtures.a);

    // Act / Assert
    expect(await listedIds()).toEqual(expect.arrayContaining([inFirst.id, inSecond.id]));
  });

  it('never lists it for business B, over GraphQL or REST', async () => {
    // Arrange
    reach = 'all';
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const graphql = await listedIds();
    const rest = await suite.kit.rest('GET', '/catalog/media');

    // Assert
    expect(graphql).not.toContain(inFirst.id);
    expect(rest.text).not.toContain(inFirst.id);
    expect(rest.text).not.toContain(inSecond.id);
  });

  it("answers not found to B deleting A's media, and A's media survives", async () => {
    // Arrange
    reach = 'all';
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const answer = await suite.kit.rest('DELETE', `/catalog/media/${inFirst.id}`);

    // Assert
    expect([answer.status, (answer.body as { code?: string }).code]).toEqual([404, C.MEDIA_NOT_FOUND]);
    await suite.kit.asOwner(suite.fixtures.a);
    expect(await listedIds()).toContain(inFirst.id);
  });

  it("refuses B attaching A's media to a product as not found", async () => {
    // Arrange
    reach = 'all';
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const failure = await failureOf(suite.kit.createProduct({ title: 'Borrowed', assetIds: [inFirst.assetId] }));

    // Assert
    expect(failure.codes).toEqual([C.MEDIA_NOT_FOUND]);
  });

  it("attaching media of the other store to a product assigns it to the product's store", async () => {
    // Arrange
    reach = 'all';
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);

    // Act
    await suite.kit.createProduct({ title: 'Shows the other store image', featuredAssetId: inSecond.assetId });

    // Assert
    const rows = await suite.kit.query<{ token: string }>(
      `SELECT c."token" FROM "asset_channels_channel" ac JOIN "channel" c ON c."id" = ac."channelId"
       WHERE ac."assetId" = $1`,
      [Number(rawId(inSecond.assetId))],
    );
    expect(rows.map((row) => row.token).sort()).toEqual([a.stores[0].channelToken, a.stores[1].channelToken].sort());
  });

  it('refuses deleting media used by a product of the other store (D2128)', async () => {
    // Arrange: the previous test made a product of the first store show the second store's image
    reach = 'all';
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await suite.kit.rest('DELETE', `/catalog/media/${inSecond.id}`);

    // Assert
    expect((answer.body as { code?: string }).code).toBe(C.MEDIA_IN_USE);
  });

  it('deletes media from the other store of the business and leaves no asset', async () => {
    // Arrange
    reach = 'all';
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const unused = await createMedia(suite.kit);
    await suite.kit.asOwner(a);

    // Act
    await suite.kit.gql(DELETE_MEDIA, { id: unused.id });

    // Assert
    const assets = await suite.kit.query('SELECT 1 FROM "asset" WHERE "id" = $1', [Number(rawId(unused.assetId))]);
    expect(assets).toEqual([]);
  });

  it("a member with role on S1 only, with S1's token, neither sees nor deletes S2-only media", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.signInAsMember(a, ['catalog.products.view', 'catalog.products.edit'], [a.stores[0]]);
    reach = new Set([a.stores[0].id as StoreId]);

    // Act
    const listed = await listedIds();
    const deleting = await failureOf(suite.kit.gql(DELETE_MEDIA, { id: inSecond.id }));

    // Assert
    expect(listed).toContain(inFirst.id);
    expect(listed).not.toContain(inSecond.id);
    expect(deleting.codes).toEqual([C.MEDIA_NOT_FOUND]);
  });

  it("with S2's token gets FORBIDDEN on every catalog op", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.signInAsMember(a, ['catalog.products.view', 'catalog.products.edit'], [a.stores[0]]);
    suite.kit.client.setChannelToken(a.stores[1].channelToken);

    // Act
    const list = await failureOf(suite.kit.gql(MEDIA, {}));
    const products = await failureOf(suite.kit.gql(PRODUCTS, {}));
    const upload = await uploadAs(suite.kit, png());
    const remove = await suite.kit.rest('DELETE', `/catalog/media/${inSecond.id}`);

    // Assert
    expect([...list.codes, ...products.codes, upload.code]).toEqual(['FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN']);
    expect(remove.status).toBe(403);
  });
});
