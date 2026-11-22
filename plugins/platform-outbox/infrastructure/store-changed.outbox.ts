import {
  type OperationContext,
  RequestTenantScope,
  type StoreChangedEvent,
  TENANT_LIFECYCLE_REGISTRAR,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { DOMAIN_EVENT_NAMES, type StoreChangedPayload } from '@cod/shared';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { OutboxService } from '../application/outbox.service';

/** The part of the outbox this hook writes through. */
export type StoreChangedOutboxPort = Pick<OutboxService, 'add'>;

/**
 * Writes tenancy's `store.changed` (D3204) through tenancy's lifecycle hook, awaited in the store change's own
 * transaction, so the change and its event commit or roll back together. It lives here, not in tenancy, because the
 * outbox already depends on tenancy and tenancy cannot depend on it back (D3218).
 */
@Injectable()
export class OutboxStoreChangedHook implements TenantLifecycleHook, OnApplicationBootstrap {
  constructor(
    @Inject(TENANT_LIFECYCLE_REGISTRAR) private readonly registrar: TenantLifecycleRegistrar,
    @Inject(OutboxService) private readonly outbox: StoreChangedOutboxPort,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  businessProvisioned(): Promise<void> {
    return Promise.resolve();
  }

  storeCreated(): Promise<void> {
    return Promise.resolve();
  }

  async storeChanged(ctx: OperationContext, event: StoreChangedEvent): Promise<void> {
    const payload: StoreChangedPayload = { storeId: event.storeId, businessId: event.businessId, change: event.change };
    // Tenancy hands an opaque operation context; under it is the transactional Vendure context of the change.
    const requestContext = ctx as unknown as RequestContext;
    await this.outbox.add(new RequestTenantScope(requestContext, event.businessId), {
      topic: DOMAIN_EVENT_NAMES.StoreChanged,
      aggregateId: event.storeId,
      storeId: event.storeId,
      payload,
    });
  }
}
