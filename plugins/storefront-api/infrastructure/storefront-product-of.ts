import type { VisibleImage, VisibleProduct, VisibleVariant } from '@cod/plugin-catalog';
import type { StorefrontProduct } from '@cod/shared';

type StorefrontImage = StorefrontProduct['images'][number];
type StorefrontVariant = StorefrontProduct['variants'][number];
type StorefrontOptionGroup = StorefrontProduct['optionGroups'][number];

/** The featured image first, then the gallery, each once. */
function imagesOf(product: VisibleProduct): StorefrontImage[] {
  const all: VisibleImage[] = [...(product.featuredAsset === null ? [] : [product.featuredAsset]), ...product.assets];
  const seen = new Set<string>();
  return all.flatMap((image) => {
    if (seen.has(image.id)) return [];
    seen.add(image.id);
    return [{ path: image.preview, alt: product.title }];
  });
}

/** Option groups and values by id: a variant names its values by name, in group order (#246). */
const optionGroupsOf = (product: VisibleProduct): StorefrontOptionGroup[] =>
  product.optionGroups.map((group) => ({
    code: group.id,
    name: group.name,
    options: group.values.map((value) => ({ code: value.id, name: value.name })),
  }));

/** The value ids of a variant: its value at place `i` belongs to group `i`. */
function optionCodesOf(product: VisibleProduct, variant: VisibleVariant): string[] {
  return variant.optionValues.flatMap((name, place) => {
    const value = product.optionGroups[place]?.values.find((candidate) => candidate.name === name);
    return value === undefined ? [] : [value.id];
  });
}

const variantOf = (product: VisibleProduct, variant: VisibleVariant): StorefrontVariant => ({
  id: variant.id,
  sku: variant.sku,
  price: variant.price,
  oldPrice: variant.oldPrice,
  optionCodes: optionCodesOf(product, variant),
  imagePath: variant.featuredAssetPreview,
  soldOut: product.soldOut,
});

/**
 * The catalog's public product view as the storefront's product page reads it (Task 4 contract), field by field so a
 * merchant-only field never leaves. Images are storage paths; the storefront's image loader builds URLs (D3209).
 */
export const storefrontProductOf = (product: VisibleProduct): StorefrontProduct => ({
  id: product.id,
  slug: product.slug,
  name: product.title,
  description: product.description ?? '',
  images: imagesOf(product),
  optionGroups: optionGroupsOf(product),
  variants: product.variants.map((variant) => variantOf(product, variant)),
  metaTitle: product.metaTitle ?? '',
  metaDescription: product.metaDescription ?? '',
});
