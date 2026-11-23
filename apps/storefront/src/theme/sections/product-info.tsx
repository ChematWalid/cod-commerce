import { formatDzd, type StorefrontLocale, type StorefrontProduct } from '@cod/shared';
import type { ReactNode } from 'react';
import { type PickerImage, VariantPicker, type VariantPickerLabels } from '../../client/variant-picker';
import type { OptionGroupChoice, VariantChoice } from '../../client/variant-selection';
import { t } from '../../i18n/messages';
import { assetSource } from '../../images/asset-source';
import type { SectionProps } from '../section-props';

/** The variants as the picker shows them: prices formatted and image sources built here, on the server. */
export function variantChoicesOf(product: StorefrontProduct, locale: StorefrontLocale): VariantChoice[] {
  return product.variants.map((variant) => ({
    id: variant.id,
    optionCodes: variant.optionCodes,
    price: formatDzd(locale, variant.price),
    oldPrice: variant.oldPrice === null ? null : formatDzd(locale, variant.oldPrice),
    imageSrc: variant.imagePath === null ? null : assetSource(variant.imagePath),
    soldOut: variant.soldOut,
  }));
}

/** The option groups with their "Choose …" labels in the store's language. */
export function optionGroupChoicesOf(product: StorefrontProduct, locale: StorefrontLocale): OptionGroupChoice[] {
  return product.optionGroups.map((group) => ({
    code: group.code,
    label: t(locale, 'product.selectOption', { option: group.name }),
    options: group.options,
  }));
}

function pickerLabelsOf(locale: StorefrontLocale): VariantPickerLabels {
  return {
    soldOut: t(locale, 'product.soldOut'),
    addToCart: t(locale, 'product.addToCart'),
    quantity: t(locale, 'product.quantity'),
    increase: t(locale, 'product.increase'),
    decrease: t(locale, 'product.decrease'),
  };
}

function productImageOf(product: StorefrontProduct): PickerImage | null {
  const first = product.images[0];
  return first === undefined ? null : { src: assetSource(first.path), alt: first.alt };
}

/** The product's name and the variant picker (options, price, image, quantity, add to cart). */
export function ProductInfo({ data }: SectionProps): ReactNode {
  const { product, locale } = data;
  if (product === undefined) return null;
  return (
    <div className="product-info">
      <h1>{product.name}</h1>
      <VariantPicker
        groups={optionGroupChoicesOf(product, locale)}
        variants={variantChoicesOf(product, locale)}
        labels={pickerLabelsOf(locale)}
        productImage={productImageOf(product)}
      />
    </div>
  );
}
