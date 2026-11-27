import { STOREFRONT_PAGE_PATHS, STOREFRONT_SEARCH_MIN_QUERY, type StorefrontProductCard } from '@cod/shared';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps, ThemePageData } from '../section-props';
import { ListingNav } from './listing-nav';
import { ProductCard } from './product-card';

/** Columns of a grid when the theme does not say. */
const DEFAULT_COLUMNS = 4;
const MAX_COLUMNS = 6;

function numberSetting(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? Math.min(value, max) : fallback;
}

/** The cards a grid shows: a related grid leaves the current product out; `limit` caps a grid on home or product. */
function cardsOf(section: SectionProps['section'], data: ThemePageData): readonly StorefrontProductCard[] {
  const items = data.products?.items ?? [];
  const related = section.settings['related'] === true;
  const shown = related ? items.filter((card) => card.id !== data.product?.id) : items;
  const limit = section.settings['limit'];
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? shown.slice(0, limit) : shown;
}

function SearchForm({ data }: { data: ThemePageData }): ReactNode {
  if (data.listing?.q === undefined) return null;
  return (
    <form role="search" action={STOREFRONT_PAGE_PATHS.search} className="search-form">
      <input type="search" name="q" defaultValue={data.listing.q} aria-label={t(data.locale, 'search.placeholder')} />
      <button type="submit" className="button">
        {t(data.locale, 'search.submit')}
      </button>
    </form>
  );
}

function EmptyGrid({ data }: { data: ThemePageData }): ReactNode {
  if (data.listing === undefined) return null;
  const q = data.listing.q;
  if (q === '') return null;
  if (q !== undefined && q.length < STOREFRONT_SEARCH_MIN_QUERY) {
    return <p className="grid-empty">{t(data.locale, 'search.tooShort', { min: STOREFRONT_SEARCH_MIN_QUERY })}</p>;
  }
  if (q !== undefined) return <p className="grid-empty">{t(data.locale, 'search.empty', { query: q })}</p>;
  return <p className="grid-empty">{t(data.locale, data.collection ? 'collection.empty' : 'products.empty')}</p>;
}

/**
 * A grid of product cards (`columns`, `limit`, `related`): the home page's newest products, a listing, a collection,
 * search results or a product page's related products. Pagination shows on listing pages only.
 */
export function ProductGrid({ section, data }: SectionProps): ReactNode {
  const cards = cardsOf(section, data);
  const columns = numberSetting(section.settings['columns'], DEFAULT_COLUMNS, MAX_COLUMNS);
  const related = section.settings['related'] === true;
  if (cards.length === 0 && data.listing === undefined) return null;
  return (
    <div className="product-grid" data-columns={columns}>
      {related ? <h2>{t(data.locale, 'product.related')}</h2> : null}
      <SearchForm data={data} />
      {cards.length === 0 ? <EmptyGrid data={data} /> : null}
      <ul className="product-cards">
        {cards.map((card) => (
          <ProductCard key={card.id} card={card} locale={data.locale} />
        ))}
      </ul>
      {data.listing === undefined ? null : <ListingNav listing={data.listing} locale={data.locale} />}
    </div>
  );
}
