import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { toBusinessId } from '@cod/shared';
import { RequestContextService, TransactionalConnection, User } from '@vendure/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProvisionBusinessService } from '../../application/provision-business.service';
import { CreateStoreService } from '../../application/create-store.service';
import type { TenantLifecycleRegistrar } from '../../application/tenant-lifecycle.registry';
import { TENANT_LIFECYCLE_REGISTRAR } from '../../application/tokens';
import { BusinessStoreDirectory } from '../../domain/ports/business-store-directory.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { TenantLifecycleHook } from '../../domain/ports/tenant-lifecycle.port';
import { BusinessOrderSequenceEntity } from '../../infrastructure/business-order-sequence.entity';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { StoreEntity } from '../../infrastructure/store.entity';
import { TenancyPlugin } from '../../tenancy.plugin';
import { TEST_REDIS_URL, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const OWNER_PASSWORD = 'synthetic-owner-password';

const commandFor = (slug: string): Parameters<ProvisionBusinessService['provision']>[1] => ({
  name: `${slug} SARL`,
  owner: { emailAddress: `${slug}-owner@example.test`, firstName: slug, lastName: 'Owner', password: OWNER_PASSWORD },
  store: { name: `${slug} store`, subdomain: slug, language: 'ar' },
});

describe('Tenant lifecycle hooks', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1000 })],
    db: loadPluginTestDbConfig(process.env),
  });

  const context = async (): Promise<ReturnType<typeof asOperationContext>> =>
    asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));

  const counts = async (): Promise<number[]> => {
    const connection = server.app.get(TransactionalConnection).rawConnection;
    const entities = [BusinessEntity, StoreEntity, BusinessOrderSequenceEntity, User, 'Administrator', 'Channel'];
    const tables = ['Seller', 'Role', 'AuthenticationMethod'];
    return Promise.all([...entities, ...tables].map((entity) => connection.getRepository(entity).count()));
  };

  /** Registered once on the shared registry; each test sets where it fails and the fields reset before it. */
  const probe = {
    failAt: undefined as 'businessProvisioned' | 'storeCreated' | undefined,
    businessEvents: [] as number[],
    storeEvents: [] as number[],
  };
  const probeHook: TenantLifecycleHook = {
    businessProvisioned: (_ctx, event) => {
      probe.businessEvents.push(event.ownerRoleId);
      return probe.failAt === 'businessProvisioned' ? Promise.reject(new Error('seeding failed')) : Promise.resolve();
    },
    storeCreated: (_ctx, event) => {
      probe.storeEvents.push(event.channelId);
      return probe.failAt === 'storeCreated' ? Promise.reject(new Error('seeding failed')) : Promise.resolve();
    },
  };

  beforeEach(() => {
    probe.failAt = undefined;
    probe.businessEvents.length = 0;
    probe.storeEvents.length = 0;
  });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    server.app.get<TenantLifecycleRegistrar>(TENANT_LIFECYCLE_REGISTRAR).register(probeHook);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('provisions past a hook that does not fail, and the directory reads the owner links', async () => {
    // Act
    const { business, store } = await server.app
      .get(ProvisionBusinessService)
      .provision(await context(), commandFor('hookless'));
    const directory = server.app.get(BusinessStoreDirectory);
    const stores = await directory.storesOf(await context(), toBusinessId(business.id));
    const page = await directory.allBusinessIds(await context(), undefined, 1000);

    // Assert
    expect(stores).toEqual([{ id: store.id, channelId: store.channelId, status: 'active' }]);
    expect(page).toContainEqual({
      id: business.id,
      ownerRoleId: business.ownerRoleId,
      ownerAdministratorId: business.ownerAdministratorId,
    });
    expect(await directory.allBusinessIds(await context(), business.id, 1000)).not.toContainEqual(
      expect.objectContaining({ id: business.id }),
    );
  });

  it('leaves nothing behind when a hook throws at businessProvisioned', async () => {
    // Arrange
    probe.failAt = 'businessProvisioned';
    const before = await counts();

    // Act
    const provisioning = server.app.get(ProvisionBusinessService).provision(await context(), commandFor('rolledback'));

    // Assert
    await expect(provisioning).rejects.toThrow('seeding failed');
    expect(probe.businessEvents).toHaveLength(1);
    expect(await counts()).toEqual(before);
  });

  it('leaves no store or channel behind when a hook throws at storeCreated', async () => {
    // Arrange
    const { business } = await server.app
      .get(ProvisionBusinessService)
      .provision(await context(), commandFor('opener'));
    probe.storeEvents.length = 0;
    probe.failAt = 'storeCreated';
    const before = await counts();

    // Act
    const creating = server.app
      .get(CreateStoreService)
      .create(await context(), business.id, { name: 'Second', subdomain: 'opener-two', language: 'ar' });

    // Assert
    await expect(creating).rejects.toThrow('seeding failed');
    expect(probe.storeEvents).toHaveLength(1);
    expect(await counts()).toEqual(before);
  });

  it('clamps the page size of allBusinessIds to at least one row', async () => {
    // Act
    const page = await server.app.get(BusinessStoreDirectory).allBusinessIds(await context(), undefined, 0);

    // Assert
    expect(page).toHaveLength(1);
  });
});
