import {
  type SoldOutBehavior,
  type StorefrontCollection,
  type StorefrontProduct,
  toBusinessId,
  toSnowflake,
  toStoreId,
} from '@cod/shared';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { ProductIdPage, ProjectionSource, ProjectionSourcePort } from '../../domain/ports/projection-source.port';
import type { StorefrontReadsPort } from '../../domain/ports/storefront-reads.port';
import type { StorefrontStore, StorefrontStorePort } from '../../domain/ports/storefront-store.port';
import type { StoreScope } from '../../domain/store-scope';

export const STORE_A: StoreScope = {
  businessId: toBusinessId('41'),
  storeId: toStoreId(toSnowflake('7340032000000001')),
};
export const STORE_B: StoreScope = {
  businessId: toBusinessId('52'),
  storeId: toStoreId(toSnowflake('7340032000000002')),
};

/** A storefront context of a store, as the tenancy adapter would hand out. */
interface FakeContext {
  readonly store: StorefrontStore;
}

/** Storefront contexts of the stores it was told about; any other store is unavailable. */
export class FakeStorefrontStores implements StorefrontStorePort {
  private readonly stores = new Map<string, StorefrontStore>();

  add(scope: StoreScope, soldOutBehavior: SoldOutBehavior = 'keep'): this {
    this.stores.set(scope.storeId, { scope, soldOutBehavior });
    return this;
  }

  contextOf(scope: StoreScope): OperationContext {
    const store = this.stores.get(scope.storeId);
    if (store === undefined) throw new Error('unknown store');
    return asOperationContext({ store } satisfies FakeContext);
  }

  storeOf(ctx: OperationContext): StorefrontStore {
    return (ctx as unknown as FakeContext).store;
  }

  contextFor(storeId: string): Promise<OperationContext | undefined> {
    const store = this.stores.get(storeId);
    return Promise.resolve(store === undefined ? undefined : asOperationContext({ store } satisfies FakeContext));
  }
}

/** The catalog of each store as the projection reads it. */
export class FakeProjectionSource implements ProjectionSourcePort {
  private readonly products = new Map<string, Map<string, ProjectionSource>>();
  /** Every product read, as `storeId/productId`. */
  readonly reads: string[] = [];

  constructor(private readonly stores: FakeStorefrontStores) {}

  put(scope: StoreScope, source: ProjectionSource): this {
    const products = this.products.get(scope.storeId) ?? new Map<string, ProjectionSource>();
    products.set(source.product.id, source);
    this.products.set(scope.storeId, products);
    return this;
  }

  drop(scope: StoreScope, productId: string): void {
    this.products.get(scope.storeId)?.delete(productId);
  }

  productOf(ctx: OperationContext, productId: string): Promise<ProjectionSource | undefined> {
    const { storeId } = this.stores.storeOf(ctx).scope;
    this.reads.push(`${storeId}/${productId}`);
    const source = this.products.get(storeId)?.get(productId);
    return Promise.resolve(source?.product.status === 'draft' ? undefined : source);
  }

  productIds(ctx: OperationContext, _scope: StoreScope, after: string | null, take: number): Promise<ProductIdPage> {
    const { storeId } = this.stores.storeOf(ctx).scope;
    const ids = [...(this.products.get(storeId)?.keys() ?? [])].sort((a, b) => Number(b) - Number(a));
    const from = after === null ? 0 : ids.indexOf(after) + 1;
    const page = ids.slice(from, from + take);
    const next = from + take < ids.length ? (page.at(-1) ?? null) : null;
    return Promise.resolve({ ids: page, next });
  }
}

/** Product pages and collections of each store, by slug. */
export class FakeStorefrontReads implements StorefrontReadsPort {
  readonly products = new Map<string, StorefrontProduct>();
  readonly collectionList: StorefrontCollection[] = [];
  readonly members = new Map<string, readonly string[]>();

  productBySlug(_ctx: OperationContext, slug: string): Promise<StorefrontProduct | undefined> {
    return Promise.resolve(this.products.get(slug));
  }

  collections(_ctx: OperationContext, take: number): Promise<readonly StorefrontCollection[]> {
    return Promise.resolve(this.collectionList.slice(0, take));
  }

  collectionBySlug(_ctx: OperationContext, slug: string): Promise<StorefrontCollection | undefined> {
    return Promise.resolve(this.collectionList.find((collection) => collection.slug === slug));
  }

  memberIds(_ctx: OperationContext, collectionId: string): Promise<readonly string[] | undefined> {
    return Promise.resolve(this.members.get(collectionId));
  }
}
