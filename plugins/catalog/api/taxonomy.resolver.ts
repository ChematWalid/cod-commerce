import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withCatalogErrors } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { TaxonomyActions } from './taxonomy-actions';
import type { CatalogHighlightDto, CatalogNameDto } from './taxonomy-dto';

const { view, edit } = PRODUCT_PERMISSIONS;

/**
 * The active store's brands, tags and highlights on the Admin API; the same actions as the REST routes. Reads need
 * `catalog.products.view`, writes `catalog.products.edit`.
 */
@Resolver()
export class TaxonomyResolver {
  constructor(private readonly actions: TaxonomyActions) {}

  /** The store's brands, newest first. */
  @Query()
  @requirePermission(view)
  catalogBrands(@Ctx() ctx: RequestContext): Promise<CatalogNameDto[]> {
    return withCatalogErrors(() => this.actions.brands.list(ctx));
  }

  /** Adds a brand; its name is unique in the store whatever its case (D2140). */
  @Mutation()
  @requirePermission(edit)
  createCatalogBrand(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogNameDto> {
    return withCatalogErrors(() => this.actions.brands.create(ctx, input));
  }

  /** Renames a brand of the store. */
  @Mutation()
  @requirePermission(edit)
  updateCatalogBrand(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<CatalogNameDto> {
    return withCatalogErrors(() => this.actions.brands.update(ctx, id, input));
  }

  /** Deletes a brand of the store and clears it from its products (D2140). */
  @Mutation()
  @requirePermission(edit)
  async deleteCatalogBrand(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCatalogErrors(() => this.actions.brands.delete(ctx, id));
    return true;
  }

  /** The store's tags, newest first. */
  @Query()
  @requirePermission(view)
  catalogTags(@Ctx() ctx: RequestContext): Promise<CatalogNameDto[]> {
    return withCatalogErrors(() => this.actions.tags.list(ctx));
  }

  /** Adds a tag; its name is unique in the store whatever its case (D2140). */
  @Mutation()
  @requirePermission(edit)
  createCatalogTag(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogNameDto> {
    return withCatalogErrors(() => this.actions.tags.create(ctx, input));
  }

  /** Renames a tag of the store. */
  @Mutation()
  @requirePermission(edit)
  updateCatalogTag(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<CatalogNameDto> {
    return withCatalogErrors(() => this.actions.tags.update(ctx, id, input));
  }

  /** Deletes a tag of the store; it leaves every product. */
  @Mutation()
  @requirePermission(edit)
  async deleteCatalogTag(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCatalogErrors(() => this.actions.tags.delete(ctx, id));
    return true;
  }

  /** The store's highlights, newest first. */
  @Query()
  @requirePermission(view)
  catalogHighlights(@Ctx() ctx: RequestContext): Promise<CatalogHighlightDto[]> {
    return withCatalogErrors(() => this.actions.highlights.list(ctx));
  }

  /** Adds a highlight products of the store may show (at most six each, AC3). */
  @Mutation()
  @requirePermission(edit)
  createCatalogHighlight(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogHighlightDto> {
    return withCatalogErrors(() => this.actions.highlights.create(ctx, input));
  }

  /** Rewords a highlight of the store. */
  @Mutation()
  @requirePermission(edit)
  updateCatalogHighlight(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<CatalogHighlightDto> {
    return withCatalogErrors(() => this.actions.highlights.update(ctx, id, input));
  }

  /** Deletes a highlight of the store; it leaves every product. */
  @Mutation()
  @requirePermission(edit)
  async deleteCatalogHighlight(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCatalogErrors(() => this.actions.highlights.delete(ctx, id));
    return true;
  }
}
