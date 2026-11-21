import { normalForMatch, type ProductStatus, type Snowflake } from '@cod/shared';
import type { CoreId } from '../domain/core-id';

/** One option value of a variant, such as `Color: Red`, in the store's language. */
export interface CatalogVariantOption {
  readonly name: string;
  readonly value: string;
}

/**
 * What a collection rule (P2.S3) or an offer target matches on, in the store's language (D2304, D2308). `price`,
 * `onSale` and `variantOptions` come from the product's non-hidden variants only, since the storefront never shows the
 * hidden ones (#246); `brandId` and `tagIds` are the store's own snowflakes.
 */
export interface CatalogProductFacts {
  readonly productId: CoreId;
  readonly title: string;
  readonly status: ProductStatus;
  readonly brandId: Snowflake | null;
  readonly tagIds: readonly Snowflake[];
  /** The lowest price among the non-hidden variants, or the product price when none is visible (whole DZD). */
  readonly price: number;
  /** True when some non-hidden variant has an old price above its price. */
  readonly onSale: boolean;
  /** The options of each non-hidden variant, in option order. */
  readonly variantOptions: readonly (readonly CatalogVariantOption[])[];
}

/** An option name of the store with its values, for the condition builder (AC3). */
export interface CatalogRuleOption {
  readonly name: string;
  readonly values: readonly string[];
}

/** A brand or tag of the store, for the condition builder. */
export interface CatalogRuleName {
  readonly id: Snowflake;
  readonly name: string;
}

/** What a condition builder offers: the store's brands, tags and option names with their values. */
export interface CatalogRuleOptions {
  readonly brands: readonly CatalogRuleName[];
  readonly tags: readonly CatalogRuleName[];
  readonly options: readonly CatalogRuleOption[];
}

/** A live product of the store channel as the facts query reads it. */
export interface FactsProductRow {
  readonly productId: CoreId;
  readonly title: string;
  readonly status: ProductStatus;
  readonly brandId: Snowflake | null;
  /** The stored price new variants take when the product has options (D2124). */
  readonly defaultPrice: number | null;
  /** How many live options the product has. */
  readonly optionGroupCount: number;
}

/** A live variant, hidden ones included, with its channel price. */
export interface FactsVariantRow {
  readonly productId: CoreId;
  readonly hidden: boolean;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly options: readonly CatalogVariantOption[];
}

/**
 * A request that names a store whose channel is not the context's: products follow the channel, links and settings
 * the scope, so the two must agree (D2142). A fault of the caller, like a context without a store.
 */
export class CatalogStoreChannelMismatchError extends Error {
  constructor() {
    super("A catalog facts read needs a context on the store's own channel");
    this.name = 'CatalogStoreChannelMismatchError';
  }
}

/**
 * The product price as the catalog shows it (`defaultsOf`, D2124): the only variant's price without options, else the
 * stored default price.
 */
function productPriceOf(row: FactsProductRow, variants: readonly FactsVariantRow[]): number {
  const [only] = variants;
  if (row.optionGroupCount === 0 && only !== undefined && variants.length === 1) return only.price;
  return row.defaultPrice ?? 0;
}

const isOnSale = (variant: FactsVariantRow): boolean => variant.oldPrice !== null && variant.oldPrice > variant.price;

/**
 * The facts of one product (D2304) from its row, every live variant of it and its tag ids: e.g. visible variants at
 * 800 and 3 000 DZD price it at 800, and a hidden Red variant gives it no Red option.
 */
export function factsOf(
  row: FactsProductRow,
  variants: readonly FactsVariantRow[],
  tagIds: readonly Snowflake[],
): CatalogProductFacts {
  const visible = variants.filter((variant) => !variant.hidden);
  return {
    productId: row.productId,
    title: row.title,
    status: row.status,
    brandId: row.brandId,
    tagIds,
    price: visible.length === 0 ? productPriceOf(row, variants) : Math.min(...visible.map((variant) => variant.price)),
    onSale: visible.some(isOnSale),
    variantOptions: visible.map((variant) => variant.options),
  };
}

/** One name with its values, keyed by their normal forms; the first spelling seen is kept. */
interface MergedOption {
  readonly name: string;
  readonly values: Map<string, string>;
}

/** Code-point order of the normal forms, which are distinct map keys: never a tie. */
const byNormalForm = ([leftKey]: [string, string], [rightKey]: [string, string]): number =>
  leftKey < rightKey ? -1 : 1;

/**
 * The option names of a store with their values (D2305, D2308): names and values written in another form ("COLOR ",
 * "لَون") are one, merged by `normalForMatch` and shown in the first spelling met; values are sorted by their normal
 * form. A name or value whose normal form is empty is left out: no rule can name it.
 */
export function ruleOptionsFrom(rows: readonly CatalogVariantOption[]): readonly CatalogRuleOption[] {
  const merged = new Map<string, MergedOption>();
  for (const { name, value } of rows) {
    const nameKey = normalForMatch(name);
    const valueKey = normalForMatch(value);
    if (nameKey === '' || valueKey === '') continue;
    const option = merged.get(nameKey) ?? { name, values: new Map<string, string>() };
    merged.set(nameKey, option);
    if (!option.values.has(valueKey)) option.values.set(valueKey, value);
  }
  return [...merged.values()].map((option) => ({
    name: option.name,
    values: [...option.values.entries()].sort(byNormalForm).map(([, value]) => value),
  }));
}
