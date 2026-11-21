import { CATALOG_MAX_PAGE_SIZE, PRODUCT_SEARCH_MAX } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import {
  type CatalogProductFacts,
  type CatalogRuleName,
  type CatalogRuleOptions,
  CatalogStoreChannelMismatchError,
  factsOf,
  type FactsVariantRow,
  ruleOptionsFrom,
} from '../application/product-facts';
import { BRAND_REPOSITORY, STORE_SETTINGS, TAG_REPOSITORY } from '../application/tokens';
import { type CoreId, isCoreId, parseCoreId } from '../domain/core-id';
import { InvalidCatalogInputError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import type { BrandRepositoryPort } from '../domain/ports/brand-repository.port';
import type { StoreSettingsPort } from '../domain/ports/store-settings.port';
import type { TagRepositoryPort } from '../domain/ports/tag-repository.port';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogNameEntry } from '../domain/taxonomy';
import { VendureProductFactsQuery } from './vendure-product-facts.query';

/** Most ids one facts read or page takes: the catalog's page cap (D2308). */
export const CATALOG_FACTS_MAX_IDS = CATALOG_MAX_PAGE_SIZE;

/** Which page of a store's product ids: newest first, below `after` (none for the first page). */
export interface CatalogFactsPage {
  readonly after: CoreId | null;
  /** 1 to {@link CATALOG_FACTS_MAX_IDS}. */
  readonly take: number;
  /** Narrows to the products whose title holds this text, case ignored; at most `PRODUCT_SEARCH_MAX` once trimmed. */
  readonly search?: string;
}

/** One page of product ids and the keyset position of the next one, `null` after the last. */
export interface CatalogFactsIdPage {
  readonly ids: readonly CoreId[];
  readonly next: CoreId | null;
}

const isTake = (take: number): boolean => Number.isSafeInteger(take) && take >= 1 && take <= CATALOG_FACTS_MAX_IDS;

/** `CoreId` is a compile-time brand only: a cursor cast from a request or job payload is checked again here. */
const isCursor = (after: CoreId | null): boolean => after === null || isCoreId(after);

/** The parsed, distinct ids among `ids`: a malformed one never reaches Postgres and is simply left out. */
const parsedIds = (ids: readonly string[]): CoreId[] => [
  ...new Set(ids.map(parseCoreId).filter((id) => id !== undefined)),
];

const ruleNameOf = ({ id, name }: CatalogNameEntry): CatalogRuleName => ({ id, name });

/**
 * The batched, keyset-paged product facts reader collection rules use (P2.S3, D2308), exported from the catalog
 * entry. Unlike the request facades it takes the store as an argument, so an outbox consumer or a job can call it with
 * a context it built on the store's channel (D2313); every method refuses a context on another channel, so a scope
 * can never be paired with another store's products. Every status is read (D2306); deleted products never are.
 *
 * The store's own status (active, archived) is the caller's to check, as the outbox consumer does (D2313): the reader
 * answers for any store of the business whose channel the context is on.
 */
@Injectable()
export class CatalogProductFactsReader {
  constructor(
    private readonly query: VendureProductFactsQuery,
    @Inject(STORE_SETTINGS) private readonly stores: StoreSettingsPort,
    @Inject(TAG_REPOSITORY) private readonly tags: TagRepositoryPort,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepositoryPort,
  ) {}

  /**
   * The facts of the store's live products among `productIds`, newest first, in at most three reads. Unknown, deleted,
   * other-store and malformed ids are left out.
   *
   * @throws {CatalogStoreChannelMismatchError} when `ctx` is not on the store's channel.
   * @throws {InvalidCatalogInputError} for more than {@link CATALOG_FACTS_MAX_IDS} ids.
   */
  async factsOf(
    ctx: RequestContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<readonly CatalogProductFacts[]> {
    await this.assertStoreChannel(ctx, scope);
    if (productIds.length > CATALOG_FACTS_MAX_IDS) throw new InvalidCatalogInputError();
    const ids = parsedIds(productIds);
    if (ids.length === 0) return [];
    const products = await this.query.products(ctx, ids);
    if (products.length === 0) return [];
    const found = products.map((product) => product.productId);
    const variants = groupByProduct(await this.query.variants(ctx, found));
    const tagIds = await this.tags.tagIdsOfProducts(asOperationContext(ctx), scope, found);
    return products.map((row) => factsOf(row, variants.get(row.productId) ?? [], tagIds.get(row.productId) ?? []));
  }

  /**
   * One keyset page of the store's live product ids, newest first: walking `next` until `null` meets every product
   * that lived through the walk exactly once, whatever is deleted or added meanwhile.
   *
   * @throws {CatalogStoreChannelMismatchError} when `ctx` is not on the store's channel.
   * @throws {InvalidCatalogInputError} for a `take` outside 1 to {@link CATALOG_FACTS_MAX_IDS}, a malformed `after`
   * or a `search` longer than `PRODUCT_SEARCH_MAX`.
   */
  async pageIds(ctx: RequestContext, scope: StoreScope, page: CatalogFactsPage): Promise<CatalogFactsIdPage> {
    await this.assertStoreChannel(ctx, scope);
    const search = page.search?.trim() ?? '';
    if (!isTake(page.take) || !isCursor(page.after) || search.length > PRODUCT_SEARCH_MAX) {
      throw new InvalidCatalogInputError();
    }
    const ids = await this.query.pageIds(ctx, {
      after: page.after,
      limit: page.take + 1,
      search: search === '' ? null : search,
    });
    const items = ids.slice(0, page.take);
    return { ids: items, next: ids.length > page.take ? (items.at(-1) ?? null) : null };
  }

  /**
   * The store's brands, tags and option names with their values, for the condition builder (AC3): names written in
   * another form are one (`normalForMatch`, D2305).
   *
   * @throws {CatalogStoreChannelMismatchError} when `ctx` is not on the store's channel.
   */
  async ruleOptionsOf(ctx: RequestContext, scope: StoreScope): Promise<CatalogRuleOptions> {
    await this.assertStoreChannel(ctx, scope);
    const operation = asOperationContext(ctx);
    const brands = await this.brands.list(operation, scope);
    const tags = await this.tags.list(operation, scope);
    const options = ruleOptionsFrom(await this.query.options(ctx));
    return { brands: brands.map(ruleNameOf), tags: tags.map(ruleNameOf), options };
  }

  private async assertStoreChannel(ctx: RequestContext, scope: StoreScope): Promise<void> {
    if (!(await this.stores.isChannelOf(asOperationContext(ctx), scope))) throw new CatalogStoreChannelMismatchError();
  }
}

function groupByProduct(variants: readonly FactsVariantRow[]): ReadonlyMap<CoreId, FactsVariantRow[]> {
  const grouped = new Map<CoreId, FactsVariantRow[]>();
  for (const variant of variants) grouped.set(variant.productId, [...(grouped.get(variant.productId) ?? []), variant]);
  return grouped;
}
