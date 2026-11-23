import { STOREFRONT_SORTS, type StorefrontLocale, type StorefrontMessageKey, type StorefrontSort } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import { AssetImage } from '../../images/asset-image';
import type { ListingView, SectionProps } from '../section-props';
import { listingHref } from './listing-nav';

/** The layout box of the collection banner image. */
const BANNER_IMAGE_SIZE = 800;

const SORT_LABELS: Readonly<Record<StorefrontSort, StorefrontMessageKey>> = {
  newest: 'products.sort.newest',
  'price-asc': 'products.sort.priceAsc',
  'price-desc': 'products.sort.priceDesc',
};

function SortLinks({ listing, locale }: { listing: ListingView; locale: StorefrontLocale }): ReactNode {
  if (listing.sort === undefined) return null;
  return (
    <nav className="sort-links" aria-label={t(locale, 'products.sort.label')}>
      {STOREFRONT_SORTS.map((sort) => (
        <Link
          key={sort}
          href={listingHref({ ...listing, sort }, 1)}
          aria-current={sort === listing.sort ? 'page' : undefined}
        >
          {t(locale, SORT_LABELS[sort])}
        </Link>
      ))}
    </nav>
  );
}

/** The title of a listing: the collection's title, description and image, or "All products"; then the sort links. */
export function CollectionHeader({ data }: SectionProps): ReactNode {
  const { collection, listing, locale } = data;
  return (
    <div className="collection-header">
      {collection?.imagePath ? (
        <AssetImage
          path={collection.imagePath}
          alt={collection.title}
          size={BANNER_IMAGE_SIZE}
          sizes="100vw"
          priority
        />
      ) : null}
      <h1>{collection?.title ?? t(locale, 'products.title')}</h1>
      {collection && collection.description !== '' ? <p>{collection.description}</p> : null}
      {listing === undefined ? null : <SortLinks listing={listing} locale={locale} />}
    </div>
  );
}
