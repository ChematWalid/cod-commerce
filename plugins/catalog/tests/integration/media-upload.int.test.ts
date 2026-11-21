import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RATE_LIMIT_POLICIES, RATE_LIMITED_CODE } from '@cod/plugin-rate-limit';
import { CATALOG_ERROR_CODES, MEDIA_MAX_BYTES } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogSuite, rawId } from './catalog-kit';
import { createMedia, DELETE_MEDIA, MEDIA, type MediaResult, PNG_1X1, png, uploadAs } from './media-kit';

const suite = catalogSuite(1022, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = CATALOG_ERROR_CODES;

/** How many asset and media rows exist, so a refusal can be shown to store nothing. */
async function rowCounts(): Promise<{ assets: string; media: string }> {
  const [row] = await suite.kit.query<{ assets: string; media: string }>(
    `SELECT (SELECT count(*) FROM "asset") AS assets, (SELECT count(*) FROM "catalog_media") AS media`,
  );
  return row ?? { assets: '', media: '' };
}

/** The tokens of the channels holding an asset. */
async function channelTokensOf(assetId: string): Promise<string[]> {
  const rows = await suite.kit.query<{ token: string }>(
    `SELECT c."token" FROM "asset_channels_channel" ac JOIN "channel" c ON c."id" = ac."channelId"
     WHERE ac."assetId" = $1`,
    [Number(rawId(assetId))],
  );
  return rows.map((row) => row.token).sort();
}

const listMedia = async () =>
  (await suite.kit.gql<{ catalogMedia: { totalItems: number; items: MediaResult[] } }>(MEDIA, {})).catalogMedia;

describe('uploadCatalogMedia (D2113, AC7)', () => {
  it('returns a url and lists it for the uploading business', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const media = await createMedia(suite.kit);

    // Assert
    expect(media).toMatchObject({ mimeType: 'image/png', assetId: expect.stringMatching(/^T_\d+$/) as string });
    expect(media.url).not.toBe('');
    expect((await listMedia()).items.map((item) => item.id)).toContain(media.id);
  });

  it.each([
    [
      'an html file named .png',
      { bytes: Buffer.from('<!doctype html><script>x</script>'), claimedType: 'image/png', name: 'a.png' },
      C.MEDIA_TYPE,
    ],
    [
      'an svg',
      { bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), claimedType: 'image/svg+xml', name: 'a.svg' },
      C.MEDIA_TYPE,
    ],
    ['an empty file', { bytes: Buffer.alloc(0), claimedType: 'image/png', name: 'a.png' }, C.MEDIA_TYPE],
    [
      'a jpeg one byte over the limit',
      {
        bytes: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(MEDIA_MAX_BYTES - 3)]),
        claimedType: 'image/jpeg',
        name: 'a.jpg',
      },
      C.MEDIA_TOO_LARGE,
    ],
  ])('refuses %s and stores nothing (Review Focus 2)', async (_name, file, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const before = await rowCounts();

    // Act
    const answer = await uploadAs(suite.kit, file);

    // Assert
    expect(answer.code).toBe(code);
    expect(await rowCounts()).toEqual(before);
  });

  it('stores a PNG named .jpg with a .png key and image/png mimetype', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const media = await createMedia(suite.kit, png('image/jpeg', 'holiday.jpg'));

    // Assert
    const [asset] = await suite.kit.query<{ source: string; mimeType: string }>(
      'SELECT "source", "mimeType" FROM "asset" WHERE "id" = $1',
      [Number(rawId(media.assetId))],
    );
    expect(asset?.mimeType).toBe('image/png');
    expect(asset?.source).toMatch(/\.png$/);
    expect(asset?.source).not.toContain('holiday');
  });

  it('removes the asset from the default channel', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);

    // Act
    const media = await createMedia(suite.kit);

    // Assert
    expect(await channelTokensOf(media.assetId)).toEqual([a.stores[0].channelToken]);
    expect(await channelTokensOf(media.assetId)).not.toContain(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  });

  it('refuses deleting media used by a product (D2128)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const media = await createMedia(suite.kit);
    await suite.kit.createProduct({ title: 'Uses the image', assetIds: [media.assetId] });

    // Act
    const answer = await suite.kit.rest('DELETE', `/catalog/media/${media.id}`);

    // Assert
    expect([answer.status, (answer.body as { code?: string }).code]).toEqual([409, C.MEDIA_IN_USE]);
    expect((await listMedia()).items.map((item) => item.id)).toContain(media.id);
  });

  it('deletes unused media and leaves no asset', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const media = await createMedia(suite.kit);

    // Act
    const answer = await suite.kit.gql<{ deleteCatalogMedia: boolean }>(DELETE_MEDIA, { id: media.id });

    // Assert
    expect(answer.deleteCatalogMedia).toBe(true);
    const assets = await suite.kit.query('SELECT 1 FROM "asset" WHERE "id" = $1', [Number(rawId(media.assetId))]);
    expect(assets).toEqual([]);
  });

  it('accepts exactly the size limit', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const atLimit = Buffer.concat([PNG_1X1, Buffer.alloc(MEDIA_MAX_BYTES - PNG_1X1.length)]);

    // Act
    const answer = await uploadAs(suite.kit, { bytes: atLimit, claimedType: 'image/png', name: 'big.png' });

    // Assert
    expect(answer.code).toBeUndefined();
  });

  it('answers 429 past the upload rate limit (D2138)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const attempts = RATE_LIMIT_POLICIES['catalog-media-actor'].capacity + 1;
    const codes: (string | undefined)[] = [];

    // Act
    for (let attempt = 0; attempt < attempts && !codes.includes(RATE_LIMITED_CODE); attempt += 1) {
      codes.push((await uploadAs(suite.kit, png())).code);
    }

    // Assert
    expect(codes.at(-1)).toBe(RATE_LIMITED_CODE);
    expect(codes.slice(0, -1).every((code) => code === undefined)).toBe(true);
  });
});
