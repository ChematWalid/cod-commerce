import { describe, expect, it } from 'vitest';
import { type BusinessView, CREATE_STORE, type StoreView, UPDATE_BUSINESS, UPDATE_STORE } from './admin-api-operations';
import { seedAsset } from './admin-api-session';
import { failureOf } from '@cod/testing';
import { useStoreApi } from './store-api-harness';

const ASSET_NOT_AVAILABLE = 'tenancy.asset-not-available';

describe('Logos come from the business that sets them', () => {
  const api = useStoreApi(1006);
  const { server, adminClient, asAlpha } = api;

  const bravoAsset = (): Promise<string> => seedAsset(server.app, api.bravo.store.channelId);
  const alphaAsset = (): Promise<string> => seedAsset(server.app, api.alpha.store.channelId);

  it('sets a store logo from the channel of the store', async () => {
    // Arrange
    const logoAssetId = await alphaAsset();
    await asAlpha();

    // Act
    const { updateStore } = await adminClient.query<{ updateStore: StoreView }>(UPDATE_STORE, {
      id: api.alpha.store.id,
      input: { logoAssetId },
    });

    // Assert
    expect(updateStore.logoAssetId).toBe(logoAssetId);
  });

  it('refuses a store logo that belongs to another business', async () => {
    // Arrange
    const logoAssetId = await bravoAsset();
    await asAlpha();

    // Act
    const failure = await failureOf(
      adminClient.query(UPDATE_STORE, { id: api.alpha.store.id, input: { logoAssetId } }),
    );

    // Assert
    expect(failure.codes).toEqual([ASSET_NOT_AVAILABLE]);
  });

  it('refuses a logo that does not exist', async () => {
    // Arrange
    await asAlpha();

    // Act
    const failure = await failureOf(
      adminClient.query(UPDATE_STORE, { id: api.alpha.store.id, input: { logoAssetId: 'T_999999' } }),
    );

    // Assert
    expect(failure.codes).toEqual([ASSET_NOT_AVAILABLE]);
  });

  it('opens a store with a logo the business owns, and refuses one it does not', async () => {
    // Arrange
    const own = await alphaAsset();
    const foreign = await bravoAsset();
    await asAlpha();
    const input = { name: 'logo store', language: 'ar' };

    // Act
    const { createStore } = await adminClient.query<{ createStore: StoreView }>(CREATE_STORE, {
      input: { ...input, subdomain: 'own-logo', logoAssetId: own },
    });
    const failure = await failureOf(
      adminClient.query(CREATE_STORE, { input: { ...input, subdomain: 'foreign-logo', logoAssetId: foreign } }),
    );

    // Assert
    expect(createStore.logoAssetId).toBe(own);
    expect(failure.codes).toEqual([ASSET_NOT_AVAILABLE]);
  });

  it('sets a business logo from any of its channels, and refuses another business asset', async () => {
    // Arrange
    const own = await alphaAsset();
    const foreign = await bravoAsset();
    await asAlpha();

    // Act
    const { updateBusiness } = await adminClient.query<{ updateBusiness: BusinessView }>(UPDATE_BUSINESS, {
      input: { logoAssetId: own },
    });
    const failure = await failureOf(adminClient.query(UPDATE_BUSINESS, { input: { logoAssetId: foreign } }));

    // Assert
    expect(updateBusiness.logoAssetId).toBe(own);
    expect(failure.codes).toEqual([ASSET_NOT_AVAILABLE]);
  });

  it('clears a store logo with null', async () => {
    // Arrange
    await asAlpha();

    // Act
    const { updateStore } = await adminClient.query<{ updateStore: StoreView }>(UPDATE_STORE, {
      id: api.alpha.store.id,
      input: { logoAssetId: null },
    });

    // Assert
    expect(updateStore.logoAssetId).toBeNull();
  });
});
