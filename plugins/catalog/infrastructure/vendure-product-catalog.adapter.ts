import { CATALOG_MAX_PAGE_SIZE, type Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { SortOrder } from '@vendure/common/lib/generated-types';
import {
  CollectionService,
  type ListQueryOptions,
  ProductService,
  type Product,
  ProductVariantService,
  type RequestContext,
} from '@vendure/core';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type {
  ProductCatalogPort,
  ProductCriteria,
  ProductPage,
  SlugLookup,
} from '../domain/ports/product-catalog.port';
import type { ProductDraft, ProductFields, ProductRecord, ProductUpdate } from '../domain/product';
import { createsDefaultVariant, type MatrixPlan } from '../domain/variant-matrix';
import { toRequestContext } from './request-scope';
import { derivedSlug, merchantSlug } from './stored-slug';
import type { OptionTarget } from './vendure-option-sync';
import {
  brandIdOf,
  clearableId,
  coreIdOf,
  engineIdOf,
  type ProductCustomFields,
  productRecordOf,
} from './vendure-product-mapper';
import { VendureProductStructure } from './vendure-product-structure';

/** Relations a product is read with; its variants are read apart, with their channel price. */
const PRODUCT_RELATIONS = [
  'featuredAsset',
  'assets',
  'optionGroups',
  'optionGroups.options',
] as const satisfies readonly string[];

/** The store's language: every product string is written in it, whatever the display language (D2112). */
const languageOf = (ctx: RequestContext) => ctx.channel.defaultLanguageCode;

/** Our product custom fields from the catalog's fields. */
function customFieldsOf(fields: ProductFields): ProductCustomFields {
  return {
    status: fields.status,
    type: fields.type,
    oldPrice: fields.oldPrice,
    defaultPrice: fields.price,
    defaultSku: fields.sku,
    brandId: fields.brandId,
    weight: fields.weight,
    width: fields.width,
    height: fields.height,
    length: fields.length,
    label: fields.label,
    cardCaption: fields.cardCaption,
    metaTitle: fields.metaTitle,
    metaDescription: fields.metaDescription,
  };
}

/** The Vendure product input of the catalog's fields; a draft is never `enabled` (D2109). */
function productInputOf(ctx: RequestContext, fields: ProductFields, slug: string | null) {
  return {
    enabled: fields.status !== 'draft',
    featuredAssetId: clearableId(fields.featuredAssetId),
    assetIds: [...fields.assetIds],
    translations: [
      {
        languageCode: languageOf(ctx),
        name: fields.title,
        description: fields.description ?? '',
        ...(slug === null ? {} : { slug }),
      },
    ],
    customFields: customFieldsOf(fields),
  };
}

/**
 * {@link ProductCatalogPort} on Vendure's services in the caller's store channel (D2100, D2101): products, option
 * groups, options and variants are written through `ProductService` and friends, then taken out of the default
 * channel (D2133). Reads go through `findOne`/`findAll`, which only see the active channel and live rows.
 */
@Injectable()
export class VendureProductCatalog implements ProductCatalogPort {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
    private readonly collections: CollectionService,
    private readonly structure: VendureProductStructure,
  ) {}

  async create(ctx: OperationContext, draft: ProductDraft, plan: MatrixPlan): Promise<ProductRecord> {
    const request = toRequestContext(ctx);
    const slug = draft.slug === null ? derivedSlug(draft.title) : merchantSlug(draft.slug);
    const product = await this.products.create(request, productInputOf(request, draft, slug));
    const target = this.targetOf(request, coreIdOf(product.id));
    const { groups } = await this.structure.options.sync(target, [], draft.optionGroups);
    await this.structure.variants.apply(target, plan, groups, { current: [], fields: draft });
    return this.readAndLeaveDefault(request, target.productId);
  }

  async update(ctx: OperationContext, id: CoreId, update: ProductUpdate): Promise<ProductRecord | undefined> {
    const request = toRequestContext(ctx);
    const record = await this.read(request, id);
    if (record === undefined) return undefined;
    const slug = update.slug === null ? null : merchantSlug(update.slug);
    await this.products.update(request, { id: engineIdOf(id), ...productInputOf(request, update.fields, slug) });
    const target = this.targetOf(request, id);
    if (update.matrix !== null) {
      const synced = await this.structure.options.sync(target, record.optionGroups, update.matrix.groups);
      // Retired variants first, then the options nobody uses, then the new variants: core checks a new variant
      // against the product's live groups, so a dropped group must be gone before (a product leaving its options).
      await this.structure.variants.retire(target, update.matrix.plan, record.variants);
      await this.structure.options.removeStale(target, synced);
      await this.structure.variants.createNew(target, update.matrix.plan, synced.groups, update.fields);
    }
    // A default variant created by this save already holds the planned SKU and the product's defaults.
    if (update.matrix === null || !createsDefaultVariant(update.matrix.plan)) {
      await this.syncDefaultVariant(request, target, update.fields);
    }
    await this.structure.variants.applyChanges(target, update.variants);
    return this.readAndLeaveDefault(request, id);
  }

  async lockForUpdate(ctx: OperationContext, id: CoreId): Promise<boolean> {
    const request = toRequestContext(ctx);
    if ((await this.products.findOne(request, id, [])) === undefined) return false;
    await this.structure.lock.acquire(request, id);
    return true;
  }

  findOne(ctx: OperationContext, id: CoreId): Promise<ProductRecord | undefined> {
    return this.read(toRequestContext(ctx), id);
  }

  async list(ctx: OperationContext, criteria: ProductCriteria): Promise<ProductPage> {
    if (criteria.productIds?.length === 0) return { items: [], totalItems: 0 };
    const request = toRequestContext(ctx);
    const page = await this.products.findAll(request, listOptionsOf(criteria), []);
    const records = await Promise.all(page.items.map((product) => this.read(request, coreIdOf(product.id))));
    return { items: records.filter((record) => record !== undefined), totalItems: page.totalItems };
  }

  async softDelete(ctx: OperationContext, id: CoreId): Promise<boolean> {
    const request = toRequestContext(ctx);
    if ((await this.products.findOne(request, id, [])) === undefined) return false;
    await this.products.softDelete(request, id);
    return true;
  }

  async findBySlug(ctx: OperationContext, slug: string): Promise<SlugLookup> {
    const normal = merchantSlug(slug);
    const options = { take: 1, filter: { slug: { eq: normal } } } as ListQueryOptions<Product>;
    const { items } = await this.products.findAll(toRequestContext(ctx), options, []);
    const [holder] = items;
    return { slug: normal, productId: holder === undefined ? undefined : coreIdOf(holder.id) };
  }

  async clearBrand(ctx: OperationContext, brandId: Snowflake): Promise<readonly CoreId[]> {
    const request = toRequestContext(ctx);
    const handled = new Set<CoreId>();
    const stuck = new Set<CoreId>();
    const cleared: CoreId[] = [];
    // Page after page from the start: a product handled here leaves the brand (cleared, or moved by another save), so
    // the next first page holds only products not handled yet, and a product that leaves the brand meanwhile cannot
    // shift a page past one that still names it (offset paging would skip that one). Only a handled product that names
    // the brand again is left out by id, so the filter stays constant in practice (Vendure ID filters have no `gt`).
    for (let page = await this.brandPage(request, brandId, stuck); page.length > 0;) {
      for (const id of page) {
        if (handled.has(id)) {
          stuck.add(id);
          continue;
        }
        handled.add(id);
        if (await this.clearIfBranded(request, id, brandId)) cleared.push(id);
      }
      page = await this.brandPage(request, brandId, stuck);
    }
    return cleared;
  }

  async existingCollections(ctx: OperationContext, ids: readonly CoreId[]): Promise<readonly CoreId[]> {
    const found = await this.collections.findByIds(toRequestContext(ctx), [...ids]);
    return found.map((collection) => coreIdOf(collection.id));
  }

  /** The first page of live products of the store naming `brandId`, in id order, without those in `excluded`. */
  private async brandPage(ctx: RequestContext, brandId: Snowflake, excluded: ReadonlySet<CoreId>): Promise<CoreId[]> {
    const page = await this.products.findAll(ctx, brandPageOf(brandId, excluded), []);
    return page.items.map((product) => coreIdOf(product.id));
  }

  /**
   * Clears the brand of product `id` under its lock, so a save of the product in flight finishes first and cannot
   * write the brand back from what it read before; a product that left the brand meanwhile keeps its new one.
   */
  private async clearIfBranded(ctx: RequestContext, id: CoreId, brandId: Snowflake): Promise<boolean> {
    await this.structure.lock.acquire(ctx, id);
    const product = await this.products.findOne(ctx, id, []);
    if (product === undefined || brandIdOf(product) !== brandId) return false;
    await this.products.update(ctx, { id: engineIdOf(id), customFields: { brandId: null } });
    return true;
  }

  private targetOf(ctx: RequestContext, productId: CoreId): OptionTarget {
    return { ctx, productId, language: languageOf(ctx) };
  }

  /** Without options, the default variant follows the product's price, SKU, old price and barcode (D2124). */
  private async syncDefaultVariant(ctx: RequestContext, target: OptionTarget, fields: ProductFields): Promise<void> {
    const record = await this.read(ctx, target.productId);
    const [only] = record?.variants ?? [];
    if (record === undefined || record.optionGroups.length > 0 || only === undefined) return;
    await this.structure.variants.syncDefault(target, only.id, fields);
  }

  private async readAndLeaveDefault(ctx: RequestContext, id: CoreId): Promise<ProductRecord> {
    const record = await this.read(ctx, id);
    if (record === undefined) throw new Error('A product saved in this transaction could not be read back');
    await this.structure.defaultChannel.leave(ctx, record);
    return record;
  }

  private async read(ctx: RequestContext, id: CoreId): Promise<ProductRecord | undefined> {
    const product = await this.products.findOne(ctx, id, [...PRODUCT_RELATIONS]);
    if (product === undefined) return undefined;
    const variants = await this.variants.getVariantsByProductId(ctx, id, {}, ['options']);
    return productRecordOf(product, variants.items, languageOf(ctx));
  }
}

