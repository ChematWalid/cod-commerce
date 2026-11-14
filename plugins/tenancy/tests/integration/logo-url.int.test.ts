import { TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { UPDATE_BUSINESS, UPDATE_STORE } from './admin-api-operations';
import { seedAsset } from './admin-api-session';
import { useStoreApi } from './store-api-harness';

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
    expect(activeBusiness.logoUrl).toContain('preview/');
    expect(store.logoUrl).toBe(activeBusiness.logoUrl);
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
