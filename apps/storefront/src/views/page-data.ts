import { cacheLife } from 'next/cache';
import type { StorefrontProductPage } from '@cod/shared';
import type { StorefrontThemeName } from '../config/storefront-env';
import type { VerifiedTenant } from '../tenancy/verified-tenant';
import type { ThemePageData } from '../theme/section-props';

/**
 * What every cached page body takes: the verified tenant and the theme name, both part of the cache key. The theme
 * name is read before the cached function (D3207): read inside, an entry of one theme could serve another.
 */
export interface PageBodyProps {
  readonly tenant: VerifiedTenant;
  readonly themeName: StorefrontThemeName;
}

/** The year of the footer notice, from a cached clock: a render never reads the time itself (Cache Components). */
export async function cachedYear(): Promise<number> {
  'use cache';
  cacheLife('hours');
  return await Promise.resolve(new Date().getUTCFullYear());
}

/** The data every theme page starts from: the store, its language, the footer year. */
export async function basePageData(tenant: VerifiedTenant): Promise<ThemePageData> {
  return { locale: tenant.locale, store: tenant.store, year: await cachedYear() };
}

/** How many pages a listing has. */
export function pageCountOf(page: StorefrontProductPage): number {
  return Math.ceil(page.totalItems / page.take);
}
