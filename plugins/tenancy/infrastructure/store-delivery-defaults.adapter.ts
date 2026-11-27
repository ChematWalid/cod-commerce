import type { Snowflake } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import { assertReferenceOwned, type StoreReferenceChecks } from '../application/store-reference.registry';
import { STORE_REFERENCE_CHECKS, TENANT_STORES } from '../application/tokens';
import { StoreNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { StoreDeliveryDefaults } from '../domain/ports/store-delivery-defaults.port';
import type { StoreReferenceScope } from '../domain/ports/store-reference-check.port';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';

/** {@link StoreDeliveryDefaults} over {@link TenantStoresPort}: the update carries the business filter (ADR 0002). */
@Injectable()
export class TenantStoreDeliveryDefaults extends StoreDeliveryDefaults {
  constructor(
    @Inject(TENANT_STORES) private readonly stores: TenantStoresPort,
    @Inject(STORE_REFERENCE_CHECKS) private readonly references: StoreReferenceChecks,
  ) {
    super();
  }

  async lockDefaultDeliveryFeeGroup(ctx: OperationContext, scope: StoreReferenceScope): Promise<Snowflake | null> {
    const store = await this.stores.findForUpdate(ctx, scope.businessId, scope.storeId);
    if (store === undefined) throw new StoreNotFoundError();
    return store.defaultDeliveryFeeGroupId;
  }

  async setDefaultDeliveryFeeGroup(
    ctx: OperationContext,
    scope: StoreReferenceScope,
    groupId: Snowflake,
  ): Promise<void> {
    const store = await this.stores.find(ctx, scope.businessId, scope.storeId);
    if (store === undefined) throw new StoreNotFoundError();
    await assertReferenceOwned(this.references, ctx, scope, { kind: 'deliveryFeeGroup', id: groupId });
    await this.stores.update(ctx, scope.businessId, scope.storeId, {
      defaultDeliveryFeeGroupId: groupId,
      updatedAt: new Date(),
    });
  }
}
