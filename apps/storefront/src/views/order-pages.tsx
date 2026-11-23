import { storeTag, themeTag, type ThemePage } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import type { ReactNode } from 'react';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { renderPage } from '../theme/render-page';
import type { CheckoutStep } from '../theme/section-props';
import { themeSource } from '../theme/theme-source';
import { basePageData, type PageBodyProps } from './page-data';
import { requireTenant } from './require-tenant';

/** The order pages: the cart and checkout steps share the theme's checkout layout; success has its own. */
export type OrderPage = 'cart' | 'checkout' | 'success';

const THEME_PAGE_OF: Readonly<Record<OrderPage, ThemePage>> = {
  cart: 'checkout',
  checkout: 'checkout',
  success: 'success',
};

const STEP_OF: Readonly<Record<OrderPage, CheckoutStep | undefined>> = {
  cart: 'cart',
  checkout: 'checkout',
  success: undefined,
};

async function OrderBody({ tenant, themeName, page }: PageBodyProps & { page: OrderPage }): Promise<ReactNode> {
  'use cache';
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const step = STEP_OF[page];
  const data = { ...(await basePageData(tenant)), ...(step !== undefined && { checkoutStep: step }) };
  return renderPage(THEME_PAGE_OF[page], themeSource.themeNamed(themeName), data);
}

/**
 * The cart, checkout and success shells. They hold no buyer data on the server: the cart lives in the browser and
 * the order form arrives with P3.S3, so the shells are cached per store like any page.
 */
export async function OrderContent({ params, page }: { params: Promise<TenantRouteParams>; page: OrderPage }) {
  const tenant = await requireTenant(await params);
  if (tenant === null) return null;
  return <OrderBody tenant={tenant} themeName={themeSource.themeNameFor(tenant.store)} page={page} />;
}
