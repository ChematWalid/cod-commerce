import {
  type BusinessProvisionedEvent,
  type OperationContext as TenancyOperationContext,
  TENANT_LIFECYCLE_REGISTRAR,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { TeamConvergeService } from '../application/converge-members.service';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * Makes a new business's owner its first team member, in tenancy's provisioning transaction (D215). It needs only the
 * owner's administrator, which exists before any hook runs, so it does not depend on rbac's hook running first.
 */
@Injectable()
export class TeamLifecycleHook implements TenantLifecycleHook, OnApplicationBootstrap {
  constructor(
    @Inject(TENANT_LIFECYCLE_REGISTRAR) private readonly registrar: TenantLifecycleRegistrar,
    private readonly converge: TeamConvergeService,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  async businessProvisioned(ctx: TenancyOperationContext, event: BusinessProvisionedEvent): Promise<void> {
    await this.converge.adoptAdministrators(asOperationContext(ctx), { businessId: event.businessId }, [
      event.ownerAdministratorId,
    ]);
  }

  storeCreated(): Promise<void> {
    // A new store changes no one's membership: store access lives in rbac (D204).
    return Promise.resolve();
  }
}
