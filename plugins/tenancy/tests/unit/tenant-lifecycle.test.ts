import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CreateStoreService } from '../../application/create-store.service';
import { ProvisionBusinessService } from '../../application/provision-business.service';
import { TenantLifecycleRegistry } from '../../application/tenant-lifecycle.registry';
import type { Business } from '../../domain/business';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import {
  FakeChannelProvisioner,
  InMemoryPlatformStore,
  openAssets,
  RecordingLifecycleHook,
  SequentialIdGenerator,
} from '../fakes/fakes';

const ctx = asOperationContext({});
const NOW = new Date('2026-11-08T10:00:00Z');
const BUSINESS_ID = toSnowflake('100');
const OWNER = { emailAddress: 'owner@example.test', firstName: 'Amina', lastName: 'B', password: 'synthetic-pass' };
const STORE = { name: 'Atlas', subdomain: 'atlas', language: 'fr' };
const EXISTING: Business = {
  id: BUSINESS_ID,
  name: 'Atlas SARL',
  logoAssetId: null,
  onboardingState: {},
  ownerAdministratorId: 60,
  sellerId: 7,
  ownerRoleId: 8,
  planId: null,
  status: 'active',
  createdAt: NOW,
};

function setUp(journal: string[]): {
  registry: TenantLifecycleRegistry;
  provision: ProvisionBusinessService;
  stores: CreateStoreService;
} {
  const registry = new TenantLifecycleRegistry();
  // Like Vendure's, a transaction started inside another joins it: only the outermost one commits.
  let depth = 0;
  const transaction: TransactionPort = {
    run: async (inner, work) => {
      depth += 1;
      if (depth === 1) journal.push('begin');
      try {
        const result = await work(inner);
        if (depth === 1) journal.push('commit');
        return result;
      } finally {
        depth -= 1;
      }
    },
  };
  const platform = new InMemoryPlatformStore();
  platform.businesses.set(BUSINESS_ID, EXISTING);
  const ports = {
    channels: new FakeChannelProvisioner(),
    platform,
    transaction,
    ids: new SequentialIdGenerator('200'),
    assets: openAssets,
    lifecycle: registry,
    clock: (): Date => NOW,
  };
  const stores = new CreateStoreService(ports);
  return { registry, provision: new ProvisionBusinessService(ports, stores), stores };
}

describe('tenant lifecycle hooks', () => {
  it('runs the store hook, then the business hook, in registration order inside the transaction', async () => {
    // Arrange
    const journal: string[] = [];
    const { registry, provision } = setUp(journal);
    registry.register(new RecordingLifecycleHook('first', journal));
    registry.register(new RecordingLifecycleHook('second', journal));

    // Act
    const { business, store } = await provision.provision(ctx, { name: 'Atlas SARL', owner: OWNER, store: STORE });

    // Assert
    const storeEvent = `store:${store.id}:${String(store.channelId)}`;
    const businessEvent = `business:${business.id}:80:60`;
    expect(journal.filter((entry) => entry !== 'begin' && entry !== 'commit')).toEqual([
      `first:${storeEvent}`,
      `second:${storeEvent}`,
      `first:${businessEvent}`,
      `second:${businessEvent}`,
    ]);
    expect(journal.at(-1)).toBe('commit');
    expect(journal.indexOf('commit')).toBe(journal.length - 1);
  });

  it('reports a store opened later with its channel', async () => {
    // Arrange
    const journal: string[] = [];
    const { registry, stores } = setUp(journal);
    registry.register(new RecordingLifecycleHook('only', journal));

    // Act
    const store = await stores.create(ctx, BUSINESS_ID, STORE);

    // Assert
    expect(journal).toEqual(['begin', `only:store:${store.id}:91`, 'commit']);
  });

  it('rejects provisioning when the business hook throws', async () => {
    // Arrange
    const journal: string[] = [];
    const { registry, provision } = setUp(journal);
    registry.register(new RecordingLifecycleHook('broken', journal, 'businessProvisioned'));

    // Act
    const provisioning = provision.provision(ctx, { name: 'Atlas SARL', owner: OWNER, store: STORE });

    // Assert
    await expect(provisioning).rejects.toThrow('broken failed');
    expect(journal).not.toContain('commit');
  });

  it('rejects store creation when the store hook throws, and skips the hooks after it', async () => {
    // Arrange
    const journal: string[] = [];
    const { registry, stores } = setUp(journal);
    registry.register(new RecordingLifecycleHook('broken', journal, 'storeCreated'));
    registry.register(new RecordingLifecycleHook('after', journal));

    // Act
    const creating = stores.create(ctx, BUSINESS_ID, STORE);

    // Assert
    await expect(creating).rejects.toThrow('broken failed');
    expect(journal.some((entry) => entry.startsWith('after:'))).toBe(false);
    expect(journal).not.toContain('commit');
  });

  it('provisions and creates stores with no hook registered', async () => {
    // Arrange
    const { provision, stores } = setUp([]);

    // Act
    const created = await provision.provision(ctx, { name: 'Atlas SARL', owner: OWNER, store: STORE });
    const extra = await stores.create(ctx, BUSINESS_ID, { ...STORE, subdomain: 'atlas-two' });

    // Assert
    expect(created.store.subdomain).toBe('atlas');
    expect(extra.subdomain).toBe('atlas-two');
  });

  it('ignores the same hook registered twice', async () => {
    // Arrange
    const journal: string[] = [];
    const { registry, stores } = setUp(journal);
    const hook = new RecordingLifecycleHook('once', journal);
    registry.register(hook);
    registry.register(hook);

    // Act
    await stores.create(ctx, BUSINESS_ID, STORE);

    // Assert
    expect(journal.filter((entry) => entry.startsWith('once:'))).toHaveLength(1);
  });
});
