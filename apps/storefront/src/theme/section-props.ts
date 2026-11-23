import type {
  Section,
  StorefrontCollection,
  StorefrontLocale,
  StorefrontProduct,
  StorefrontProductPage,
  StorefrontSort,
  StorefrontStore,
} from '@cod/shared';
import type { ReactNode } from 'react';

/** Where a listing page sits, for the pagination links of a product grid. */
export interface ListingView {
  /** The buyer path of the listing (`/products`, `/category/<slug>`, `/search`). */
  readonly basePath: string;
  readonly page: number;
  readonly pageCount: number;
  readonly sort?: StorefrontSort;
  /** The search query of a search page, kept in its pagination links. */
  readonly q?: string;
}

/** Which step of the order an `in-page-checkout` section shows: the cart summary or the order form shell. */
export type CheckoutStep = 'cart' | 'checkout' | 'product';

/**
 * What a theme page renders from: data only, never the request (ADR 0006). The store comes from a verified tenant;
 * each page adds the catalog data its sections show, loaded with that same tenant.
 */
export interface ThemePageData {
  readonly locale: StorefrontLocale;
  readonly store: StorefrontStore;
  /** The year of the footer notice, from a cached clock: a render never reads the time itself. */
  readonly year: number;
  /** The products of a grid: a listing page, a collection page, search results or the related products. */
  readonly products?: StorefrontProductPage;
  readonly listing?: ListingView;
  readonly collections?: readonly StorefrontCollection[];
  readonly collection?: StorefrontCollection;
  readonly product?: StorefrontProduct;
  readonly checkoutStep?: CheckoutStep;
}

/** The props every section component takes: its own section (id, type, settings) and the page data. */
export interface SectionProps {
  readonly section: Section;
  readonly data: ThemePageData;
}

/** A section component of the registry. */
export type SectionComponent = (props: SectionProps) => ReactNode;
