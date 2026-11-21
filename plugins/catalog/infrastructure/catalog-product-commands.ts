import type { ProductCommand, ProductPatchCommand, ProductStatus } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { ProductWithVariantsCommand } from '../application/create-product-with-variants.service';
import type { ProductIdsPage, ProductIdsPageRequest, TaxonomyIndex } from '../application/product-lookup.service';
import type { ProductSaveResult, ProductView } from '../application/product-view';
import type { PackValues } from '../application/write-pack-values.service';
import { parseCoreId } from '../domain/core-id';
import { ProductNotFoundError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import { packSaveLockSteps } from '../domain/product-lock-order';
import type { SkuMatch } from '../domain/sku-match';
import type { StoreScope } from '../domain/store-scope';
import { CatalogCommandReads, CatalogCommandWrites, CatalogPackEntries } from './catalog-command-use-cases';
import { CatalogStoreContexts } from './store-context';

/** A status change of one product. */
export interface ProductStatusChange {
  readonly productId: string;
  readonly status: ProductStatus;
}

/** The products a pack save writes (its pack product) and reads (its components' products). */
export interface PackSaveLock {
  readonly packProductId: string;
  readonly componentIds: readonly string[];
}

/**
 * The explicit-scope write and lookup facade later sessions use (catalog-packs, catalog-import; D2201): every call
 * names its business and store, so it also works in a job or an outbox consumer where no tenant guard ran, and runs
 * catalog's own use cases, so validation, locks and `product.changed` stay in catalog. Each call first checks that
 * `scope` is a live store of its active business and that `ctx` runs in that store's channel, never Vendure's default
 * one; otherwise it answers `catalog.product-not-found`. It takes no actor: the callers write their own audit rows.
 * It does not check that a request's user may act for the business: a request caller takes `scope` from the tenant
 * guard's `TenantContext`, never from the ctx channel (a channel token is not a secret) (D2236).
 */
@Injectable()
export class CatalogProductCommands {
  constructor(
    private readonly writes: CatalogCommandWrites,
    private readonly reads: CatalogCommandReads,
    private readonly packs: CatalogPackEntries,
    private readonly contexts: CatalogStoreContexts,
  ) {}

  /** "Create a product" in the scope's store, as the catalog API does. */
  async create(ctx: RequestContext, scope: StoreScope, command: ProductCommand): Promise<ProductSaveResult> {
    await this.contexts.assertScope(ctx, scope);
    return this.writes.creating.create(asOperationContext(ctx), scope, command);
  }

  /** "Create a product" whose variants keep their own SKU, price, old price and barcode, in one transaction (D2219). */
  async createWithVariants(
    ctx: RequestContext,
    scope: StoreScope,
    command: ProductWithVariantsCommand,
  ): Promise<ProductSaveResult> {
    await this.contexts.assertScope(ctx, scope);
    return this.writes.creatingWithVariants.create(asOperationContext(ctx), scope, command);
  }

  /** "Edit a product" of the scope's store, under the catalog API's rules, the pack boundary included (D2227). */
  async update(
    ctx: RequestContext,
    scope: StoreScope,
    productId: string,
    patch: ProductPatchCommand,
  ): Promise<ProductSaveResult> {
    await this.contexts.assertScope(ctx, scope);
    return this.writes.updating.update(asOperationContext(ctx), scope, productId, patch);
  }

  /**
   * Writes what catalog-packs computed into a pack product: price, weight and variant matrix (D2203, D2227). The one
   * entry that crosses the pack boundary; it refuses a product that is not a pack.
   */
  async writePackValues(ctx: RequestContext, scope: StoreScope, values: PackValues): Promise<ProductSaveResult> {
    await this.contexts.assertScope(ctx, scope);
    return this.packs.writing.write(asOperationContext(ctx), scope, values);
  }

  /**
   * Holds, until the transaction of `ctx` ends, the pack product's lock exclusively and each component's lock shared,
   * in id order (D2242): an edit, status change or delete of a component then commits only after the save, so its
   * `product.changed` finds the saved pack. Call it inside the save's transaction, before reading the components.
   *
   * @throws {ProductNotFoundError} for a malformed pack product id or a scope `ctx` does not run in.
   */
  async lockForPackSave(ctx: RequestContext, scope: StoreScope, lock: PackSaveLock): Promise<void> {
    await this.contexts.assertScope(ctx, scope);
    const packProductId = parseCoreId(lock.packProductId);
    if (packProductId === undefined) throw new ProductNotFoundError();
    for (const step of packSaveLockSteps(packProductId, lock.componentIds)) {
      if (step.mode === 'exclusive') await this.packs.locks.acquire(ctx, step.productId);
      else await this.packs.locks.acquireShared(ctx, step.productId);
    }
  }

  /** "Set a product Active, Hidden or Draft" in the scope's store. */
  async setStatus(ctx: RequestContext, scope: StoreScope, change: ProductStatusChange): Promise<ProductView> {
    await this.contexts.assertScope(ctx, scope);
    return this.writes.statuses.set(asOperationContext(ctx), scope, change.productId, change.status);
  }

  /** The product `productId` of the scope's store, or `undefined` (another store's, a deleted or a malformed id). */
  async byId(ctx: RequestContext, scope: StoreScope, productId: string): Promise<ProductView | undefined> {
    await this.contexts.assertScope(ctx, scope);
    return this.reads.reading.byId(asOperationContext(ctx), scope, productId);
  }

  /** What each SKU names in the scope's store: none, one product (and variant) or ambiguous (D2201, D2209). */
  async findBySkus(
    ctx: RequestContext,
    scope: StoreScope,
    skus: readonly string[],
  ): Promise<ReadonlyMap<string, SkuMatch>> {
    await this.contexts.assertScope(ctx, scope);
    return this.reads.lookup.findBySkus(asOperationContext(ctx), scope, skus);
  }

  /** One page of the ids the list's filter holds, ascending, each once (D2218). */
  async listIdsPage(ctx: RequestContext, scope: StoreScope, page: ProductIdsPageRequest): Promise<ProductIdsPage> {
    await this.contexts.assertScope(ctx, scope);
    return this.reads.lookup.listIdsPage(asOperationContext(ctx), scope, page);
  }

  /** The brands and tags of the scope's store by id and name. */
  async taxonomyIndex(ctx: RequestContext, scope: StoreScope): Promise<TaxonomyIndex> {
    await this.contexts.assertScope(ctx, scope);
    return this.reads.lookup.taxonomyIndex(asOperationContext(ctx), scope);
  }

  /**
   * The store-channel context of `scope` (admin API, no user) that a worker or an outbox consumer passes to the
   * other calls; an archived store or a store of another business is refused. An outbox consumer passes its
   * delivery's context as `within`, so the store context joins that transaction (D2282).
   */
  storeContext(scope: StoreScope, within?: RequestContext): Promise<RequestContext> {
    return this.contexts.storeContext(scope, within);
  }
}
