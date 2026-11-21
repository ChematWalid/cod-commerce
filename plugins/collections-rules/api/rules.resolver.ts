import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import type { RuleOptions } from '../domain/ports/product-facts.port';
import type { StoreCollectionProductListDto } from './dto';
import { withCollectionsErrors } from './error-mapping';
import { COLLECTION_PERMISSIONS } from './permissions';
import { RulesActions } from './rules-actions';

const { view, edit } = COLLECTION_PERMISSIONS;

/** The automatic-collection builder on the Admin API (D2314, D2321). */
@Resolver()
export class RulesResolver {
  constructor(private readonly actions: RulesActions) {}

  /** The brands, tags and option names with values of the active store (AC3); throttled (D2338). */
  @Query()
  @requirePermission(view)
  storeCollectionRuleOptions(@Ctx() ctx: RequestContext): Promise<RuleOptions> {
    return withCollectionsErrors(() => this.actions.ruleOptions(ctx));
  }

  /** The active store's products whose title holds `search`, newest first, to add to a manual collection. */
  @Query()
  @requirePermission(edit)
  storeCollectionProductSearch(
    @Ctx() ctx: RequestContext,
    @Args('options') options: unknown,
  ): Promise<StoreCollectionProductListDto> {
    return withCollectionsErrors(() => this.actions.productSearch(ctx, options));
  }

  /** The products an unsaved rule would pick, with their count; writes nothing, throttled (D2331, D2338). */
  @Query()
  @requirePermission(view)
  previewStoreCollectionMatches(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<StoreCollectionProductListDto> {
    return withCollectionsErrors(() => this.actions.preview(ctx, input));
  }
}
