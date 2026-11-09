import {
  type BusinessProvisionedEvent,
  type OperationContext as TenancyOperationContext,
  type StoreCreatedEvent,
  TENANT_LIFECYCLE_REGISTRAR,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { ExtendAllBindingsService } from '../application/extend-all-bindings.service';
import { SeedBuiltInRolesService } from '../application/seed-built-in-roles.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-context';
import { StoreAccessChangedEvent } from './store-access-changed.event';

/** Keeps the roles of a business in step with its provisioning and its stores, in tenancy's transaction (D56). */
@Injectable()
export class RbacLifecycleHook implements TenantLifecycleHook, OnApplicationBootstrap {
  constructor(
    @Inject(TENANT_LIFECYCLE_REGISTRAR) private readonly registrar: TenantLifecycleRegistrar,
    private readonly seedBuiltInRoles: SeedBuiltInRolesService,
    private readonly extendAllBindings: ExtendAllBindingsService,
    private readonly eventBus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  async businessProvisioned(ctx: TenancyOperationContext, event: BusinessProvisionedEvent): Promise<void> {
    await this.seedBuiltInRoles.seed(asOperationContext(ctx), event);
  }

  async storeCreated(ctx: TenancyOperationContext, event: StoreCreatedEvent): Promise<void> {
    const operation = asOperationContext(ctx);
    await this.extendAllBindings.extendToStore(operation, event);
    await this.eventBus.publish(new StoreAccessChangedEvent(toRequestContext(operation), event.businessId));
  }
}
