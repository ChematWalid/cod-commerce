import type { StorefrontProductCard, StorefrontProductPage } from '@cod/shared';
import type { ListingQuery } from '../domain/listing-query';
import type { ProjectionPage } from '../domain/ports/projection-repository.port';
import type { ProjectionRow } from '../domain/projection-row';

/** A projection row as a buyer's card shows it, field by field so an internal column never leaves. */
export const productCardOf = (row: ProjectionRow): StorefrontProductCard => ({
  id: row.productId,
  slug: row.slug,
  name: row.name,
  price: row.price,
  oldPrice: row.oldPrice,
  imagePath: row.imagePath,
  soldOut: row.soldOut,
});

/** A page of projection rows as the storefront reads it. */
export const productPageOf = (page: ProjectionPage, query: ListingQuery): StorefrontProductPage => ({
  items: page.items.map(productCardOf),
  totalItems: page.totalItems,
  skip: query.skip,
  take: query.take,
});

/** A page with no product: a search too short to run, a collection with no member. */
export const emptyProductPage = (query: ListingQuery): StorefrontProductPage => ({
  items: [],
  totalItems: 0,
  skip: query.skip,
  take: query.take,
});
