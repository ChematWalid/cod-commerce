import { Asset, type AssetStorageStrategy, ConfigService, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { CREATE_STORE, type StoreView, UPDATE_BUSINESS, UPDATE_STORE } from './admin-api-operations';
import { seedAsset } from './admin-api-session';
import { useStoreApi } from './store-api-harness';

type AssetRequest = Parameters<NonNullable<AssetStorageStrategy['toAbsoluteUrl']>>[0];

const BUSINESS_LOGO = gql`
  query {
    activeBusiness {
      id
      logoUrl
    }
  }
`;

const STORE_LOGO = gql`
  query ($id: String!) {
    store(id: $id) {
      id
      logoUrl
    }
  }
`;

interface LogoView {
  readonly id: string;
  readonly logoUrl: string | null;
}

/** The engine id behind a `T_n` id of the testing id strategy. */
const engineId = (encoded: string): number => Number(encoded.replace(/^T_/, ''));

describe('logoUrl is resolved only for an asset of the business', () => {
  const api = useStoreApi(1015);
  const { server, adminClient, asAlpha } = api;
  const businesses = () => server.app.get(TransactionalConnection).rawConnection.getRepository(BusinessEntity);

  /** The URL the configured storage strategy gives `assetId`'s preview: what a browser loads, not the raw key. */
  async function absolutePreviewUrl(assetId: number): Promise<string> {
    const { preview } = await server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(Asset)
      .findOneByOrFail({ id: assetId });
    const storage = server.app.get(ConfigService).assetOptions.assetStorageStrategy;
    if (storage.toAbsoluteUrl === undefined) throw new Error('the storage strategy gives no absolute URLs');
    // The testing strategy ignores the request; a real one reads its host from it.
    const absolute = storage.toAbsoluteUrl({} as AssetRequest, preview);
    expect(absolute).not.toBe(preview);
    return absolute;
  }

  it("returns a url for the business's own logo", async () => {
    // Arrange
    const logoAssetId = await seedAsset(server.app, api.alpha.store.channelId);
    await asAlpha();
    await adminClient.query(UPDATE_BUSINESS, { input: { logoAssetId } });
    await adminClient.query(UPDATE_STORE, { id: api.alpha.store.id, input: { logoAssetId } });

    // Act
    const { activeBusiness } = await adminClient.query<{ activeBusiness: LogoView }>(BUSINESS_LOGO);
    const { store } = await adminClient.query<{ store: LogoView }>(STORE_LOGO, { id: api.alpha.store.id });

    // Assert
    expect(activeBusiness.logoUrl).toBe(await absolutePreviewUrl(engineId(logoAssetId)));
    expect(store.logoUrl).toBe(activeBusiness.logoUrl);
  });

  it("returns a url for a store opened with a logo from a sibling store's channel", async () => {
    // Arrange
    const logoAssetId = await seedAsset(server.app, api.alpha.store.channelId);
    await asAlpha();
    const { createStore } = await adminClient.query<{ createStore: StoreView }>(CREATE_STORE, {
      input: { name: 'logo at create', language: 'ar', subdomain: 'logo-at-create', logoAssetId },
    });

    // Act
    const { store } = await adminClient.query<{ store: LogoView }>(STORE_LOGO, { id: createStore.id });

    // Assert
    expect(store.logoUrl).toBe(await absolutePreviewUrl(engineId(logoAssetId)));
  });

  it('returns null for an asset of business B', async () => {
    // Arrange: rows that name B's asset, as only a direct database write could make them (the API refuses it).
    const foreign = engineId(await seedAsset(server.app, api.bravo.store.channelId));
    await businesses().update({ id: api.alpha.business.id }, { logoAssetId: foreign });
    await api.rows().update({ id: api.alpha.store.id }, { logoAssetId: foreign });
    await asAlpha();

    // Act
    const { activeBusiness } = await adminClient.query<{ activeBusiness: LogoView }>(BUSINESS_LOGO);
    const { store } = await adminClient.query<{ store: LogoView }>(STORE_LOGO, { id: api.alpha.store.id });

    // Assert
    expect(activeBusiness.logoUrl).toBeNull();
    expect(store.logoUrl).toBeNull();
  });

  it('returns null when no logo is set', async () => {
    // Arrange
    await businesses().update({ id: api.alpha.business.id }, { logoAssetId: null });
    await asAlpha();

    // Act
    const { activeBusiness } = await adminClient.query<{ activeBusiness: LogoView }>(BUSINESS_LOGO);

    // Assert
    expect(activeBusiness.logoUrl).toBeNull();
  });
});
