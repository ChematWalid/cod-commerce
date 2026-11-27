import {
  type OperationContext as TenancyOperationContext,
  STORE_REFERENCE_CHECK_REGISTRAR,
  type StoreReferenceCheck,
  type StoreReferenceCheckRegistrar,
  type StoreReferenceScope,
} from '@cod/plugin-tenancy';
import type { Snowflake } from '@cod/shared';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { FEE_GROUP_REPOSITORY } from '../application/tokens';
import type { FeeGroupRepositoryPort } from '../domain/ports/fee-group-repository.port';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * The fee-group {@link StoreReferenceCheck} (#230, #153, D3111). Delivery-pricing owns this check and registers it on
 * tenancy's registrar on bootstrap; tenancy only declares the port and asks it. A group answers yes only for its own
 * business **and** store, and is held `FOR SHARE` in the store update's transaction, so a concurrent delete (which
 * takes `FOR UPDATE`) cannot leave the store pointing at nothing.
 */
@Injectable()
export class DeliveryFeeGroupReferenceCheck implements StoreReferenceCheck, OnApplicationBootstrap {
  readonly kind = 'deliveryFeeGroup';

  constructor(
    @Inject(STORE_REFERENCE_CHECK_REGISTRAR) private readonly registrar: StoreReferenceCheckRegistrar,
    @Inject(FEE_GROUP_REPOSITORY) private readonly groups: FeeGroupRepositoryPort,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  exists(ctx: TenancyOperationContext, scope: StoreReferenceScope, id: Snowflake): Promise<boolean> {
    return this.groups.share(asOperationContext(ctx), scope, id);
  }
}
