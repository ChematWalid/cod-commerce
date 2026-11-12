import { asOperationContext, BusinessStoreDirectory, PlatformStoreLookup } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import { RequestContextService } from '@vendure/core';
import type { ScopeDirectoryPort } from '../domain/ports/scope-directory.port';

/**
 * {@link ScopeDirectoryPort} on tenancy's platform-wide views: a business exists when it has a store (provisioning
 * opens one with it and a store is archived, never deleted), and a store counts when it serves buyers.
 */
@Injectable()
export class TenancyScopeDirectory implements ScopeDirectoryPort {
  constructor(
    @Inject(BusinessStoreDirectory) private readonly directory: BusinessStoreDirectory,
    @Inject(PlatformStoreLookup) private readonly stores: PlatformStoreLookup,
    @Inject(RequestContextService) private readonly contexts: RequestContextService,
  ) {}

  async businessExists(businessId: string): Promise<boolean> {
    const ctx = asOperationContext(await this.contexts.create({ apiType: 'admin' }));
    return (await this.directory.storesOf(ctx, toBusinessId(businessId))).length > 0;
  }

  async activeStoreExists(storeId: string): Promise<boolean> {
    return (await this.stores.findById(storeId as Parameters<PlatformStoreLookup['findById']>[0])) !== null;
  }
}
