import { type CoreId, toCoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type {
  ProductCatalogPort,
  ProductCriteria,
  ProductPage,
  SlugLookup,
} from '../../domain/ports/product-catalog.port';
import type {
  OptionGroupRecord,
  ProductDraft,
  ProductFields,
  ProductRecord,
  ProductUpdate,
  VariantChange,
  VariantRecord,
} from '../../domain/product';
import {
  createsDefaultVariant,
  type MatrixPlan,
  type NewVariant,
  type OptionGroupSpec,
} from '../../domain/variant-matrix';
import { merchantSlug, normalisedSlug } from '../../infrastructure/stored-slug';
import { T0 } from '../support/builders';

/** The store a fake context stands for: tests build contexts with {@link storeContext}. */
interface StoreContext {
  readonly storeId: string;
}

/** A context of the fake catalog acting in `storeId`'s channel. */
export const storeContext = (storeId: string): OperationContext => ({ storeId }) as unknown as OperationContext;

const storeOf = (ctx: OperationContext): string => (ctx as unknown as StoreContext).storeId;

interface StoredProduct {
  readonly storeId: string;
  record: ProductRecord;
  deleted: boolean;
}

/**
 * Vendure's product, variant and option entities of every store in memory, one channel per store. It applies the
 * matrix plan as the Vendure adapter does, so the use-case tests see the same variants.
 */
export class InMemoryProductCatalog implements ProductCatalogPort {
  readonly stored: StoredProduct[] = [];
  /** Collections per store channel: `storeId → ids`. */
  readonly collections = new Map<string, Set<string>>();
  /** Lock, read and write calls in order (`lock:<id>`, `findOne:<id>`, …), so a test sees what came first. */
  readonly calls: string[] = [];
  private nextId = 900_001;

  private newId(): CoreId {
    this.nextId += 1;
    return toCoreId(String(this.nextId));
  }

  private live(ctx: OperationContext, id: CoreId): StoredProduct | undefined {
    return this.stored.find((row) => row.storeId === storeOf(ctx) && row.record.id === id && !row.deleted);
  }

  private groupsOf(specs: readonly OptionGroupSpec[]): OptionGroupRecord[] {
    return specs.map((spec) => ({
      id: this.newId(),
      name: spec.name,
      values: spec.values.map((name) => ({ id: this.newId(), name })),
    }));
  }

  private variantOf(created: NewVariant, fields: ProductFields): VariantRecord {
    const isDefault = created.optionValues.length === 0;
    return {
      id: this.newId(),
      name: created.name,
      sku: created.sku,
      price: created.price,
      oldPrice: fields.oldPrice,
      barcode: isDefault ? fields.barcode : null,
      isHidden: false,
      optionValues: created.optionValues,
      featuredAssetId: null,
    };
  }

  private variantsAfter(record: ProductRecord, plan: MatrixPlan, fields: ProductFields): VariantRecord[] {
    const removed = new Set<string>(plan.remove);
    const kept = record.variants
      .filter((variant) => !removed.has(variant.id))
      .map((variant) => {
        const planned = plan.keep.find((entry) => entry.id === variant.id);
        return planned === undefined ? variant : { ...variant, name: planned.name, optionValues: planned.optionValues };
      });
    return [...kept, ...plan.create.map((created) => this.variantOf(created, fields))];
  }

  create(ctx: OperationContext, draft: ProductDraft, plan: MatrixPlan): Promise<ProductRecord> {
    const { slug, optionGroups, ...fields } = draft;
    const blank: ProductRecord = {
      ...fields,
      id: this.newId(),
      slug: normalisedSlug(slug ?? fields.title),
      optionGroups: this.groupsOf(optionGroups),
      variants: [],
      createdAt: new Date(T0.getTime() + this.nextId),
      updatedAt: T0,
    };
    const record = { ...blank, variants: this.variantsAfter(blank, plan, fields) };
    this.stored.push({ storeId: storeOf(ctx), record, deleted: false });
    return Promise.resolve(record);
  }

  update(ctx: OperationContext, id: CoreId, update: ProductUpdate): Promise<ProductRecord | undefined> {
    this.calls.push(`update:${id}`);
    const row = this.live(ctx, id);
    if (row === undefined) return Promise.resolve(undefined);
    const { fields, matrix } = update;
    const sameGroups = JSON.stringify(matrix?.groups) === JSON.stringify(optionSpecs(row.record));
    const variants = matrix === null ? row.record.variants : this.variantsAfter(row.record, matrix.plan, fields);
    const optionGroups = matrix === null || sameGroups ? row.record.optionGroups : this.groupsOf(matrix.groups);
    const synced =
      matrix !== null && createsDefaultVariant(matrix.plan) ? variants : syncDefault(variants, optionGroups, fields);
    row.record = {
      ...row.record,
      ...fields,
      slug: update.slug === null ? row.record.slug : normalisedSlug(update.slug),
      optionGroups,
      variants: synced.map((variant) => applyChange(variant, update.variants)),
    };
    return Promise.resolve(row.record);
  }

  lockForUpdate(ctx: OperationContext, id: CoreId): Promise<boolean> {
    this.calls.push(`lock:${id}`);
    return Promise.resolve(this.live(ctx, id) !== undefined);
  }

  findOne(ctx: OperationContext, id: CoreId): Promise<ProductRecord | undefined> {
    this.calls.push(`findOne:${id}`);
    return Promise.resolve(this.live(ctx, id)?.record);
  }

  list(ctx: OperationContext, criteria: ProductCriteria): Promise<ProductPage> {
    const allowed = criteria.productIds === undefined ? undefined : new Set<string>(criteria.productIds);
    const matching = this.stored
      .filter((row) => row.storeId === storeOf(ctx) && !row.deleted)
      .map((row) => row.record)
      .filter((record) => allowed === undefined || allowed.has(record.id))
      .filter((record) => criteria.status === undefined || record.status === criteria.status)
      .filter((record) => criteria.brandId === undefined || record.brandId === criteria.brandId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const items = matching.slice(criteria.skip, criteria.skip + criteria.take);
    return Promise.resolve({ items, totalItems: matching.length });
  }

  softDelete(ctx: OperationContext, id: CoreId): Promise<boolean> {
    this.calls.push(`softDelete:${id}`);
    const row = this.live(ctx, id);
    if (row !== undefined) row.deleted = true;
    return Promise.resolve(row !== undefined);
  }

  findBySlug(ctx: OperationContext, slug: string): Promise<SlugLookup> {
    const normal = merchantSlug(slug);
    const holder = this.stored.find(
      (row) => row.storeId === storeOf(ctx) && !row.deleted && row.record.slug === normal,
    );
    return Promise.resolve({ slug: normal, productId: holder?.record.id });
  }

  clearBrand(ctx: OperationContext, brandId: string): Promise<readonly CoreId[]> {
    const branded = this.stored.filter(
      (row) => row.storeId === storeOf(ctx) && !row.deleted && row.record.brandId === brandId,
    );
    for (const row of branded) row.record = { ...row.record, brandId: null };
    return Promise.resolve(branded.map((row) => row.record.id));
  }

  existingCollections(ctx: OperationContext, ids: readonly CoreId[]): Promise<readonly CoreId[]> {
    const own = this.collections.get(storeOf(ctx)) ?? new Set<string>();
    return Promise.resolve(ids.filter((id) => own.has(id)));
  }

  /** Adds a collection to `storeId`'s channel, as P2.S3 or a test would. */
  addCollection(storeId: string): CoreId {
    const id = this.newId();
    this.collections.set(storeId, new Set([...(this.collections.get(storeId) ?? []), id]));
    return id;
  }
}

function optionSpecs(record: ProductRecord): OptionGroupSpec[] {
  return record.optionGroups.map((group) => ({ name: group.name, values: group.values.map((value) => value.name) }));
}

/** Without options, the default variant carries the product's price, SKU and barcode (D2124). */
function syncDefault(variants: readonly VariantRecord[], groups: readonly OptionGroupRecord[], fields: ProductFields) {
  if (groups.length > 0) return variants;
  return variants.map((variant) => ({
    ...variant,
    price: fields.price,
    sku: fields.sku ?? '',
    barcode: fields.barcode,
    oldPrice: fields.oldPrice,
  }));
}

function applyChange(variant: VariantRecord, changes: readonly VariantChange[]): VariantRecord {
  const change = changes.find((entry) => entry.id === variant.id);
  if (change === undefined) return variant;
  const defined = Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined));
  return { ...variant, ...defined, sku: change.sku === undefined ? variant.sku : (change.sku ?? '') };
}
