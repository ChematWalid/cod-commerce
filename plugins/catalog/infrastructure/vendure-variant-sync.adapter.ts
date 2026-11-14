import { Injectable } from '@nestjs/common';
import { GlobalFlag, type UpdateProductVariantInput } from '@vendure/common/lib/generated-types';
import { ProductVariantService } from '@vendure/core';
import { comparableText } from '../domain/comparable-text';
import type { CoreId } from '../domain/core-id';
import type { OptionGroupRecord, ProductFields, VariantChange, VariantRecord } from '../domain/product';
import type { MatrixPlan, NewVariant } from '../domain/variant-matrix';
import type { OptionTarget } from './vendure-option-sync';
import { clearableId, type VariantCustomFields } from './vendure-product-mapper';

/** The option ids of a combination, one per group in group order. */
function optionIdsOf(groups: readonly OptionGroupRecord[], optionValues: readonly string[]): CoreId[] {
  return groups.flatMap((group, index) => {
    const wanted = comparableText(optionValues[index] ?? '');
    const option = group.values.find((value) => comparableText(value.name) === wanted);
    return option === undefined ? [] : [option.id];
  });
}

/** The variant fields of a change, `null` clearing; an absent field is left out of the input. */
function changeInput(change: VariantChange): UpdateProductVariantInput {
  const customFields: Partial<VariantCustomFields> = {
    ...(change.oldPrice === undefined ? {} : { oldPrice: change.oldPrice }),
    ...(change.isHidden === undefined ? {} : { isHidden: change.isHidden }),
    ...(change.barcode === undefined ? {} : { barcode: change.barcode }),
  };
  return {
    id: change.id,
    ...(change.price === undefined ? {} : { price: change.price }),
    ...(change.sku === undefined ? {} : { sku: change.sku ?? '' }),
    ...(change.featuredAssetId === undefined ? {} : { featuredAssetId: clearableId(change.featuredAssetId) }),
    customFields,
  };
}

/**
 * Applies a matrix plan to a product's Vendure variants (D2124): removed combinations are soft-deleted, kept ones are
 * renamed when the title or a value changed, new ones are created with the product's defaults and no stock tracking
 * (D2107), all in the store's language (D2112).
 */
@Injectable()
export class VendureVariantSync {
  constructor(private readonly variants: ProductVariantService) {}

  async apply(
    target: OptionTarget,
    plan: MatrixPlan,
    groups: readonly OptionGroupRecord[],
    { current, fields }: { readonly current: readonly VariantRecord[]; readonly fields: ProductFields },
  ): Promise<void> {
    if (plan.remove.length > 0) await this.variants.softDelete(target.ctx, [...plan.remove]);
    const renamed = plan.keep.filter((kept) => current.find((variant) => variant.id === kept.id)?.name !== kept.name);
    if (renamed.length > 0) {
      await this.variants.update(
        target.ctx,
        renamed.map((kept) => ({ id: kept.id, translations: [{ languageCode: target.language, name: kept.name }] })),
      );
    }
    if (plan.create.length > 0) {
      await this.variants.create(
        target.ctx,
        plan.create.map((created) => this.newVariantInput(target, created, groups, fields)),
      );
    }
  }

  private newVariantInput(
    target: OptionTarget,
    created: NewVariant,
    groups: readonly OptionGroupRecord[],
    fields: ProductFields,
  ) {
    const isDefault = created.optionValues.length === 0;
    const customFields: VariantCustomFields = {
      oldPrice: fields.oldPrice,
      isHidden: false,
      barcode: isDefault ? fields.barcode : null,
    };
    return {
      productId: target.productId,
      sku: created.sku,
      price: created.price,
      optionIds: optionIdsOf(groups, created.optionValues),
      translations: [{ languageCode: target.language, name: created.name }],
      trackInventory: GlobalFlag.FALSE,
      customFields,
    };
  }

  /** Without options the one variant carries the product's price, SKU, old price and barcode (D2124). */
  async syncDefault(target: OptionTarget, variantId: CoreId, fields: ProductFields): Promise<void> {
    const customFields: Partial<VariantCustomFields> = { oldPrice: fields.oldPrice, barcode: fields.barcode };
    await this.variants.update(target.ctx, [
      { id: variantId, price: fields.price, sku: fields.sku ?? '', customFields },
    ]);
  }

  /** Applies the merchant's edits to existing variants: price, SKU, old price, barcode, hidden, image. */
  async applyChanges(target: OptionTarget, changes: readonly VariantChange[]): Promise<void> {
    if (changes.length === 0) return;
    await this.variants.update(target.ctx, changes.map(changeInput));
  }
}
