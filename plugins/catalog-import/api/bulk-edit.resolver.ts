import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { BulkEditActions, type CatalogBulkEditResultDto } from './bulk-edit-actions';
import { withImportErrors } from './error-mapping';
import { IMPORT_PERMISSIONS } from './permissions';

/** Bulk edit on the Admin API; the same action as the REST route. */
@Resolver()
export class BulkEditResolver {
  constructor(private readonly actions: BulkEditActions) {}

  /** Changes status, brand, tags or prices of selected products of the active store (catalog.products.edit). */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.edit)
  bulkEditCatalogProducts(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<CatalogBulkEditResultDto> {
    return withImportErrors(() => this.actions.edit(ctx, input));
  }
}
