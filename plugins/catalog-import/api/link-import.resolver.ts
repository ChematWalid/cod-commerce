import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withImportErrors } from './error-mapping';
import { type CatalogLinkImportDto, type CatalogProductPolishDto, LinkImportActions } from './link-import-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/** Link import and the AI hooks on the Admin API; the same actions as the REST routes (D2206, D2207). */
@Resolver()
export class LinkImportResolver {
  constructor(private readonly actions: LinkImportActions) {}

  /** Imports the product a link names as a Draft of the active store. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.create)
  createCatalogLinkImport(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogLinkImportDto> {
    return withImportErrors(() => this.actions.importLink(ctx, input));
  }

  /** A link import of the active store. */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.create)
  catalogLinkImport(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogLinkImportDto> {
    return withImportErrors(() => this.actions.status(ctx, id));
  }

  /** A product's polished text (identity until P9.S7b); nothing is saved. */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.edit)
  polishCatalogProduct(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogProductPolishDto> {
    return withImportErrors(() => this.actions.polish(ctx, id));
  }
}
