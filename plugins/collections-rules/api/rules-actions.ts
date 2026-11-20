import { previewStoreCollectionInputSchema, storeCollectionProductSearchQuerySchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { PreviewMatchesService } from '../application/preview-matches.service';
import { ProductSearchService } from '../application/product-search.service';
import { RuleOptionsService } from '../application/rule-options.service';
import type { RuleOptions } from '../domain/ports/product-facts.port';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreCollectionProductListDto } from './dto';
import { CollectionsThrottle } from './preview-throttle';
import { parseInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** The rule builder's use cases. */
@Injectable()
export class RulesUseCases {
  constructor(
    readonly preview: PreviewMatchesService,
    readonly options: RuleOptionsService,
    readonly search: ProductSearchService,
  ) {}
}

/** Who spends a throttle budget: the signed-in administrator (every handler here requires one). */
const administratorKeyOf = (ctx: RequestContext): string => String(ctx.activeUserId);

/**
 * The rule builder for both API surfaces (team pattern of {@link CollectionsActions}): store from the session, input
 * parsed with the shared schema, the throttle spent before any store read (D2338), run, shape.
 */
@Injectable()
export class RulesActions {
  constructor(
    private readonly useCases: RulesUseCases,
    private readonly throttle: CollectionsThrottle,
  ) {}

  async preview(ctx: RequestContext, input: unknown): Promise<StoreCollectionProductListDto> {
    const scope = scopeOf(ctx);
    // Parsed first: a half-typed rule reads nothing, so it spends none of the budget that caps store reads.
    const { rule, skip, take } = parseInput(previewStoreCollectionInputSchema, input);
    await this.throttle.spendPreview(scope.businessId, administratorKeyOf(ctx));
    return this.useCases.preview.run(asOperationContext(ctx), scope, rule, { skip, take });
  }

  async ruleOptions(ctx: RequestContext): Promise<RuleOptions> {
    const scope = scopeOf(ctx);
    await this.throttle.spendRuleOptions(scope.businessId, administratorKeyOf(ctx));
    return this.useCases.options.of(asOperationContext(ctx), scope);
  }

  productSearch(ctx: RequestContext, options: unknown): Promise<StoreCollectionProductListDto> {
    const request = parseInput(storeCollectionProductSearchQuerySchema, options ?? {});
    return this.useCases.search.run(asOperationContext(ctx), scopeOf(ctx), request);
  }
}
