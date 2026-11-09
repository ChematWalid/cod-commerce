import { AUTH_ERROR_CODES, LOGO_MAX_BYTES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestAdministrator } from './create-test-administrator';
import { png, pngAtLimit, pngOverLimit, svg, textClaimingPng } from './image-fixtures';
import type { Caller } from './login-test-client';
import { createProfileTestKit } from './profile-test-kit';
import { codeOf, PASSWORD, uniqueEmail } from './register-test-kit';
import type { TestOwner } from './account-flow-kit';

const ASSET_NOT_AVAILABLE = 'tenancy.asset-not-available';
const UPDATE_BUSINESS = `mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { logoAssetId } }`;
const UPDATE_STORE = `mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { logoAssetId } }`;

const kit = createProfileTestKit();
const { client } = kit;

const assetIdOf = (answer: { data: Record<string, Record<string, unknown> | null> | null }): string =>
  String(answer.data?.['uploadBusinessLogo']?.['assetId']);

/** The owner's session on their own store, and that store's id. */
async function ownerOnStore(): Promise<{ owner: TestOwner; caller: Caller; storeId: string }> {
  const owner = await kit.owner();
  const caller = await kit.onStore(owner);
  const [store] = await kit.sql<{ id: string }>(
    `SELECT s."id" FROM "store" s JOIN "channel" c ON c."id" = s."channelId" WHERE c."token" = $1`,
    [caller.channelToken],
  );
  return { owner, caller, storeId: store?.id ?? '' };
}

async function channelsOfAsset(assetId: string): Promise<string[]> {
  const rows = await kit.sql<{ token: string }>(
    `SELECT c."token" FROM "asset_channels_channel" ac JOIN "channel" c ON c."id" = ac."channelId" WHERE ac."assetId" = $1`,
    [Number(assetId.replace(/^T_/, ''))],
  );
  return rows.map((row) => row.token);
}

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('uploadBusinessLogo limits', () => {
  it('accepts a logo of exactly the size limit', async () => {
    // Arrange
    const { caller } = await ownerOnStore();

    // Act
    const answer = await kit.uploadLogo(caller, pngAtLimit());

    // Assert
    expect(answer.errors).toEqual([]);
    expect(assetIdOf(answer)).toMatch(/^T_\d+$/);
  });

  it('refuses a logo one byte over the limit, and creates no asset', async () => {
    // Arrange
    const { caller } = await ownerOnStore();
    const before = await kit.sql<{ count: string }>('SELECT count(*) AS count FROM "asset"');

    // Act
    const answer = await kit.uploadLogo(caller, pngOverLimit());

    // Assert
    expect(LOGO_MAX_BYTES).toBe(5_242_880);
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.LOGO_TOO_LARGE);
    expect(await kit.sql('SELECT count(*) AS count FROM "asset"')).toEqual(before);
  });

  it.each([
    ['text that claims to be a PNG', textClaimingPng()],
    ['an SVG that claims to be a PNG', svg('image/png', 'logo.png')],
    ['an SVG that says so', svg()],
  ])('refuses %s', async (_label, file) => {
    // Arrange
    const { caller } = await ownerOnStore();

    // Act
    const answer = await kit.uploadLogo(caller, file);

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.LOGO_TYPE);
  });

  it('judges a logo by its bytes: a real PNG sent as text/plain with an odd name is accepted', async () => {
    // Arrange
    const { caller } = await ownerOnStore();

    // Act
    const answer = await kit.uploadLogo(caller, png('text/plain', 'logo.txt'));

    // Assert
    expect(answer.errors).toEqual([]);
  });
});

describe('uploadBusinessLogo access', () => {
  it('is FORBIDDEN for an anonymous caller', async () => {
    // Arrange / Act
    const answer = await kit.uploadLogo({}, png());

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });

  it('is FORBIDDEN for an owner whose request names no store of theirs', async () => {
    // Arrange
    const owner = await kit.owner();

    // Act
    const answer = await kit.uploadLogo(owner.session, png());

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });

  it('is FORBIDDEN for an owner naming the store channel of another business', async () => {
    // Arrange
    const a = await ownerOnStore();
    const b = await kit.owner();

    // Act
    const answer = await kit.uploadLogo({ ...b.session, channelToken: a.caller.channelToken ?? '' }, png());

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });

  it('is FORBIDDEN for a platform administrator, who belongs to no business', async () => {
    // Arrange
    const email = uniqueEmail();
    await createTestAdministrator(kit.adminClient, email, PASSWORD);
    const session = await kit.session(email);

    // Act
    const answer = await kit.uploadLogo(session, png());

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });
});

describe('a stored logo', () => {
  it("is on the active store's channel only, and updateBusiness and updateStore accept its id", async () => {
    // Arrange
    const { caller, storeId } = await ownerOnStore();

    // Act
    const assetId = assetIdOf(await kit.uploadLogo(caller, png()));
    const business = await client.graphql(UPDATE_BUSINESS, { input: { logoAssetId: assetId } }, caller);
    const store = await client.graphql(UPDATE_STORE, { id: storeId, input: { logoAssetId: assetId } }, caller);

    // Assert
    expect(await channelsOfAsset(assetId)).toEqual([caller.channelToken]);
    expect(business.errors).toEqual([]);
    expect(business.data?.['updateBusiness']).toEqual({ logoAssetId: assetId });
    expect(store.errors).toEqual([]);
    expect(store.data?.['updateStore']).toEqual({ logoAssetId: assetId });
  });

  it('cannot be attached by another business', async () => {
    // Arrange
    const a = await ownerOnStore();
    const b = await ownerOnStore();
    const assetOfA = assetIdOf(await kit.uploadLogo(a.caller, png()));

    // Act
    const business = await client.graphql(UPDATE_BUSINESS, { input: { logoAssetId: assetOfA } }, b.caller);
    const store = await client.graphql(UPDATE_STORE, { id: b.storeId, input: { logoAssetId: assetOfA } }, b.caller);

    // Assert
    expect(codeOf(business)).toBe(ASSET_NOT_AVAILABLE);
    expect(codeOf(store)).toBe(ASSET_NOT_AVAILABLE);
  });

  it('is not put on the channel of the business that did not upload it', async () => {
    // Arrange
    const a = await ownerOnStore();
    const b = await ownerOnStore();

    // Act
    const assetOfA = assetIdOf(await kit.uploadLogo(a.caller, png()));
    const assetOfB = assetIdOf(await kit.uploadLogo(b.caller, png()));

    // Assert
    expect(await channelsOfAsset(assetOfA)).toEqual([a.caller.channelToken]);
    expect(await channelsOfAsset(assetOfB)).toEqual([b.caller.channelToken]);
  });
});
