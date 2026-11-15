import { type ProductCommand, type VariantPatchCommand, variantPatchSchema } from '@cod/shared';
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

/** The own values a row may set, checked as the catalog API checks a variant edit (money, SKU and barcode text). */
const overrideValuesSchema = variantPatchSchema.pick({ sku: true, price: true, oldPrice: true, barcode: true });

type OverrideValues = Omit<VariantPatchCommand, 'id'>;

interface ParsedOverride {
  readonly key: string;
  readonly values: OverrideValues;
}

/**
 * `override`'s values as the catalog API would accept them: callers such as the import pass plain rows, not commands
 * parsed at an API edge (D2201 keeps validation in catalog).
 *
 * @throws {InvalidCatalogInputError} when a value breaks the variant edit's rules.
 */
function parseOverride(override: VariantOverride): ParsedOverride {
  const { sku, price, oldPrice, barcode } = override;
  const parsed = overrideValuesSchema.safeParse({ sku, price, oldPrice, barcode });
  if (!parsed.success) throw new InvalidCatalogInputError();
  return { key: combinationKey(override.optionValues), values: parsed.data };
}

/** The variant edit of `override`, on the variant of `variants` with its combination. */
function patchOf(variants: readonly VariantRecord[], override: ParsedOverride): VariantPatchCommand {
  const variant = variants.find((held) => combinationKey(held.optionValues) === override.key);
  if (variant === undefined) throw new InvalidCatalogInputError();
  const { sku, price, oldPrice, barcode } = override.values;
  return {
    id: variant.id,
    ...(sku === undefined ? {} : { sku }),
    ...(price === undefined ? {} : { price }),
    ...(oldPrice === undefined ? {} : { oldPrice }),
    ...(barcode === undefined ? {} : { barcode }),
  };
}

function hasRepeatedCombination(overrides: readonly ParsedOverride[]): boolean {
  return new Set(overrides.map((override) => override.key)).size !== overrides.length;
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
   * @throws {InvalidCatalogInputError} when a row holds a value the variant edit refuses (checked before any write),
   * names a combination the product does not have, or two rows name one; any refusal of the create or the edit rolls both back.
   */
  async create(
    ctx: OperationContext,
    scope: StoreScope,
    command: ProductWithVariantsCommand,
  ): Promise<ProductSaveResult> {
    const overrides = command.variants.map(parseOverride);
    if (hasRepeatedCombination(overrides)) throw new InvalidCatalogInputError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const created = await this.creating.create(tx, scope, command.product);
      if (overrides.length === 0) return created;
      const variants = overrides.map((override) => patchOf(created.product.variants, override));
      return this.updating.update(tx, scope, created.product.id, { variants });
    });
  }
}
