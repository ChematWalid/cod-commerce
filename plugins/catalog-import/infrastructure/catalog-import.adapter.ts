import { CatalogProductCommands, type ProductView } from '@cod/plugin-catalog';
import { productInputSchema, productPatchSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { TaxonomyRefs } from '../application/ports/catalog-products.port';
import type { CatalogImportPort } from '../application/ports/catalog-import.port';
import type { OperationContext } from '../application/ports/operation-context';
import { PACK_PRODUCT_TYPE } from '../domain/constants';
import { InvalidImportInputError } from '../domain/errors';
import type { ImportCreate, ImportTargetProduct, ImportUpdate } from '../domain/import-writes';
import type { SkuLookup } from '../domain/plan-lookups';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-context';

/** A product as an import update reads it: its live variants by SKU and option values. */
const targetOf = (view: ProductView): ImportTargetProduct => ({
  id: view.id,
  hasOptions: view.optionGroups.length > 0,
  isPack: view.type === PACK_PRODUCT_TYPE,
  variants: view.variants.map((variant) => ({ id: variant.id, sku: variant.sku, optionValues: variant.optionValues })),
});

/**
 * A command checked by catalog's own schema, as the catalog API would: a value it refuses is the rows'
 * `catalog-import.invalid-input`, before any write.
 */
function parsed<Schema extends typeof productInputSchema | typeof productPatchSchema>(
  schema: Schema,
  input: unknown,
): ReturnType<Schema['parse']> {
  const result = schema.safeParse(input);
  if (!result.success) throw new InvalidImportInputError();
  return result.data as ReturnType<Schema['parse']>;
}

const createInputOf = (command: ImportCreate): unknown => ({
  ...command.product,
  type: 'physical',
  tagIds: [...command.product.tagIds],
  optionGroups: command.product.optionGroups.map((group) => ({ name: group.name, values: [...group.values] })),
});

const patchInputOf = (change: ImportUpdate): unknown => {
  const { variants, tagIds, ...fields } = change;
  return {
    ...fields,
    ...(tagIds === undefined ? {} : { tagIds: [...tagIds] }),
    ...(variants.length === 0 ? {} : { variants: variants.map((variant) => ({ ...variant })) }),
  };
};

/**
 * {@link CatalogImportPort} on catalog's explicit-scope facade (D2201): SKU lookups, product reads and the two writes
 * run catalog's use cases (validation, locks, `product.changed`); `createWithVariants` keeps each variant's own SKU
 * and price (D2219). The scope comes from the tenant guard (request) or the job row (worker), never from the ctx
 * channel (D2236).
 */
@Injectable()
export class CatalogImportAdapter implements CatalogImportPort {
  constructor(private readonly commands: CatalogProductCommands) {}

  async findBySkus(
    ctx: OperationContext,
    scope: StoreScope,
    skus: readonly string[],
  ): Promise<ReadonlyMap<string, SkuLookup>> {
    const matches = await this.commands.findBySkus(toRequestContext(ctx), scope, skus);
    return new Map(
      [...matches].map(([sku, match]): [string, SkuLookup] => [
        sku,
        match.kind === 'one'
          ? {
              kind: 'one',
              productId: match.productId,
              variantId: match.variantId,
              isPack: match.productType === PACK_PRODUCT_TYPE,
            }
          : match,
      ]),
    );
  }

  async product(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ImportTargetProduct | undefined> {
    const view = await this.commands.byId(toRequestContext(ctx), scope, productId);
    return view === undefined ? undefined : targetOf(view);
  }

  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs> {
    return this.commands.taxonomyIndex(toRequestContext(ctx), scope);
  }

  async create(ctx: OperationContext, scope: StoreScope, command: ImportCreate): Promise<string> {
    const product = parsed(productInputSchema, createInputOf(command));
    const variants = command.variants.map((variant) => ({ ...variant, optionValues: [...variant.optionValues] }));
    const saved = await this.commands.createWithVariants(toRequestContext(ctx), scope, { product, variants });
    return saved.product.id;
  }

  async update(ctx: OperationContext, scope: StoreScope, productId: string, change: ImportUpdate): Promise<void> {
    const patch = parsed(productPatchSchema, patchInputOf(change));
    await this.commands.update(toRequestContext(ctx), scope, productId, patch);
  }
}
