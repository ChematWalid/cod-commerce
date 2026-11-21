import { INT_COLUMN_MAX } from '@cod/shared';
import { type CoreId, parseCoreId } from '../domain/core-id';
import { PACK_PRODUCT_TYPE } from '../domain/constants';
import { comparableText } from '../domain/comparable-text';
import { InvalidCatalogInputError, ProductNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductFields, ProductRecord, ProductUpdate, VariantChange } from '../domain/product';
import type { StoreScope } from '../domain/store-scope';
import { type OptionGroupSpec, planVariantMatrix } from '../domain/variant-matrix';
import type { ProductPorts } from './catalog-ports';
import { type ProductSaveResult, viewOf, warningsOf } from './product-view';

/** One value of a pack's shared option and the price of the pack variant that carries it. */
export interface PackOptionPrice {
  readonly value: string;
  readonly price: number;
}

/**
 * What catalog-packs computed for a pack (D2203): its price and weight, and its variant matrix. `sharedOption`
 * `null` is the `per_component` mode: no option and one default variant at `price`; otherwise one variant per
 * value, priced each.
 */
export interface PackValues {
  readonly productId: string;
  readonly price: number;
  readonly weight: number | null;
  readonly sharedOption: { readonly name: string; readonly values: readonly PackOptionPrice[] } | null;
}

const isStorable = (value: number | null): boolean =>
  value === null || (Number.isSafeInteger(value) && value >= 0 && value <= INT_COLUMN_MAX);

function isValid(values: PackValues): boolean {
  const prices = [values.price, ...(values.sharedOption?.values.map((entry) => entry.price) ?? [])];
  return prices.every(isStorable) && isStorable(values.weight);
}

const groupsOf = (values: PackValues): readonly OptionGroupSpec[] =>
  values.sharedOption === null
    ? []
    : [{ name: values.sharedOption.name, values: values.sharedOption.values.map((entry) => entry.value) }];

/** The price edits that give each variant of `record` the price of its shared value. */
function priceChangesOf(record: ProductRecord, values: PackValues): VariantChange[] {
  const priceOf = new Map(values.sharedOption?.values.map((entry) => [comparableText(entry.value), entry.price]));
  return record.variants.flatMap((variant) => {
    const price = priceOf.get(comparableText(variant.optionValues[0] ?? ''));
    return price === undefined || price === variant.price ? [] : [{ id: variant.id, price }];
  });
}

/**
 * Writes what catalog-packs computed into a pack product (D2203, D2227): its price, weight and variant matrix, in
 * both variant modes, so a switch from `shared_option` to `per_component` leaves no stale variant. This is the one
 * write that crosses the pack boundary the catalog API keeps; it refuses any product that is not a pack. Publishes
 * `product.changed` once.
 */
export class WritePackValuesService {
  constructor(private readonly ports: ProductPorts) {}

  /**
   * @throws {ProductNotFoundError} for a product of another store or business, or a malformed id.
   * @throws {InvalidCatalogInputError} for a product that is not a pack, a price or weight that is no int column
   * value, or a shared option the matrix refuses.
   */
  async write(ctx: OperationContext, scope: StoreScope, values: PackValues): Promise<ProductSaveResult> {
    const id = parseCoreId(values.productId);
    if (id === undefined) throw new ProductNotFoundError();
    if (!isValid(values)) throw new InvalidCatalogInputError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      if (!(await this.ports.products.lockForUpdate(tx, id))) throw new ProductNotFoundError();
      const record = await this.ports.products.findOne(tx, id);
      if (record === undefined) throw new ProductNotFoundError();
      if (record.type !== PACK_PRODUCT_TYPE) throw new InvalidCatalogInputError();
      const saved = await this.save(tx, record, values);
      await this.ports.events.publish(tx, scope, id, 'updated');
      return { product: await viewOf(this.ports, tx, scope, saved), warnings: warningsOf(saved) };
    });
  }

  private async save(ctx: OperationContext, record: ProductRecord, values: PackValues): Promise<ProductRecord> {
    const fields: ProductFields = { ...record, price: values.price, weight: values.weight, oldPrice: null };
    const groups = groupsOf(values);
    const plan = planVariantMatrix({
      productName: fields.title,
      baseSku: fields.sku,
      basePrice: fields.price,
      groups,
      existingGroups: record.optionGroups.map((group) => group.name),
      existing: record.variants,
    });
    const planned = await this.update(ctx, record.id, { fields, slug: null, matrix: { groups, plan }, variants: [] });
    const changes = priceChangesOf(planned, values);
    if (changes.length === 0) return planned;
    return this.update(ctx, record.id, { fields, slug: null, matrix: null, variants: changes });
  }

  private async update(ctx: OperationContext, id: CoreId, update: ProductUpdate): Promise<ProductRecord> {
    const saved = await this.ports.products.update(ctx, id, update);
    if (saved === undefined) throw new ProductNotFoundError();
    return saved;
  }
}
