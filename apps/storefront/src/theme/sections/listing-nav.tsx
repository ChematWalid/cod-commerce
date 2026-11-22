import type { StorefrontLocale } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { ListingView } from '../section-props';

/** The buyer path of `page` of a listing, keeping its sort and search query. */
export function listingHref(listing: ListingView, page: number): string {
  const query = new URLSearchParams();
  if (listing.q !== undefined) query.set('q', listing.q);
  if (listing.sort !== undefined) query.set('sort', listing.sort);
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return text === '' ? listing.basePath : `${listing.basePath}?${text}`;
}

interface ListingNavProps {
  readonly listing: ListingView;
  readonly locale: StorefrontLocale;
}

/** Previous and next links of a listing with more than one page. */
export function ListingNav({ listing, locale }: ListingNavProps): ReactNode {
  if (listing.pageCount <= 1) return null;
  const { page, pageCount } = listing;
  return (
    <nav className="listing-nav" aria-label={t(locale, 'pagination.page', { page, pages: pageCount })}>
      {page > 1 ? <Link href={listingHref(listing, page - 1)}>{t(locale, 'pagination.previous')}</Link> : null}
      <span>{t(locale, 'pagination.page', { page, pages: pageCount })}</span>
      {page < pageCount ? <Link href={listingHref(listing, page + 1)}>{t(locale, 'pagination.next')}</Link> : null}
    </nav>
  );
}
