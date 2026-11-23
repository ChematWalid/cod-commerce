import { type BusinessId, type StoreId, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ArchiveStoreService } from '../../application/archive-store.service';
import { ChangeSubdomainService } from '../../application/change-subdomain.service';
import type { StoreAdminPorts } from '../../application/store-admin-ports';
import { TenantLifecycleRegistry } from '../../application/tenant-lifecycle.registry';
import { UpdateStoreService } from '../../application/update-store.service';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { StoreChangedEvent, TenantLifecycleHook } from '../../domain/ports/tenant-lifecycle.port';
import type { StoreWrite, TenantStoresPort } from '../../domain/ports/tenant-stores.port';
import { newStore, type Store, type StoreActor } from '../../domain/store';
import {
  FakeChannelProvisioner,
  InMemoryPlatformStore,
  journalingTransaction,
  openAssets,
  RecordingHostInvalidator,
  SequentialIdGenerator,
} from '../fakes/fakes';

const ctx = asOperationContext({});
const NOW = new Date('2026-11-22T10:00:00Z');
const BUSINESS_ID: BusinessId = toBusinessId('100');
const STORE_ID: StoreId = toStoreId(toSnowflake('500'));
const OTHER_STORE_ID: StoreId = toStoreId(toSnowflake('501'));
const ACTOR: StoreActor = { businessId: BUSINESS_ID, channelIds: [9, 10] };

const storeOf = (id: StoreId, channelId: number, subdomain: string): Store =>
  newStore({
    id,
    businessId: toSnowflake(BUSINESS_ID),
    channelId,
    sellerId: 7,
    subdomain,
    input: { name: 'Atlas', subdomain, language: 'ar' },
    now: NOW,
  });

/** The business's stores in memory; every write lands in the journal so a test can order it against the commit. */
class JournalingStores implements TenantStoresPort {
  readonly rows = new Map<string, Store>();

  constructor(private readonly journal: string[]) {}

  list(): Promise<readonly Store[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  find(_ctx: OperationContext, _businessId: BusinessId, id: StoreId): Promise<Store | undefined> {
    return Promise.resolve(this.rows.get(id));
  }

  countActive(): Promise<number> {
    return Promise.resolve([...this.rows.values()].filter((store) => store.status === 'active').length);
  }

  update(_ctx: OperationContext, _businessId: BusinessId, id: StoreId, write: StoreWrite): Promise<void> {
    const store = this.rows.get(id);
    if (store !== undefined) this.rows.set(id, { ...store, ...write });
    this.journal.push('write');
    return Promise.resolve();
  }
}

/** A hook that records every store change into the journal, and throws when told to. */
class StoreChangeProbe implements TenantLifecycleHook {
  readonly events: StoreChangedEvent[] = [];

  constructor(
    private readonly journal: string[],
    private readonly fail = false,
  ) {}

  businessProvisioned(): Promise<void> {
    return Promise.resolve();
  }

  storeCreated(): Promise<void> {
    return Promise.resolve();
  }

  storeChanged(_ctx: OperationContext, event: StoreChangedEvent): Promise<void> {
    this.events.push(event);
    this.journal.push(`store-changed:${event.change}`);
    return this.fail ? Promise.reject(new Error('the outbox write failed')) : Promise.resolve();
  }
}

function setUp(options: { fail?: boolean } = {}) {
  const journal: string[] = [];
  const registry = new TenantLifecycleRegistry();
  const probe = new StoreChangeProbe(journal, options.fail);
  registry.register(probe);
  const stores = new JournalingStores(journal);
  stores.rows.set(STORE_ID, storeOf(STORE_ID, 9, 'atlas'));
  stores.rows.set(OTHER_STORE_ID, storeOf(OTHER_STORE_ID, 10, 'atlas-two'));
  const hosts = new RecordingHostInvalidator(journal);
  const ports: StoreAdminPorts = {
    channels: new FakeChannelProvisioner(),
    assets: openAssets,
    platform: new InMemoryPlatformStore(),
    transaction: journalingTransaction(journal),
    ids: new SequentialIdGenerator('900'),
    lifecycle: registry,
    clock: (): Date => NOW,
    stores,
    hosts,
  };
  return { journal, probe, ports, hosts };
}

describe('store.changed from the store use cases', () => {
  it('announces a language change once, inside the transaction, before the host caches are cleared', async () => {
    // Arrange
    const { journal, probe, ports } = setUp();

    // Act
    await new UpdateStoreService(ports).update(ctx, ACTOR, STORE_ID, { language: 'fr' });

    // Assert
    expect(probe.events).toEqual([{ businessId: BUSINESS_ID, storeId: STORE_ID, change: 'settings' }]);
    expect(journal).toEqual(['begin', 'write', 'store-changed:settings', 'commit', 'invalidate']);
  });

  it('fails the update, and clears no cache, when the announcement fails', async () => {
    // Arrange
    const { journal, ports, hosts } = setUp({ fail: true });

    // Act
    const update = new UpdateStoreService(ports).update(ctx, ACTOR, STORE_ID, { name: 'Renamed' });

    // Assert
    await expect(update).rejects.toThrow('the outbox write failed');
    expect(journal).not.toContain('commit');
    expect(hosts.changes).toHaveLength(0);
  });

  it('announces an archive as a status change', async () => {
    // Arrange
    const { journal, probe, ports } = setUp();

    // Act
    await new ArchiveStoreService(ports).archive(ctx, ACTOR, STORE_ID);

    // Assert
    expect(probe.events).toEqual([{ businessId: BUSINESS_ID, storeId: STORE_ID, change: 'status' }]);
    expect(journal.indexOf('store-changed:status')).toBeLessThan(journal.indexOf('commit'));
  });

  it('announces nothing when the store was already archived', async () => {
    // Arrange
    const { probe, ports } = setUp();
    const archive = new ArchiveStoreService(ports);
    await archive.archive(ctx, ACTOR, STORE_ID);
    probe.events.length = 0;

    // Act
    await archive.archive(ctx, ACTOR, STORE_ID);

    // Assert
    expect(probe.events).toEqual([]);
  });

  it('announces a subdomain change as a domain change', async () => {
    // Arrange
    const { journal, probe, ports } = setUp();

    // Act
    await new ChangeSubdomainService(ports).change(ctx, ACTOR, STORE_ID, 'atlas-shop');

    // Assert
    expect(probe.events).toEqual([{ businessId: BUSINESS_ID, storeId: STORE_ID, change: 'domain' }]);
    expect(journal.indexOf('store-changed:domain')).toBeLessThan(journal.indexOf('commit'));
  });

  it('announces nothing when the subdomain stays the same', async () => {
    // Arrange
    const { probe, ports } = setUp();

    // Act
    await new ChangeSubdomainService(ports).change(ctx, ACTOR, STORE_ID, 'atlas');

    // Assert
    expect(probe.events).toEqual([]);
  });
});

describe('TenantLifecycleRegistry.storeChanged', () => {
  it('reaches the hooks that listen for store changes and skips the others', async () => {
    // Arrange
    const journal: string[] = [];
    const registry = new TenantLifecycleRegistry();
    const silent: TenantLifecycleHook = {
      businessProvisioned: () => Promise.resolve(),
      storeCreated: () => Promise.resolve(),
    };
    const probe = new StoreChangeProbe(journal);
    registry.register(silent);
    registry.register(probe);
    const event: StoreChangedEvent = { businessId: BUSINESS_ID, storeId: STORE_ID, change: 'settings' };

    // Act
    await registry.storeChanged(ctx, event);

    // Assert
    expect(probe.events).toEqual([event]);
  });
});
