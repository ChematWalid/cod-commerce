import { CATALOG_MAX_PAGE_SIZE, type ProductType } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { SortOrder } from '@vendure/common/lib/generated-types';
import {
  type ListQueryOptions,
  type Product,
  ProductService,
  type ProductVariant,
  ProductVariantService,
  type RequestContext,
  type VendureEntity,
} from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductCriteria } from '../domain/ports/product-catalog.port';
import type { ProductIdPage, ProductLookupPort, SkuCandidate } from '../domain/ports/product-lookup.port';
import { likeLiteralOf } from './like-literal';
import { toRequestContext } from './request-scope';
import { listOptionsOf } from './vendure-product-list-options';
import { coreIdOf, type ProductCustomFields } from './vendure-product-mapper';

/** How many SKUs one pre-filter query names: each adds two `contains` clauses (NFC and NFD come in as given). */
const SKUS_PER_QUERY = 50;

/** A paged reader of one `findAll` filter. */
type PageReader<T extends VendureEntity> = (
  options: ListQueryOptions<T>,
) => Promise<{ items: T[]; totalItems: number }>;

/** Every row a filter matches, page after page in id order. */
async function readAll<T extends VendureEntity>(read: PageReader<T>, filter: object): Promise<T[]> {
  const rows: T[] = [];
  for (let skip = 0; ; skip += CATALOG_MAX_PAGE_SIZE) {
    const options = { skip, take: CATALOG_MAX_PAGE_SIZE, sort: { id: SortOrder.ASC }, filter } as ListQueryOptions<T>;
    const page = await read(options);
    rows.push(...page.items);
    if (page.items.length < CATALOG_MAX_PAGE_SIZE || rows.length >= page.totalItems) return rows;
  }
}

function chunksOf(values: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < values.length; start += SKUS_PER_QUERY) {
    chunks.push(values.slice(start, start + SKUS_PER_QUERY));
  }
  return chunks;
}

/** One `contains` clause per SKU, each escaped so it matches only itself as a substring (D2234). */
const containsAny = (field: string, skus: readonly string[]) => ({
  _or: skus.map((sku) => ({ [field]: { contains: likeLiteralOf(sku) } })),
});

const productSkuOf = (product: Product): string | null =>
  (product.customFields as Partial<ProductCustomFields>).defaultSku ?? null;

const productTypeOf = (product: Product): ProductType => (product.customFields as ProductCustomFields).type;

/** A variant holding a looked-up SKU, before its product's type is read. */
type VariantHolder = Omit<SkuCandidate, 'productType'>;

/**
 * {@link ProductLookupPort} on Vendure's services in the caller's store channel (D2201, D2218): they see only that
 * channel's live rows (`deletedAt IS NULL`, the channel join of `findAll`).
 */
@Injectable()
export class VendureProductLookup implements ProductLookupPort {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
  ) {}

  async listIds(ctx: OperationContext, criteria: ProductCriteria): Promise<ProductIdPage> {
    if (criteria.productIds?.length === 0) return { ids: [], totalItems: 0 };
    const page = await this.products.findAll(toRequestContext(ctx), listOptionsOf(criteria), []);
    return { ids: page.items.map((product) => coreIdOf(product.id)), totalItems: page.totalItems };
  }

  /**
   * Variants whose SKU contains one of `skus` and products whose own SKU does, ignoring case (Vendure's `contains`):
   * a superset the use case compares exactly.
   */
  async findBySkus(ctx: OperationContext, skus: readonly string[]): Promise<readonly SkuCandidate[]> {
    const request = toRequestContext(ctx);
    const found: SkuCandidate[] = [];
    for (const chunk of chunksOf(skus)) {
      found.push(...(await this.variantCandidates(request, chunk)), ...(await this.productCandidates(request, chunk)));
    }
    return found;
  }

  /** Variants holding one of `skus`, each with its product's type (one more query for their products, D2284). */
  private async variantCandidates(ctx: RequestContext, skus: readonly string[]): Promise<SkuCandidate[]> {
    const read: PageReader<ProductVariant> = (options) => this.variants.findAll(ctx, options);
    const holders: VariantHolder[] = (await readAll(read, containsAny('sku', skus))).map((variant) => ({
      productId: coreIdOf(variant.productId),
      variantId: coreIdOf(variant.id),
      sku: variant.sku,
    }));
    const types = await this.typesOf(ctx, [...new Set(holders.map((holder) => holder.productId))]);
    // A variant whose product is not live in the channel (deleted meanwhile) holds no SKU.
    return holders.flatMap((holder) => {
      const productType = types.get(holder.productId);
      return productType === undefined ? [] : [{ ...holder, productType }];
    });
  }

  /** The type of each live product of `ids` in the caller's channel. */
  private async typesOf(ctx: RequestContext, ids: readonly string[]): Promise<ReadonlyMap<string, ProductType>> {
    if (ids.length === 0) return new Map();
    const read: PageReader<Product> = (options) => this.products.findAll(ctx, options, []);
    const rows = await readAll(read, { id: { in: [...ids] } });
    return new Map(rows.map((product) => [coreIdOf(product.id), productTypeOf(product)]));
  }

  private async productCandidates(ctx: RequestContext, skus: readonly string[]): Promise<SkuCandidate[]> {
    const read: PageReader<Product> = (options) => this.products.findAll(ctx, options, []);
    const rows = await readAll(read, containsAny('defaultSku', skus));
    return rows.flatMap((product) => {
      const sku = productSkuOf(product);
      return sku === null
        ? []
        : [{ productId: coreIdOf(product.id), variantId: null, sku, productType: productTypeOf(product) }];
    });
  }
}
