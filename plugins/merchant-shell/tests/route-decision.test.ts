import { describe, expect, it } from 'vitest';
import { decideMerchantRoute, MERCHANT_ALLOWED_STOCK_ROUTES } from '../dashboard/model/route-decision';

const EXTENSION_PATHS = ['/home', '/team/roles', '/stores/$storeId/products'];

const decide = (routeId: string, allowed: readonly string[] = MERCHANT_ALLOWED_STOCK_ROUTES) =>
  decideMerchantRoute(routeId, EXTENSION_PATHS, allowed);

describe('decideMerchantRoute', () => {
  it('sends the dashboard root to the home page', () => {
    expect(decide('/_authenticated/')).toEqual({ redirect: '/home' });
  });

  it('sends the stock profile page to the account profile', () => {
    expect(decide('/_authenticated/_profile/profile')).toEqual({ redirect: '/account/profile' });
  });

  it('shows not found for a stock page', () => {
    expect(decide('/_authenticated/_orders/orders')).toBe('not-found');
  });

  it('shows not found for an unknown URL, whose last match is the layout itself', () => {
    expect(decide('/_authenticated')).toBe('not-found');
  });

  it('renders an extension route', () => {
    expect(decide('/_authenticated/team/roles')).toBe('render');
    expect(decide('/_authenticated/home')).toBe('render');
    expect(decide('/_authenticated/stores/$storeId/products')).toBe('render');
  });

  it('renders a stock route that the allow-list names', () => {
    expect(decide('/_authenticated/_orders/orders', ['/_authenticated/_orders/orders'])).toBe('render');
  });

  it('allows no stock route today', () => {
    expect(MERCHANT_ALLOWED_STOCK_ROUTES).toEqual([]);
  });

  it('does not render a stock route whose path merely starts like an extension path', () => {
    expect(decide('/_authenticated/team/roles/extra')).toBe('not-found');
  });
});
