import {
  CATALOG_FACTS_MAX_IDS,
  CatalogProductFactsReader,
  CatalogStoreChannelMismatchError,
} from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { DELIVERY_QUOTE_LOG_CONTEXT } from '../domain/constants';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductWeights, ProductWeightsPort } from '../domain/ports/product-weights.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** Splits ids into reader-sized chunks, each id once. */
function chunks(ids: readonly string[]): string[][] {
  const distinct = [...new Set(ids)];
  const result: string[][] = [];
  for (let start = 0; start < distinct.length; start += CATALOG_FACTS_MAX_IDS) {
    result.push(distinct.slice(start, start + CATALOG_FACTS_MAX_IDS));
  }
  return result;
}

/**
 * {@link ProductWeightsPort} over the catalog's reviewed batched weight reader (D3119), which refuses a context off
 * the store's channel. The reader takes at most `CATALOG_FACTS_MAX_IDS` ids a call, so larger asks go in chunks, one
 * after the other on the caller's transaction. A refused context answers `'unreadable'` with a warning, so the quote
 * answers unresolved instead of failing the caller's whole quote (#293); any other error propagates.
 */
@Injectable()
export class CatalogProductWeights implements ProductWeightsPort {
  constructor(private readonly reader: CatalogProductFactsReader) {}

  async weightsOf(ctx: OperationContext, scope: StoreScope, productIds: readonly string[]): Promise<ProductWeights> {
    try {
      return await this.readAll(ctx, scope, productIds);
    } catch (error: unknown) {
      if (!(error instanceof CatalogStoreChannelMismatchError)) throw error;
      Logger.warn(
        `Product weights unreadable for store ${String(scope.storeId)}: the context is off its channel`,
        DELIVERY_QUOTE_LOG_CONTEXT,
      );
      return 'unreadable';
    }
  }

  private async readAll(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, number | null>> {
    const found = new Map<string, number | null>();
    for (const chunk of chunks(productIds)) {
      const weights = await this.reader.weightsOf(toRequestContext(ctx), scope, chunk);
      for (const [productId, grams] of weights) found.set(productId, grams);
    }
    return found;
  }
}
