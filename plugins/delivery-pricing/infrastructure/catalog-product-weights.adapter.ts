import { CATALOG_FACTS_MAX_IDS, CatalogProductFactsReader } from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductWeightsPort } from '../domain/ports/product-weights.port';
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
 * after the other on the caller's transaction.
 */
@Injectable()
export class CatalogProductWeights implements ProductWeightsPort {
  constructor(private readonly reader: CatalogProductFactsReader) {}

  async weightsOf(
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