/** The first page of the products naming `brandId` among those not in `excluded`, in id order. */
function brandPageOf(brandId: Snowflake, excluded: ReadonlySet<CoreId>): ListQueryOptions<Product> {
  const filter = { brandId: { eq: brandId }, ...(excluded.size === 0 ? {} : { id: { notIn: [...excluded] } }) };
  return { skip: 0, take: CATALOG_MAX_PAGE_SIZE, sort: { id: SortOrder.ASC }, filter };
}

/** The product ids a page is limited to and those it leaves out; an empty exclusion is no filter (`NOT IN ()`). */
function idFilterOf({ productIds, excludedProductIds }: ProductCriteria) {
  const excluded = excludedProductIds ?? [];
  if (productIds === undefined && excluded.length === 0) return undefined;
  return {
    ...(productIds === undefined ? {} : { in: [...productIds] }),
    ...(excluded.length === 0 ? {} : { notIn: [...excluded] }),
  };
}

/** One status and one of a public context's statuses, both when both are given (AND, D2109). */
function statusFilterOf({ status, statuses }: ProductCriteria) {
  if (status === undefined && statuses === undefined) return {};
  return {
    status: {
      ...(status === undefined ? {} : { eq: status }),
      ...(statuses === undefined ? {} : { in: [...statuses] }),
    },
  };
}

/** The Vendure list options of a page: newest first; our custom fields filter by name (D2123). */
function listOptionsOf(criteria: ProductCriteria): ListQueryOptions<Product> {
  const id = idFilterOf(criteria);
  const filter = {
    ...(id === undefined ? {} : { id }),
    ...statusFilterOf(criteria),
    ...(criteria.brandId === undefined ? {} : { brandId: { eq: criteria.brandId } }),
  };
  return {
    skip: criteria.skip,
    take: criteria.take,
    sort: { createdAt: SortOrder.DESC },
    filter,
  };
}
