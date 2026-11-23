import {
  asOperationContext,
  RequestTenantScope,
  type StoreChangedEvent,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { storeChangedPayloadSchema, type TenantScope, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OutboxEventInput } from '../../domain/outbox-event';
import { OutboxStoreChangedHook } from '../../infrastructure/store-changed.outbox';

const EVENT: StoreChangedEvent = {
  businessId: toBusinessId('41'),
  storeId: toStoreId(toSnowflake('7340032000000001')),
  change: 'settings',
};

function setUp() {
  const written: { scope: TenantScope; input: OutboxEventInput }[] = [];
  const outbox = {
    add: (scope: TenantScope, input: OutboxEventInput) => {
      written.push({ scope, input });
      return Promise.resolve({ id: '1', createdAt: '2026-11-22T10:00:00.000Z' });
    },
  };
  const registered: TenantLifecycleHook[] = [];
  const registrar: TenantLifecycleRegistrar = { register: (hook) => void registered.push(hook) };
  return { hook: new OutboxStoreChangedHook(registrar, outbox), written, registered };
}

describe('OutboxStoreChangedHook', () => {
  it('registers itself with tenancy at bootstrap', () => {
    // Arrange
    const { hook, registered } = setUp();

    // Act
    hook.onApplicationBootstrap();

    // Assert
    expect(registered).toEqual([hook]);
  });

  it('writes one store.changed event for the store’s business, in the caller’s transaction', async () => {
    // Arrange
    const { hook, written } = setUp();
    const ctx = asOperationContext({});

    // Act
    await hook.storeChanged(ctx, EVENT);

    // Assert
    expect(written).toHaveLength(1);
    const [{ scope, input }] = written as [{ scope: TenantScope; input: OutboxEventInput }];
    expect(scope).toBeInstanceOf(RequestTenantScope);
    expect(scope.businessId).toBe(EVENT.businessId);
    expect((scope as RequestTenantScope).ctx).toBe(ctx);
    expect(input).toEqual({
      topic: 'store.changed',
      aggregateId: EVENT.storeId,
      storeId: EVENT.storeId,
      payload: { storeId: EVENT.storeId, businessId: EVENT.businessId, change: 'settings' },
    });
    expect(storeChangedPayloadSchema.safeParse(input.payload).success).toBe(true);
  });

  it('does nothing when a business is provisioned or a store created', async () => {
    // Arrange
    const { hook, written } = setUp();

    // Act
    await hook.businessProvisioned();
    await hook.storeCreated();

    // Assert
    expect(written).toEqual([]);
  });
});
