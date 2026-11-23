import type {
  StorefrontCollection,
  StorefrontCollectionPage,
  StorefrontProduct,
  StorefrontProductCard,
  StorefrontProductPage,
} from '@cod/shared';
import { toAssetPath } from '../images/asset-path';

/** A card whose image is a storage path, or none. */
function cardWithAssetPath(card: StorefrontProductCard): StorefrontProductCard {
  return { ...card, imagePath: toAssetPath(card.imagePath) };
}

/** A page of cards whose images are storage paths. */
export function pageWithAssetPaths(page: StorefrontProductPage): StorefrontProductPage {
  return { ...page, items: page.items.map(cardWithAssetPath) };
}

/** A collection whose image, an absolute URL from the api (D3217 b), is the storage path product images use. */
export function collectionWithAssetPath(collection: StorefrontCollection): StorefrontCollection {
  return { ...collection, imagePath: toAssetPath(collection.imagePath) };
}

/** A collection page with every image a storage path. */
export function collectionPageWithAssetPaths(page: StorefrontCollectionPage): StorefrontCollectionPage {
  return { collection: collectionWithAssetPath(page.collection), products: pageWithAssetPaths(page.products) };
}

/** A product whose gallery and variant images are storage paths; an image with no usable path is dropped. */
export function productWithAssetPaths(product: StorefrontProduct): StorefrontProduct {
  const images = product.images.flatMap((image) => {
    const path = toAssetPath(image.path);
    return path === null ? [] : [{ ...image, path }];
  });
  const variants = product.variants.map((variant) => ({ ...variant, imagePath: toAssetPath(variant.imagePath) }));
  return { ...product, images, variants };
}
