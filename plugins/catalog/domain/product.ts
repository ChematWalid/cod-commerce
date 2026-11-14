import type { ProductStatus, ProductType, Snowflake } from '@cod/shared';
import type { CoreId } from './core-id';
import type { MatrixPlan, OptionGroupSpec } from './variant-matrix';

/** One value of a product option as stored, e.g. Red. */
export interface OptionValueRecord {
  readonly id: CoreId;
  readonly name: string;
}

/** One option of a product as stored, its values in display order. */
export interface OptionGroupRecord {
  readonly id: CoreId;
  readonly name: string;
  readonly values: readonly OptionValueRecord[];
}

/** A live variant of a product. */
export interface VariantRecord {
  readonly id: CoreId;
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly barcode: string | null;
  readonly isHidden: boolean;
  /** Its option values in group order; empty for the default variant of a product without options. */
  readonly optionValues: readonly string[];
  readonly featuredAssetId: CoreId | null;
}

/** The product fields kept on the product itself (Vendure's `Product` and our custom fields, D2100). */
export interface ProductFields {
  readonly title: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly type: ProductType;
  /** The default variant's price without options; the price of new variants with options (D2124). */
  readonly price: number;
  readonly oldPrice: number | null;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly weight: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly length: number | null;
  readonly featuredAssetId: CoreId | null;
  readonly assetIds: readonly CoreId[];
  readonly brandId: Snowflake | null;
  readonly label: string | null;
  readonly cardCaption: string | null;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
}

/** A product as the catalog reads it from Vendure, in the store's language (D2112). */
export interface ProductRecord extends ProductFields {
  readonly id: CoreId;
  readonly slug: string;
  readonly optionGroups: readonly OptionGroupRecord[];
  readonly variants: readonly VariantRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A change to one existing variant; an absent field stays, `null` clears. */
export interface VariantChange {
  readonly id: CoreId;
  readonly price?: number;
  readonly oldPrice?: number | null;
  readonly sku?: string | null;
  readonly barcode?: string | null;
  readonly isHidden?: boolean;
  readonly featuredAssetId?: CoreId | null;
}

/** What a new product is stored from: its fields, its slug (or none, to derive it from the title) and its options. */
export interface ProductDraft extends ProductFields {
  readonly slug: string | null;
  readonly optionGroups: readonly OptionGroupSpec[];
}

/** What an edit stores: the full fields after the edit, the options and plan when they change, the variant edits. */
export interface ProductUpdate {
  readonly fields: ProductFields;
  /** A new slug, or `null` to keep the stored one. */
  readonly slug: string | null;
  /** The options and the matrix plan, when the edit touches the options or the product's defaults. */
  readonly matrix: { readonly groups: readonly OptionGroupSpec[]; readonly plan: MatrixPlan } | null;
  readonly variants: readonly VariantChange[];
}

/** The live option groups of a record as matrix input. */
export function optionSpecsOf(record: ProductRecord): readonly OptionGroupSpec[] {
  return record.optionGroups.map((group) => ({ name: group.name, values: group.values.map((value) => value.name) }));
}
