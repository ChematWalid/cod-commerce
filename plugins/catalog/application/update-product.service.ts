import type { ProductPatchCommand, VariantPatchCommand } from '@cod/shared';
import { type CoreId, parseCoreId } from '../domain/core-id';
import { ProductNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { optionSpecsOf, type ProductRecord, type ProductUpdate, type VariantChange } from '../domain/product';
import type { StoreScope } from '../domain/store-scope';
import { planVariantMatrix } from '../domain/variant-matrix';
import type { ProductPorts } from './catalog-ports';
import { fieldsAfterPatch, slugOf } from './product-fields';
import { type CheckedReferences, coreIdsOf, ProductReferenceCheck, type ReferenceInput } from './product-references';
import { type ProductSaveResult, saveLinks, viewOf, warningsOf } from './product-view';

/** The variant edits of a patch, each naming a live variant of `record`; any other id answers not found (D2135). */
function variantChangesOf(record: ProductRecord, patches: readonly VariantPatchCommand[]): VariantChange[] {
  const live = new Set<string>(record.variants.map((variant) => variant.id));
  return patches.map(({ id, featuredAssetId, ...change }) => {
    const variantId = parseCoreId(id);
    if (variantId === undefined || !live.has(variantId)) throw new ProductNotFoundError();
    const asset =
      featuredAssetId === undefined || featuredAssetId === null
        ? featuredAssetId
        : coreIdsOf([featuredAssetId], ProductNotFoundError)[0];
    return { ...change, id: variantId, ...(asset === undefined ? {} : { featuredAssetId: asset }) };
  });
}

/** The featured images edited variants name, checked like product images. */
const variantAssetIdsOf = (patch: ProductPatchCommand): string[] =>
  (patch.variants ?? []).flatMap((variant) =>
    typeof variant.featuredAssetId === 'string' ? [variant.featuredAssetId] : [],
  );

/** Every id a patch names, for the reference check. */
const referencesOf = (patch: ProductPatchCommand): ReferenceInput => ({
  ...patch,
  variantAssetIds: variantAssetIdsOf(patch),
  orderManagerIds: patch.settings?.orderManagerIds,
});

/** The update of `record` that `patch` asks for; the matrix is always re-planned so names follow the title. */
function updateOf(
  record: ProductRecord,
  patch: ProductPatchCommand,
  refs: CheckedReferences,
  ports: ProductPorts,
): ProductUpdate {
  const fields = fieldsAfterPatch(record, patch, refs, ports.sanitizer);
  const groups = patch.optionGroups ?? optionSpecsOf(record);
  const plan = planVariantMatrix({
    productName: fields.title,
    baseSku: fields.sku,
    basePrice: fields.price,
    groups,
    existing: record.variants,
  });
  return {
    fields,
    slug: slugOf(patch.slug),
    matrix: { groups, plan },
    variants: variantChangesOf(record, patch.variants ?? []),
  };
}

/**
 * "Edit a product" of the caller's active store: an absent field stays, `null` clears, edits to variants name live
 * variants of this product only (D2135), and editing options keeps the variants whose combination remains (D2124).
 * Links and settings are replaced only when sent; `product.changed` is published once (D2127).
 */
export class UpdateProductService {
  private readonly references: ProductReferenceCheck;

  constructor(private readonly ports: ProductPorts) {
    this.references = new ProductReferenceCheck(ports);
  }

  async update(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    patch: ProductPatchCommand,
  ): Promise<ProductSaveResult> {
    const id = parseCoreId(rawId);
    if (id === undefined) throw new ProductNotFoundError();
    const references = referencesOf(patch);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.references.lockNamed(tx, references);
      if (!(await this.ports.products.lockForUpdate(tx, id))) throw new ProductNotFoundError();
      const record = await this.ports.products.findOne(tx, id);
      if (record === undefined) throw new ProductNotFoundError();
      const refs = await this.references.check(tx, scope, references);
      const saved = await this.save(tx, id, updateOf(record, patch, refs, this.ports));
      await saveLinks(this.ports, tx, { scope, productId: id }, { refs, settings: patch.settings });
      await this.ports.events.publish(tx, scope, id, 'updated');
      return { product: await viewOf(this.ports, tx, scope, saved), warnings: warningsOf(saved) };
    });
  }

  private async save(ctx: OperationContext, id: CoreId, update: ProductUpdate): Promise<ProductRecord> {
    const saved = await this.ports.products.update(ctx, id, update);
    if (saved === undefined) throw new ProductNotFoundError();
    return saved;
  }
}
