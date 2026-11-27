import {
  type OperationContext as TenancyOperationContext,
  type StoreCreatedEvent,
  TENANT_LIFECYCLE_REGISTRAR,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DeliveryDefaultsConvergeService } from '../application/delivery-defaults-converge.service';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * Gives every new store its "Platform default prices" table and makes it the store's default, inside tenancy's
 * creating transaction (D3111): a failure rolls the store back, so no store is left without a default.
 */
@Injectable()
export class DeliveryPricingLifecycleHook implements TenantLifecycleHook, OnApplicationBootstrap {
  constructor(
    @Inject(TENANT_LIFECYCLE_REGISTRAR) private readonly registrar: TenantLifecycleRegistrar,
    private readonly defaults: DeliveryDefaultsConvergeService,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  businessProvisioned(): Promise<void> {
    // Its first store was already created, and got its table from storeCreated.
    return Promise.resolve();
  }

  async storeCreated(ctx: TenancyOperationContext, event: StoreCreatedEvent): Promise<void> {
    await this.defaults.linkStore(asOperationContext(ctx), { businessId: event.businessId, storeId: event.storeId });
  }
}
