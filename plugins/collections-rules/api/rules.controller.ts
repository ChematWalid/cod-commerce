import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import type { RuleOptions } from '../domain/ports/product-facts.port';
import type { StoreCollectionProductListDto } from './dto';
import { COLLECTIONS_REST_FILTERS, restCall } from './error-mapping';
import { COLLECTION_PERMISSIONS } from './permissions';
import { RulesActions } from './rules-actions';

/**
 * The automatic-collection builder for clients that do not speak GraphQL (ADR 0017, D2315). Its routes are literal,
 * so this controller is registered before `CollectionsController`, whose `GET :id` would otherwise take them.
 */
@Controller('catalog/collections')
@UseFilters(...COLLECTIONS_REST_FILTERS)
export class RulesController {
  constructor(private readonly actions: RulesActions) {}

  /** The products an unsaved rule would pick, `{ rule, skip?, take? }` (catalog.collections.view); 429 when throttled. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @requirePermission(COLLECTION_PERMISSIONS.view)
  preview(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<StoreCollectionProductListDto> {
    return restCall(() => this.actions.preview(ctx, body));
  }

  /** The store's brands, tags and option names with values (catalog.collections.view); 429 when throttled. */
  @Get('rule-options')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  ruleOptions(@Ctx() ctx: RequestContext): Promise<RuleOptions> {
    return restCall(() => this.actions.ruleOptions(ctx));
  }

  /** The store's products by title (catalog.collections.edit); `search`, `skip` and `take` in the query string. */
  @Get('product-search')
  @requirePermission(COLLECTION_PERMISSIONS.edit)
  productSearch(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<StoreCollectionProductListDto> {
    return restCall(() => this.actions.productSearch(ctx, query));
  }
}
