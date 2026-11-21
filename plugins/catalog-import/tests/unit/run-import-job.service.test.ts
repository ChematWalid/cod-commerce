import { CATALOG_IMPORT_ROW_ERRORS, DomainError, type TenantScope, toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { AppliedRows, StoredImportRow } from '../../application/ports/import-row.port';
import type { OperationContext } from '../../application/ports/operation-context';
import { RunImportJobService } from '../../application/run-import-job.service';
import type { ImportCreate, ImportTargetProduct } from '../../domain/import-writes';
import type { SkuLookup } from '../../domain/plan-lookups';
import type { StoreScope } from '../../domain/store-scope';
import { plannedRow, previewedJob } from '../fakes/fake-import';

const E = CATALOG_IMPORT_ROW_ERRORS;
const SCOPE: StoreScope = { businessId: toBusinessId('1'), storeId: toStoreId('2') };
const CATALOG_REFUSAL = 'catalog.invalid-input';

/** A refusal the catalog facade throws from a write. */
class CatalogRefusal extends DomainError {
  readonly code = CATALOG_REFUSAL;
}

const stored = (change: Partial<StoredImportRow>): StoredImportRow => ({ ...plannedRow(change), applied: false });

/** A create row keyed by `sku`, which becomes the new product's SKU. */
const createRow = (rowNumber: number, sku: string): StoredImportRow =>
  stored({
    rowNumber,
    productKey: sku,
    values: { productKey: sku, name: sku, price: 900, options: [], imageUrls: [] },
  });

/**
 * The run's ports over arrays: `units.run` drops the marks its work made when the work throws, as the transaction's
 * rollback does. The catalog answers `held` SKUs as taken and refuses every update when `refuseUpdates` is set.
 */
class RunWorld {
  readonly marks: AppliedRows[] = [];
  readonly created: ImportCreate[] = [];
  readonly held = new Set<string>();
  refuseUpdates = false;
  target: ImportTargetProduct = { id: '7', hasOptions: false, isPack: false, variants: [] };

  constructor(private readonly pendingRows: readonly StoredImportRow[]) {}

  service(): RunImportJobService {
    const job = previewedJob({ status: 'confirming', rowCount: this.pendingRows.length });
    return new RunImportJobService({
      jobs: {
        byId: () => Promise.resolve(job),
        markRunning: () => Promise.resolve(),
        setProgress: () => Promise.resolve(),
        finish: () => Promise.resolve(),
      },
      rows: {
        pending: () => Promise.resolve(this.pendingRows),
        failed: () => Promise.resolve([]),
        markApplied: (_ctx, _scope, applied) => {
          this.marks.push(applied);
          return Promise.resolve();
        },
        resultOf: () => Promise.resolve({ created: 0, updated: 0, failed: 0 }),
      },
      catalog: {
        findBySkus: (_ctx, _scope, skus) =>
          Promise.resolve(
            new Map<string, SkuLookup>(
              skus.map((sku) => [
                sku,
                this.held.has(sku) ? { kind: 'one', productId: '1', variantId: null, isPack: false } : { kind: 'none' },
              ]),
            ),
          ),
        product: () => Promise.resolve(this.target),
        create: (_ctx, _scope, command) => {
          this.created.push(command);
          return Promise.resolve(String(this.created.length + 100));
        },
        update: () => (this.refuseUpdates ? Promise.reject(new CatalogRefusal('refused')) : Promise.resolve()),
      },
      origins: { recordImport: () => Promise.resolve(), recordLink: () => Promise.resolve() },
      activity: { recordImport: () => Promise.resolve() },
      report: { write: () => Promise.resolve() },
      units: {
        run: async <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>) => {
          const before = this.marks.length;
          try {
            return await work(ctx);
          } catch (error: unknown) {
            this.marks.splice(before);
            throw error;
          }
        },
      },
    });
  }

  run(): Promise<void> {
    return this.service().run({} as OperationContext, SCOPE, '900000000000101');
  }

  /** Each row's outcome: its product id, or its failure. */
  outcomes(): Record<number, string | null> {
    return Object.fromEntries(
      this.marks.flatMap((mark) => mark.rowNumbers.map((row) => [row, mark.failure ?? mark.productId])),
    );
  }
}

describe('RunImportJobService', () => {
  it('creates a previewed product whose SKUs no product holds yet', async () => {
    // Arrange
    const world = new RunWorld([createRow(2, 'NEW-1')]);

    // Act
    await world.run();

    // Assert
    expect(world.created).toHaveLength(1);
    expect(world.outcomes()).toEqual({ 2: '101' });
  });

  it('refuses a create whose SKU a product took since the preview, creating nothing (D2285)', async () => {
    // Arrange: the same file was imported first by another job, which created NEW-1
    const world = new RunWorld([createRow(2, 'NEW-1'), createRow(3, 'NEW-2')]);
    world.held.add('NEW-1');

    // Act
    await world.run();

    // Assert
    expect(world.created.map((command) => command.product.sku)).toEqual(['NEW-2']);
    expect(world.outcomes()).toEqual({ 2: E.SKU_TAKEN, 3: '101' });
  });

  it("an update the catalog refuses keeps a row's own refusal and fails the others with the catalog's code (D2286)", async () => {
    // Arrange: row 3 names a variant the product no longer has; the catalog refuses the rest of the group
    const world = new RunWorld([
      stored({ rowNumber: 2, action: 'update', productKey: 'OLD', productId: '7' }),
      stored({
        rowNumber: 3,
        action: 'update',
        productKey: 'OLD',
        productId: '7',
        values: { name: 'Shirt', price: 1500, options: [{ name: 'Size', value: 'XL' }], imageUrls: [] },
      }),
    ]);
    world.target = {
      id: '7',
      hasOptions: true,
      isPack: false,
      variants: [{ id: '71', sku: 'OLD-S', optionValues: ['S'] }],
    };
    world.refuseUpdates = true;

    // Act
    await world.run();

    // Assert
    expect(world.outcomes()).toEqual({ 2: CATALOG_REFUSAL, 3: E.VARIANT_NOT_FOUND });
  });
});
