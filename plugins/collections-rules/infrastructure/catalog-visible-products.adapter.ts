import {
  asCatalogOperationContext,
  CATALOG_MAX_AMONG_IDS,
  CatalogReadService,
  type PublicListContext,
  toCoreId,
  type VisibleProductPage,
} from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { NewestMembers, ProductPage, VisibleProductsPort } from '../domain/ports/visible-products.port';
import { toRequestContext } from './request-scope';

const LOG_CONTEXT = 'CollectionsRulesPlugin';
/** How many over-cap collections a process remembers having warned about, so a hot storefront page logs once. */
const MAX_WARNED_COLLECTIONS = 1000;

const catalogContextOf = (ctx: OperationContext) => asCatalogOperationContext(toRequestContext(ctx));

/**
 * {@link VisibleProductsPort} over the catalog's exported {@link CatalogReadService} (D2310): its visibility rules,
 * sold-out setting and buyer-safe product shape are reused, never re-implemented here (D2306).
 */
@Injectable()
export class CatalogVisibleProducts implements VisibleProductsPort<PublicListContext, VisibleProductPage> {
  readonly maxNewestIds = CATALOG_MAX_AMONG_IDS;
  private readonly warned = new Set<string>();

  constructor(private readonly reads: CatalogReadService) {}

  among(
    ctx: OperationContext,
    context: PublicListContext,
    productIds: readonly string[],
    page: ProductPage,
  ): Promise<VisibleProductPage> {
    return this.reads.listVisibleAmong(
      catalogContextOf(ctx),
      context,
      productIds.map((id) => toCoreId(id)),
      page,
    );
  }

  newestAmong(
    ctx: OperationContext,
    context: PublicListContext,
    members: NewestMembers,
    page: ProductPage,
  ): Promise<VisibleProductPage> {
    const { productIds } = members;
    if (productIds.length > this.maxNewestIds) this.warnOverCap(members);
    const newest = productIds.slice(0, this.maxNewestIds).map((id) => toCoreId(id));
    return this.reads.listVisible(catalogContextOf(ctx), context, { ...page, productIds: newest });
  }

  /** Warns once per collection per process (bounded) that only its newest `maxNewestIds` products are listed. */
  private warnOverCap({ scope, collectionId }: NewestMembers): void {
    const key = `${scope.storeId}:${collectionId}`;
    if (this.warned.has(key)) return;
    if (this.warned.size >= MAX_WARNED_COLLECTIONS) this.warned.clear();
    this.warned.add(key);
    Logger.warn(
      `Automatic collection ${collectionId} of store ${scope.storeId} (business ${scope.businessId}) holds more than ${String(this.maxNewestIds)} products; the public read lists the newest ${String(this.maxNewestIds)}`,
      LOG_CONTEXT,
    );
  }
}
