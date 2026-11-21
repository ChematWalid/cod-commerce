import { CatalogProductCommands, type ProductView } from '@cod/plugin-catalog';
import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { ComponentProduct } from '../domain/component-product';
import { InvalidPackInputError, PackNotFoundError } from '../domain/errors';
import type { CatalogProductsPort, PackSaveLock, PackWrite } from '../domain/ports/catalog-products.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** A catalog product as a pack reads it. */
const componentOf = (view: ProductView): ComponentProduct => ({
  id: view.id,
  type: view.type,
  status: view.status,
  price: view.price,
  weight: view.weight,
  optionGroups: view.optionGroups.map((group) => ({
    name: group.name,
    values: group.values.map((value) => value.name),
  })),
  variants: view.variants.map((variant) => ({
    id: variant.id,
    price: variant.price,
    optionValues: variant.optionValues,
  })),
});

/**
 * Catalog's refusals as pack refusals, so the pack API answers its own codes: a gone product is the pack's not found,
 * a concurrent edit stays itself (409), any other catalog refusal is invalid pack input. Non-domain errors pass.
 */
function packErrorOf(error: unknown): unknown {
  if (!(error instanceof DomainError)) return error;
  if (error.code === CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND) return new PackNotFoundError();
  if (error.code === CATALOG_ERROR_CODES.CONCURRENT_UPDATE) return error;
  return new InvalidPackInputError();
}

/**
 * {@link CatalogProductsPort} on catalog's explicit-scope facade (D2201): reads and the pack-write entry, so catalog's
 * scope checks, locks and `product.changed` apply. The scope comes from the tenant guard (request) or the delivery
 * (consumer), never from the ctx channel (D2236).
 */
@Injectable()
export class CatalogProductsAdapter implements CatalogProductsPort {
  constructor(private readonly commands: CatalogProductCommands) {}

  async byId(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ComponentProduct | undefined> {
    const view = await this.commands.byId(toRequestContext(ctx), scope, productId).catch((error: unknown) => {
      throw packErrorOf(error);
    });
    return view === undefined ? undefined : componentOf(view);
  }

  async lockForSave(ctx: OperationContext, scope: StoreScope, lock: PackSaveLock): Promise<void> {
    await this.commands.lockForPackSave(toRequestContext(ctx), scope, lock).catch((error: unknown) => {
      throw packErrorOf(error);
    });
  }

  async writePackValues(ctx: OperationContext, scope: StoreScope, values: PackWrite): Promise<void> {
    await this.commands.writePackValues(toRequestContext(ctx), scope, values).catch((error: unknown) => {
      throw packErrorOf(error);
    });
  }
}
