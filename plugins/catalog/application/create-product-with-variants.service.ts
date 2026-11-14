import type { ProductCommand, VariantPatchCommand } from '@cod/shared';
import { comparableText } from '../domain/comparable-text';
import { InvalidCatalogInputError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { VariantRecord } from '../domain/product';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { CreateProductService } from './create-product.service';
import type { ProductSaveResult } from './product-view';
import { UpdateProductService } from './update-product.service';

/**
 * The own values of one variant of a new product, found by its option values (one per option, in option order;
 * none for a product without options). An absent field keeps the planned default.
 */
export interface VariantOverride {
  readonly optionValues: readonly string[];
  readonly sku?: string | null;
  readonly price?: number;
  readonly oldPrice?: number | null;
  readonly barcode?: string | null;
}

/** A product to create and the own values of its variants (D2219). */
export interface ProductWithVariantsCommand {
  readonly product: ProductCommand;
  readonly variants: readonly VariantOverride[];
}

const combinationKey = (optionValues: readonly string[]): string => JSON.stringify(optionValues.map(comparableText));

/** The variant edit of `override`, on the variant of `variants` with its combination. */
function patchOf(variants: readonly VariantRecord[], override: VariantOverride): VariantPatchCommand {
  const key = combinationKey(override.optionValues);
  const variant = variants.find((held) => combinationKey(held.optionValues) === key);
  if (variant === undefined) throw new InvalidCatalogInputError();
  return {
    id: variant.id,
    ...(override.sku === undefined ? {} : { sku: override.sku }),
    ...(override.price === undefined ? {} : { price: override.price }),
    ...(override.oldPrice === undefined ? {} : { oldPrice: override.oldPrice }),
    ...(override.barcode === undefined ? {} : { barcode: override.barcode }),
  };
}

function hasRepeatedCombination(overrides: readonly VariantOverride[]): boolean {
  const keys = overrides.map((override) => combinationKey(override.optionValues));
  return new Set(keys).size !== keys.length;
}

/**
 * "Create a product with its own variant SKUs and prices" (D2219): catalog's create plans every variant from the
 * product's defaults (`<sku>-n`, one price), so this creates the product, then edits the variants the rows name, in one
 * transaction: a refused edit leaves no product behind. Each step publishes its own `product.changed`.
 */
export class CreateProductWithVariantsService {
  private readonly creating: CreateProductService;
  private readonly updating: UpdateProductService;

  constructor(private readonly ports: ProductPorts) {
    this.creating = new CreateProductService(ports);
    this.updating = new UpdateProductService(ports);
  }

  /**
   * @throws {InvalidCatalogInputError} when a row names a combination the product does not have, or two rows name
   * one; any refusal of the create or the edit rolls both back.
   */
  async create(
    ctx: OperationContext,
    scope: StoreScope,
    command: ProductWithVariantsCommand,
  ): Promise<ProductSaveResult> {
    if (hasRepeatedCombination(command.variants)) throw new InvalidCatalogInputError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const created = await this.creating.create(tx, scope, command.product);
      if (command.variants.length === 0) return created;
      const variants = command.variants.map((override) => patchOf(created.product.variants, override));
      return this.updating.update(tx, scope, created.product.id, { variants });
    });
  }
}
