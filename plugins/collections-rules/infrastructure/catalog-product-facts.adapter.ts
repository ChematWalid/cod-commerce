import {
  CATALOG_FACTS_MAX_IDS,
  type CatalogProductFacts,
  CatalogProductFactsReader,
  toCoreId,
} from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import { canonicalCoreId, canonicalCoreIds } from '../domain/core-id';
import { InvalidCollectionInputError } from '../domain/errors';
import type { ProductFacts } from '../domain/product-facts';
import type {
  ProductFactsPort,
  ProductIdPage,
  ProductIdPageRequest,
  ProductSummary,
  RuleOptions,
} from '../domain/ports/product-facts.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** The catalog already applied D2304 (hidden variants left out), so its facts map field by field. */
const toFacts = (facts: CatalogProductFacts): ProductFacts => ({
  productId: facts.productId,
  title: facts.title,
  brandId: facts.brandId,
  tagIds: facts.tagIds,
  price: facts.price,
  onSale: facts.onSale,
  variantOptions: facts.variantOptions,
});

/**
 * Splits ids into reader-sized chunks, each canonical id once (`'07'` and `'7'` are one product), so a repeated id
 * never lands in two chunks; a malformed id names no product and is left out.
 */
function chunks(ids: readonly string[]): string[][] {
  const distinct = canonicalCoreIds(ids);
  const result: string[][] = [];
  for (let start = 0; start < distinct.length; start += CATALOG_FACTS_MAX_IDS) {
    result.push(distinct.slice(start, start + CATALOG_FACTS_MAX_IDS));
  }
  return result;
}

/** A page cursor in canonical form; a malformed one is refused here, so no catalog error crosses the boundary. */
function cursorOf(after: string): string {
  const canonical = canonicalCoreId(after);
  if (canonical === undefined) throw new InvalidCollectionInputError();
  return canonical;
}

function byNewest(left: ProductFacts, right: ProductFacts): number {
  const [leftId, rightId] = [BigInt(left.productId), BigInt(right.productId)];
  if (leftId === rightId) return 0;
  return rightId > leftId ? 1 : -1;
}

/**
 * {@link ProductFactsPort} over the catalog's batched reader (D2308). The reader takes at most
 * `CATALOG_FACTS_MAX_IDS` ids a call, so larger asks go in chunks, one after the other on the caller's transaction.
 */
@Injectable()
export class CatalogProductFactsAdapter implements ProductFactsPort {
  constructor(private readonly reader: CatalogProductFactsReader) {}

  async factsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<readonly ProductFacts[]> {
    const found: ProductFacts[] = [];
    for (const chunk of chunks(productIds)) {
      const facts = await this.reader.factsOf(toRequestContext(ctx), scope, chunk);
      found.push(...facts.map(toFacts));
    }
    return found.sort(byNewest);
  }

  async summariesOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProductSummary>> {
    const found = new Map<string, ProductSummary>();
    for (const chunk of chunks(productIds)) {
      for (const facts of await this.reader.factsOf(toRequestContext(ctx), scope, chunk)) {
        const { productId, title, status, price } = facts;
        found.set(productId, { productId, title, status, price });
      }
    }
    return found;
  }

  async pageIds(ctx: OperationContext, scope: StoreScope, page: ProductIdPageRequest): Promise<ProductIdPage> {
    const after = page.after === null ? null : toCoreId(cursorOf(page.after));
    const { ids, next } = await this.reader.pageIds(toRequestContext(ctx), scope, { ...page, after });
    return { ids, next };
  }

  ruleOptionsOf(ctx: OperationContext, scope: StoreScope): Promise<RuleOptions> {
    return this.reader.ruleOptionsOf(toRequestContext(ctx), scope);
  }
}
