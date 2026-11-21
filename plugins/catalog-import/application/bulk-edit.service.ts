import { type BulkEditChangedField, type BulkEditCommand, catalogRefIdKey, DomainError } from '@cod/shared';
import { type BulkChanges, distinctProductIds, type EditableProduct, planProductEdit } from '../domain/bulk-edit-plan';
import { CollectionsUnavailableError, ProductNotFoundError, TaxonomyNotFoundError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogProductsPort, TaxonomyRef } from './ports/catalog-products.port';
import type { OperationContext } from './ports/operation-context';
import type { ActivityActor, ProductActivityPort } from './ports/product-activity.port';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What a bulk edit answers for one product: changed (the fields, maybe none) or refused (its error code). */
export interface BulkEditOutcome {
  readonly productId: string;
  readonly ok: boolean;
  readonly changedFields: readonly BulkEditChangedField[];
  readonly error: string | null;
}

/** The ports a bulk edit runs on. */
export interface BulkEditDeps {
  readonly catalog: CatalogProductsPort;
  readonly units: UnitOfWorkPort;
  readonly activity: ProductActivityPort;
}

/** Thrown at the end of a dry run's unit so its writes roll back; carries what the real run would change. */
class DryRunRollback extends Error {
  constructor(readonly changedFields: readonly BulkEditChangedField[]) {
    super('bulk edit dry run');
  }
}

/** The store's id of each id given, compared as the boundary parses them; one unknown id refuses them all. */
function resolveIds(refs: readonly TaxonomyRef[], ids: readonly string[]): string[] {
  const byKey = new Map(refs.map((ref) => [catalogRefIdKey(ref.id), ref.id]));
  return ids.map((id) => {
    const stored = byKey.get(catalogRefIdKey(id));
    if (stored === undefined) throw new TaxonomyNotFoundError();
    return stored;
  });
}

/**
 * "Bulk edit selected products" (D2213, AC4). Brand and tag ids are resolved in the store first, so a foreign or
 * unknown one refuses the whole request before anything is written. Then each product runs in its own unit of work:
 * read, plan, status, patch, activity row, so the row commits with the write. A refusal of one product (not found,
 * price out of range, a catalog validation error) is that product's error and the others still change; a fault of
 * the server is rethrown. The product is read again under catalog's save lock before it is planned, so concurrent
 * relative price or tag changes of one product both apply (D2255). `dryRun` runs the same writes and then rolls the
 * unit back, so catalog's own refusals show and nothing commits (D2255).
 */
export class BulkEditService {
  constructor(private readonly deps: BulkEditDeps) {}

  /**
   * @throws {CollectionsUnavailableError} when collections are named (until P2.S3).
   * @throws {TaxonomyNotFoundError} when a brand or tag id is not of the store.
   */
  async edit(
    ctx: OperationContext,
    scope: StoreScope,
    actor: ActivityActor,
    command: BulkEditCommand,
  ): Promise<readonly BulkEditOutcome[]> {
    if (command.changes.collectionIds !== undefined) throw new CollectionsUnavailableError();
    const changes = await this.resolved(ctx, scope, command.changes);
    const outcomes: BulkEditOutcome[] = [];
    for (const productId of distinctProductIds(command.productIds)) {
      outcomes.push(await this.editOne(ctx, scope, { productId, changes, actor, dryRun: command.dryRun }));
    }
    return outcomes;
  }

  /** The changes with brand and tag ids in the store's spelling; reads the taxonomy only when one is named. */
  private async resolved(
    ctx: OperationContext,
    scope: StoreScope,
    changes: BulkEditCommand['changes'],
  ): Promise<BulkChanges> {
    const { status, brandId, addTagIds, removeTagIds, price } = changes;
    const plain: BulkChanges = { status, brandId, price };
    if (typeof brandId !== 'string' && addTagIds === undefined && removeTagIds === undefined) return plain;
    const index = await this.deps.catalog.taxonomyIndex(ctx, scope);
    return {
      ...plain,
      ...(typeof brandId === 'string' ? { brandId: resolveIds(index.brands, [brandId])[0] } : {}),
      ...(addTagIds === undefined ? {} : { addTagIds: resolveIds(index.tags, addTagIds) }),
      ...(removeTagIds === undefined ? {} : { removeTagIds: resolveIds(index.tags, removeTagIds) }),
    };
  }

  /** One product in its own unit of work; a domain refusal rolls it back and becomes its error. */
  private async editOne(ctx: OperationContext, scope: StoreScope, edit: ProductEdit): Promise<BulkEditOutcome> {
    try {
      const changedFields = await this.deps.units.run(ctx, scope, (tx) => this.apply(tx, scope, edit));
      return { productId: edit.productId, ok: true, changedFields, error: null };
    } catch (error: unknown) {
      if (error instanceof DryRunRollback) {
        return { productId: edit.productId, ok: true, changedFields: error.changedFields, error: null };
      }
      if (!(error instanceof DomainError)) throw error;
      return { productId: edit.productId, ok: false, changedFields: [], error: error.code };
    }
  }

  private async apply(
    tx: OperationContext,
    scope: StoreScope,
    { productId, changes, actor, dryRun }: ProductEdit,
  ): Promise<readonly BulkEditChangedField[]> {
    const { catalog, activity } = this.deps;
    const product = await this.lockedProduct(tx, scope, productId);
    const plan = planProductEdit(product, changes);
    if (plan.changedFields.length === 0) return plan.changedFields;
    if (plan.status !== undefined) await catalog.setStatus(tx, scope, productId, plan.status);
    if (plan.patch !== undefined) await catalog.update(tx, scope, productId, plan.patch);
    await activity.recordBulkEdit(tx, { scope, productId: product.id, changedFields: plan.changedFields, actor });
    if (dryRun) throw new DryRunRollback(plan.changedFields);
    return plan.changedFields;
  }

  /**
   * The product as committed once its save lock is held. It is read first so a foreign or deleted id takes no lock
   * on another store's product, then read again under the lock.
   */
  private async lockedProduct(tx: OperationContext, scope: StoreScope, productId: string): Promise<EditableProduct> {
    const { catalog } = this.deps;
    if ((await catalog.byId(tx, scope, productId)) === undefined) throw new ProductNotFoundError();
    await catalog.lockForEdit(tx, scope, productId);
    const product = await catalog.byId(tx, scope, productId);
    if (product === undefined) throw new ProductNotFoundError();
    return product;
  }
}

/** One product's part of a bulk edit. */
interface ProductEdit {
  readonly productId: string;
  readonly changes: BulkChanges;
  readonly actor: ActivityActor;
  readonly dryRun: boolean;
}
