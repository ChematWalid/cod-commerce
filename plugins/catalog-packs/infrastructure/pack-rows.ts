import { toSnowflake } from '@cod/shared';
import type { PackDefinition, PackRecord, PackStatus } from '../domain/pack';
import type { PackComponentEntity } from './pack-component.entity';
import type { PackEntity } from './pack.entity';

/** The mode columns of a `catalog_pack` row for `definition`. */
export function modeColumnsOf(definition: PackDefinition): Partial<PackEntity> {
  return {
    pricingMode: definition.packPricingMode,
    fixedPrice: definition.packFixedPrice,
    discountType: definition.packDiscountType,
    discountValue: definition.packDiscountValue,
    variantMode: definition.packVariantMode,
    sharedOption: definition.packSharedOption,
    weightMode: definition.packWeightMode,
    fixedWeightGrams: definition.packFixedWeightGrams,
  };
}

/**
 * The record of a stored row and its component rows (in `position` order). The words were written from the shared
 * enums by this adapter only, so they are read back as those enums.
 */
export function packRecordOf(row: PackEntity, components: readonly PackComponentEntity[]): PackRecord {
  return {
    id: toSnowflake(row.id),
    productId: String(row.productId),
    status: row.status as PackStatus,
    packPricingMode: row.pricingMode as PackRecord['packPricingMode'],
    packFixedPrice: row.fixedPrice,
    packDiscountType: row.discountType as PackRecord['packDiscountType'],
    packDiscountValue: row.discountValue,
    packVariantMode: row.variantMode as PackRecord['packVariantMode'],
    packSharedOption: row.sharedOption,
    packWeightMode: row.weightMode as PackRecord['packWeightMode'],
    packFixedWeightGrams: row.fixedWeightGrams,
    components: [...components]
      .sort((left, right) => left.position - right.position)
      .map((line) => ({
        productId: String(line.productId),
        variantId: line.variantId === null ? null : String(line.variantId),
        quantity: line.quantity,
      })),
  };
}
