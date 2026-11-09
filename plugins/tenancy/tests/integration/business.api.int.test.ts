import {
  createPluginTestEnvironment,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { TenancyPlugin } from '../../tenancy.plugin';
import {
  ACTIVE_BUSINESS,
  BUSINESS,
  type BusinessView,
  PROVISION_BUSINESS,
  UPDATE_BUSINESS,
} from './admin-api-operations';
import { actAsOwner } from './admin-api-session';
import { OWNER_PASSWORD, provisionBusiness, TEST_REDIS_URL, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

describe('Business Admin API', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1001 })],
    db: loadPluginTestDbConfig(process.env),
  });
  let alpha: ProvisionedBusiness;
  let bravo: ProvisionedBusiness;

  const asAlpha = (): Promise<void> => actAsOwner(server.app, adminClient, 'alpha', alpha.store.channelId);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    alpha = await provisionBusiness(server.app, 'alpha');
    bravo = await provisionBusiness(server.app, 'bravo');
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('returns the business of the logged-in owner', async () => {
    // Arrange
    await asAlpha();

    // Act
    const { activeBusiness } = await adminClient.query<{ activeBusiness: BusinessView }>(ACTIVE_BUSINESS);

    // Assert
    expect(activeBusiness).toEqual({ id: alpha.business.id, name: 'alpha SARL', logoAssetId: null, status: 'active' });
  });

  it('finds its own business by id and answers null for another business', async () => {
    // Arrange
    await asAlpha();

    // Act
    const own = await adminClient.query<{ business: BusinessView | null }>(BUSINESS, { id: alpha.business.id });
    const other = await adminClient.query<{ business: BusinessView | null }>(BUSINESS, { id: bravo.business.id });

    // Assert
    expect(own.business?.id).toBe(alpha.business.id);
    expect(other.business).toBeNull();
  });

  it('updates only the business of the caller', async () => {
    // Arrange
    await asAlpha();

    // Act
    const { updateBusiness } = await adminClient.query<{ updateBusiness: BusinessView }>(UPDATE_BUSINESS, {
      input: { name: 'alpha renamed' },
    });
    await actAsOwner(server.app, adminClient, 'bravo', bravo.store.channelId);
    const { activeBusiness } = await adminClient.query<{ activeBusiness: BusinessView }>(ACTIVE_BUSINESS);

    // Assert
    expect(updateBusiness.name).toBe('alpha renamed');
    expect(activeBusiness.name).toBe('bravo SARL');
  });

  it('refuses a blank business name with a typed error', async () => {
    // Arrange
    await asAlpha();

    // Act
    const failure = await failureOf(adminClient.query(UPDATE_BUSINESS, { input: { name: '   ' } }));

    // Assert
    expect(failure.codes).toEqual(['tenancy.name-invalid']);
  });

  it('lets the superadmin provision a business', async () => {
    // Arrange
    const input = {
      name: 'charlie SARL',
      owner: { emailAddress: 'charlie-owner@example.test', firstName: 'c', lastName: 'o', password: OWNER_PASSWORD },
      store: { name: 'charlie store', subdomain: 'charlie', language: 'fr' },
    };

    // Act
    const { provisionBusiness: result } = await adminClient.query<{
      provisionBusiness: { business: BusinessView; store: { id: string; subdomain: string } };
    }>(PROVISION_BUSINESS, { input });

    // Assert
    expect(result.business.name).toBe('charlie SARL');
    expect(result.store.subdomain).toBe('charlie');
  });

  it('forbids an owner from provisioning', async () => {
    // Arrange
    await asAlpha();
    const input = {
      name: 'nope',
      owner: { emailAddress: 'nope@example.test', firstName: 'n', lastName: 'o', password: OWNER_PASSWORD },
      store: { name: 'nope', subdomain: 'nope', language: 'fr' },
    };

    // Act
    const failure = await failureOf(adminClient.query(PROVISION_BUSINESS, { input }));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it.each([
    ['activeBusiness', ACTIVE_BUSINESS, {}],
    ['business', BUSINESS, { id: '1' }],
    ['updateBusiness', UPDATE_BUSINESS, { input: { name: 'x y' } }],
  ])('forbids %s without a tenant', async (_name, operation, variables) => {
    // Arrange: the superadmin on the default channel has every permission but no business.
    const superadminFailure = await failureOf(adminClient.query(operation, variables));

    // Act
    await adminClient.asAnonymousUser();
    const anonymousFailure = await failureOf(adminClient.query(operation, variables));

    // Assert
    expect(superadminFailure.codes).toEqual(['FORBIDDEN']);
    expect(anonymousFailure.codes).toEqual(['FORBIDDEN']);
  });
});
