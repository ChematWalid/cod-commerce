import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantRouteParams, VerifiedTenant } from '../../src/tenancy/verified-tenant';
import { cardFixture, collectionFixture, tenantFixture } from '../support/storefront-fixtures';

const verifyTenant = vi.fn<(route: TenantRouteParams) => Promise<VerifiedTenant | null>>();
const loadProductPage = vi.fn();
const loadCollections = vi.fn();

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('../../src/tenancy/tenant-verifier-instance', () => ({
  verifyTenant,
  isPrerenderSentinel: () => false,
  PRERENDER_SENTINEL_BINDING: 'prerender-sentinel',
}));
vi.mock('../../src/catalog/catalog-loaders', () => ({ loadProductPage, loadCollections }));

const { default: TenantNotFound } = await import('../../app/%5Ft/[locale]/not-found');
const { HomeContent } = await import('../../src/views/home-page');
const { TenantGate } = await import('../../src/views/tenant-gate');

const TENANT = tenantFixture();
/** The path of store 1001 with the binding of another (store, host): what a crafted `/_t/…` request carries. */
const CRAFTED: TenantRouteParams = { locale: 'ar', storeId: TENANT.storeId, binding: 'b'.repeat(22) };
const STORE_DATA = [TENANT.store.name, 'Steel Kettle', 'Kitchen'];

function isNotFound(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;404');
}

/** Resolves the async server components at the top of a tree, as Next does before streaming it. */
async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node) || typeof node.type !== 'function') return node;
  const rendered: unknown = (node.type as (props: unknown) => unknown)(node.props);
  return rendered instanceof Promise ? resolveAsync((await rendered) as ReactNode) : node;
}

/** The HTML Next would stream for `tree`: the tree, or the tenant not-found page when it calls `notFound()`. */
async function renderTenantTree(tree: ReactNode): Promise<string> {
  try {
    return renderToStaticMarkup(await resolveAsync(tree));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return renderToStaticMarkup(<TenantNotFound />);
  }
}

describe('tenant gate and home page with a bad host binding', () => {
  beforeEach(() => {
    verifyTenant.mockReset();
    loadProductPage.mockReset().mockResolvedValue({ items: [cardFixture()], totalItems: 1, skip: 0, take: 24 });
    loadCollections.mockReset().mockResolvedValue([collectionFixture()]);
  });

  it('renders the store and its products for a verified tenant, so the negative cases below are meaningful', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(TENANT);
    // Act
    const html = await renderTenantTree(<HomeContent params={Promise.resolve(CRAFTED)} />);
    // Assert
    for (const text of STORE_DATA) expect(html).toContain(text);
  });

  it('renders the noindex not-found page from the gate layout, with no store name or product', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(null);
    const children = <p>{TENANT.store.name} Steel Kettle</p>;
    // Act
    const html = await renderTenantTree(<TenantGate params={Promise.resolve(CRAFTED)}>{children}</TenantGate>);
    // Assert
    expect(html).toContain('name="robots" content="noindex"');
    for (const text of STORE_DATA) expect(html).not.toContain(text);
  });

  it('renders the not-found page from the home page, with no store data and no catalog read', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(null);
    // Act
    const html = await renderTenantTree(<HomeContent params={Promise.resolve(CRAFTED)} />);
    // Assert
    expect(html).toContain('name="robots" content="noindex"');
    for (const text of STORE_DATA) expect(html).not.toContain(text);
    expect(loadProductPage).not.toHaveBeenCalled();
    expect(loadCollections).not.toHaveBeenCalled();
  });
});
