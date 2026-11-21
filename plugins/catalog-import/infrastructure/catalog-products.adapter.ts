import { CatalogProductCommands, type ProductView } from '@cod/plugin-catalog';
import type { ProductPatchCommand, ProductStatus } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { CatalogProductsPort, TaxonomyRefs } from '../application/ports/catalog-products.port';
import { asOperationContext, type OperationContext } from '../application/ports/operation-context';
import type { EditableProduct, ProductEditPatch } from '../domain/bulk-edit-plan';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-context';

/** A catalog product as a bulk edit reads it. */
const editableOf = (view: ProductView): EditableProduct => ({
  id: view.id,
  status: view.status,
  brandId: view.brandId,
  tagIds: view.tagIds,
  price: view.price,
  variants: view.variants.map((variant) => ({ id: variant.id, price: variant.price })),
});

/** A bulk-edit patch as catalog's "edit a product" command: only the fields it holds. */
const patchCommandOf = (patch: ProductEditPatch): ProductPatchCommand => ({
  ...(patch.brandId === undefined ? {} : { brandId: patch.brandId }),
  ...(patch.tagIds === undefined ? {} : { tagIds: [...patch.tagIds] }),
  ...(patch.price === undefined ? {} : { price: patch.price }),
  ...(patch.variants === undefined ? {} : { variants: patch.variants.map(({ id, price }) => ({ id, price })) }),
});

/**
 * {@link CatalogProductsPort} on catalog's explicit-scope facade (D2201): catalog's scope checks, locks and
 * `product.changed` apply, and its refusals pass as catalog domain errors. The scope comes from the tenant guard
 * (request) or the job row (worker), never from the ctx channel (D2236).
 */
@Injectable()
export class CatalogProductsAdapter implements CatalogProductsPort {
  constructor(private readonly commands: CatalogProductCommands) {}

  async storeContext(scope: StoreScope): Promise<OperationContext> {
    return asOperationContext(await this.commands.storeContext(scope));
  }

  async byId(ctx: OperationContext, scope: StoreScope, productId: string): Promise<EditableProduct | undefined> {
    const view = await this.commands.byId(toRequestContext(ctx), scope, productId);
    return view === undefined ? undefined : editableOf(view);
  }

  /** Catalog's pack-save lock with no component: the product's exclusive save lock alone (D2255). */
  async lockForEdit(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    await this.commands.lockForPackSave(toRequestContext(ctx), scope, { packProductId: productId, componentIds: [] });
  }

  async update(ctx: OperationContext, scope: StoreScope, productId: string, patch: ProductEditPatch): Promise<void> {
    await this.commands.update(toRequestContext(ctx), scope, productId, patchCommandOf(patch));
  }

  async setStatus(ctx: OperationContext, scope: StoreScope, productId: string, status: ProductStatus): Promise<void> {
    await this.commands.setStatus(toRequestContext(ctx), scope, { productId, status });
  }

  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs> {
    return this.commands.taxonomyIndex(toRequestContext(ctx), scope);
  }
}
