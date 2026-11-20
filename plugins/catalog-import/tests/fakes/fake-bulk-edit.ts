import { CATALOG_ERROR_CODES, DomainError, type ProductStatus, type TenantScope } from '@cod/shared';
import type { CatalogProductsPort, TaxonomyRefs } from '../../application/ports/catalog-products.port';
import { asOperationContext, type OperationContext } from '../../application/ports/operation-context';
import type { ProductActivityPort, ProductBulkEditActivity } from '../../application/ports/product-activity.port';
import type { UnitOfWorkPort } from '../../application/ports/unit-of-work.port';
import type { EditableProduct, ProductEditPatch } from '../../domain/bulk-edit-plan';
import type { StoreScope } from '../../domain/store-scope';

/** A write a fake unit of work holds until it commits. */
export type FakeWrite =
  | { readonly kind: 'update'; readonly productId: string; readonly patch: ProductEditPatch }
  | { readonly kind: 'status'; readonly productId: string; readonly status: ProductStatus }
  | { readonly kind: 'activity'; readonly activity: ProductBulkEditActivity };

/** The context a fake unit of work hands out: the writes of its transaction. */
interface FakeTx {
  readonly pending: FakeWrite[];
}

const txOf = (ctx: OperationContext): FakeTx => {
  const tx = ctx as unknown as Partial<FakeTx>;
  if (tx.pending === undefined) throw new Error('a write outside a unit of work');
  return tx as FakeTx;
};

/** A catalog refusal of a write, as the facade throws it. */
export class FakeCatalogRefusal extends DomainError {
  readonly code = CATALOG_ERROR_CODES.INVALID_INPUT;
  constructor() {
    super('refused');
  }
}

/** Catalog, unit of work and activity log over arrays: a unit commits its writes or drops them all. */
export class FakeBulkEditWorld implements CatalogProductsPort, UnitOfWorkPort, ProductActivityPort {
  readonly committed: FakeWrite[] = [];
  readonly units: number[] = [];
  /** Product ids whose `update` the catalog refuses, after their status change was held. */
  readonly refuseUpdateOf = new Set<string>();
  /** Product ids whose `setStatus` fails with a fault of the server. */
  readonly faultOn = new Set<string>();
  taxonomyReads = 0;

  constructor(
    readonly products: Map<string, EditableProduct>,
    readonly taxonomy: TaxonomyRefs,
  ) {}

  async run<T>(_ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>): Promise<T> {
    const tx: FakeTx = { pending: [] };
    this.units.push(this.units.length);
    const result = await work(asOperationContext(tx));
    this.committed.push(...tx.pending);
    return result;
  }

  storeContext(): Promise<OperationContext> {
    return Promise.resolve(asOperationContext({}));
  }

  byId(_ctx: OperationContext, _scope: StoreScope, productId: string): Promise<EditableProduct | undefined> {
    return Promise.resolve(this.products.get(productId));
  }

  update(ctx: OperationContext, _scope: StoreScope, productId: string, patch: ProductEditPatch): Promise<void> {
    if (this.refuseUpdateOf.has(productId)) return Promise.reject(new FakeCatalogRefusal());
    txOf(ctx).pending.push({ kind: 'update', productId, patch });
    return Promise.resolve();
  }

  setStatus(ctx: OperationContext, _scope: StoreScope, productId: string, status: ProductStatus): Promise<void> {
    if (this.faultOn.has(productId)) return Promise.reject(new Error('connection lost'));
    txOf(ctx).pending.push({ kind: 'status', productId, status });
    return Promise.resolve();
  }

  taxonomyIndex(): Promise<TaxonomyRefs> {
    this.taxonomyReads += 1;
    return Promise.resolve(this.taxonomy);
  }

  recordBulkEdit(ctx: OperationContext, activity: ProductBulkEditActivity): Promise<void> {
    txOf(ctx).pending.push({ kind: 'activity', activity });
    return Promise.resolve();
  }

  /** The committed writes of one kind. */
  writesOf<K extends FakeWrite['kind']>(kind: K): Extract<FakeWrite, { kind: K }>[] {
    return this.committed.filter((write): write is Extract<FakeWrite, { kind: K }> => write.kind === kind);
  }
}
