import { type Snowflake, type StoreId, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { StoreAdminPorts } from '../../application/store-admin-ports';
import { StoreReferenceRegistry } from '../../application/store-reference.registry';
import { UpdateStoreService } from '../../application/update-store.service';
import { StoreReferenceNotFoundError, StoreReferenceRequiredError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import type {
  StoreReferenceCheck,
  StoreReferenceKind,
  StoreReferenceScope,
} from '../../domain/ports/store-reference-check.port';
import type { StoreWrite, TenantStoresPort } from '../../domain/ports/tenant-stores.port';
import { newStore, type Store, type StoreActor, type StorePatch } from '../../domain/store';
import {
  FakeChannelProvisioner,
  InMemoryPlatformStore,
  inlineTransaction,
  noLifecycle,
  openAssets,
  RecordingHostInvalidator,
  SequentialIdGenerator,
} from '../fakes/fakes';

const ctx = asOperationContext({});
const BUSINESS = toBusinessId('1000000000000000001');
const ACTIVE_STORE = toStoreId(toSnowflake('1000000000000000011'));
const UPDATED_STORE = toStoreId(toSnowflake('1000000000000000012'));
const GROUP = toSnowflake('1000000000000000101');
const OTHER_GROUP = toSnowflake('1000000000000000102');
const CARRIER = toSnowflake('1000000000000000201');
const ACTOR: StoreActor = { businessId: BUSINESS, channelIds: [11, 12] };

const storeRow = (id: StoreId, channelId: number, fields: Partial<Store> = {}): Store => ({
  ...newStore({
    id,
    businessId: toSnowflake(BUSINESS),
    channelId,
    sellerId: 3,
    subdomain: `shop-${String(channelId)}`,
    input: { name: 'Shop', subdomain: `shop-${String(channelId)}`, language: 'ar' },
    now: new Date('2026-11-22T10:00:00.000Z'),
  }),
  ...fields,
});

/** The business's stores in memory; records every write. */
class InMemoryStores implements TenantStoresPort {
  readonly writes: StoreWrite[] = [];

  constructor(private readonly rows: Store[]) {}

  list(): Promise<readonly Store[]> {
    return Promise.resolve(this.rows);
  }

  find(_ctx: unknown, _businessId: unknown, id: StoreId): Promise<Store | undefined> {
    return Promise.resolve(this.rows.find((row) => row.id === id));
  }

  findForUpdate(_ctx: unknown, businessId: unknown, id: StoreId): Promise<Store | undefined> {
    return this.find(_ctx, businessId, id);
  }

  countActive(): Promise<number> {
    return Promise.resolve(this.rows.length);
  }

  update(_ctx: unknown, _businessId: unknown, _id: StoreId, write: StoreWrite): Promise<void> {
    this.writes.push(write);
    return Promise.resolve();
  }
}

/** A check that answers `answer` and records every scope and id it was asked about. */
class RecordingCheck implements StoreReferenceCheck {
  readonly asked: { scope: StoreReferenceScope; id: Snowflake }[] = [];

  constructor(
    readonly kind: StoreReferenceKind,
    private readonly answer: boolean,
  ) {}

  exists(_ctx: unknown, scope: StoreReferenceScope, id: Snowflake): Promise<boolean> {
    this.asked.push({ scope, id });
    return Promise.resolve(this.answer);
  }
}

function setUp(checks: readonly StoreReferenceCheck[], current: Partial<Store> = {}) {
  const references = new StoreReferenceRegistry();
  for (const check of checks) references.register(check);
  const stores = new InMemoryStores([storeRow(ACTIVE_STORE, 11), storeRow(UPDATED_STORE, 12, current)]);
  const ports: StoreAdminPorts = {
    channels: new FakeChannelProvisioner(),
    assets: openAssets,
    platform: new InMemoryPlatformStore(),
    transaction: inlineTransaction,
    ids: new SequentialIdGenerator('900'),
    lifecycle: noLifecycle,
    clock: () => new Date('2026-11-22T11:00:00.000Z'),
    stores,
    hosts: new RecordingHostInvalidator(),
    references,
  };
  return { stores, service: new UpdateStoreService(ports) };
}

const update = (service: UpdateStoreService, patch: StorePatch): Promise<Store> =>
  service.update(ctx, ACTOR, UPDATED_STORE, patch);

describe('UpdateStoreService store references (#230, #153, D3111)', () => {
  it('refuses a fee group id when no check is registered for it', async () => {
    // Arrange
    const { stores, service } = setUp([]);

    // Act
    const refusal = update(service, { defaultDeliveryFeeGroupId: GROUP });

    // Assert
    await expect(refusal).rejects.toBeInstanceOf(StoreReferenceNotFoundError);
    expect(stores.writes).toEqual([]);
  });

  it('refuses a fee group id the check answers no for, with the pinned code', async () => {
    // Arrange
    const { stores, service } = setUp([new RecordingCheck('deliveryFeeGroup', false)]);

    // Act
    const refusal = update(service, { defaultDeliveryFeeGroupId: GROUP });

    // Assert
    await expect(refusal).rejects.toMatchObject({ code: 'tenancy.store-reference-not-found' });
    expect(stores.writes).toEqual([]);
  });

  it('accepts a fee group id the check answers yes for', async () => {
    // Arrange
    const { stores, service } = setUp([new RecordingCheck('deliveryFeeGroup', true)]);

    // Act
    const updated = await update(service, { defaultDeliveryFeeGroupId: GROUP });

    // Assert
    expect(updated.defaultDeliveryFeeGroupId).toBe(GROUP);
    expect(stores.writes).toMatchObject([{ defaultDeliveryFeeGroupId: GROUP }]);
  });

  it('refuses a carrier id while no carrier check is registered, even when fee groups are checked', async () => {
    // Arrange
    const { service } = setUp([new RecordingCheck('deliveryFeeGroup', true)]);

    // Act
    const refusal = update(service, { defaultCarrierId: CARRIER });

    // Assert
    await expect(refusal).rejects.toBeInstanceOf(StoreReferenceNotFoundError);
  });

  it('clears the carrier id on null without asking any check', async () => {
    // Arrange
    const check = new RecordingCheck('deliveryFeeGroup', false);
    const { stores, service } = setUp([check], { defaultDeliveryFeeGroupId: GROUP, defaultCarrierId: CARRIER });

    // Act
    const updated = await update(service, { defaultCarrierId: null });

    // Assert
    expect(updated).toMatchObject({ defaultDeliveryFeeGroupId: GROUP, defaultCarrierId: null });
    expect(stores.writes).toHaveLength(1);
    expect(check.asked).toEqual([]);
  });

  it('refuses to clear the default fee group of a store that has one, so it always keeps a fee table (D3108)', async () => {
    // Arrange
    const check = new RecordingCheck('deliveryFeeGroup', true);
    const { stores, service } = setUp([check], { defaultDeliveryFeeGroupId: GROUP });

    // Act
    const refusal = update(service, { defaultDeliveryFeeGroupId: null, name: 'not saved' });

    // Assert
    await expect(refusal).rejects.toBeInstanceOf(StoreReferenceRequiredError);
    await expect(refusal).rejects.toMatchObject({ code: 'tenancy.store-reference-required' });
    expect(stores.writes).toEqual([]);
  });

  it('accepts a null fee group on a store that has none yet', async () => {
    // Arrange
    const { stores, service } = setUp([new RecordingCheck('deliveryFeeGroup', false)]);

    // Act
    const updated = await update(service, { defaultDeliveryFeeGroupId: null, name: 'Renamed' });

    // Assert
    expect(updated).toMatchObject({ defaultDeliveryFeeGroupId: null, name: 'Renamed' });
    expect(stores.writes).toHaveLength(1);
  });

  it('skips the check for an id that does not change', async () => {
    // Arrange
    const check = new RecordingCheck('deliveryFeeGroup', false);
    const { stores, service } = setUp([check], { defaultDeliveryFeeGroupId: GROUP, defaultCarrierId: CARRIER });

    // Act
    await update(service, { defaultDeliveryFeeGroupId: GROUP, defaultCarrierId: CARRIER, name: 'Renamed' });

    // Assert
    expect(check.asked).toEqual([]);
    expect(stores.writes).toHaveLength(1);
  });

  it("asks about the updated store's scope, never the session's active store", async () => {
    // Arrange
    const check = new RecordingCheck('deliveryFeeGroup', true);
    const { service } = setUp([check], { defaultDeliveryFeeGroupId: OTHER_GROUP });

    // Act
    await update(service, { defaultDeliveryFeeGroupId: GROUP });

    // Assert
    expect(check.asked).toEqual([{ scope: { businessId: BUSINESS, storeId: UPDATED_STORE }, id: GROUP }]);
  });
});

describe('StoreReferenceRegistry', () => {
  it('refuses a second check of the same kind', () => {
    // Arrange
    const registry = new StoreReferenceRegistry();
    registry.register(new RecordingCheck('deliveryFeeGroup', true));

    // Act
    const again = () => {
      registry.register(new RecordingCheck('deliveryFeeGroup', true));
    };

    // Assert
    expect(again).toThrow(/already registered/);
  });

  it('keeps one check per kind', () => {
    // Arrange
    const registry = new StoreReferenceRegistry();
    const groups = new RecordingCheck('deliveryFeeGroup', true);
    const carriers = new RecordingCheck('carrier', true);

    // Act
    registry.register(groups);
    registry.register(carriers);

    // Assert
    expect(registry.checkOf('deliveryFeeGroup')).toBe(groups);
    expect(registry.checkOf('carrier')).toBe(carriers);
  });
});
