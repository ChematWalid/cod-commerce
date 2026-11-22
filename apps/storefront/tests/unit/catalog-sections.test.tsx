import { DEFAULT_THEME, SECTION_TYPES, type ThemePage } from '@cod/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SECTION_REGISTRY } from '../../src/theme/registry';
import { renderPage, type ThemePageData } from '../../src/theme/render-page';
import { cardFixture, collectionFixture, productFixture, storeFixture } from '../support/storefront-fixtures';

const STORE = storeFixture();
const BASE = 'https://assets.example.dz/assets';

function render(page: ThemePage, extra: Partial<ThemePageData>): string {
  const data: ThemePageData = { locale: 'en', store: STORE, year: 2026, ...extra };
  return renderToStaticMarkup(renderPage(page, DEFAULT_THEME, data));
}

describe('catalog sections', () => {
  beforeEach(() => {
    vi.stubEnv('STOREFRONT_ASSET_BASE', BASE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('has a component for every section type of the shared theme schema', () => {
    expect(SECTION_TYPES.filter((type) => !Object.hasOwn(SECTION_REGISTRY, type))).toEqual([]);
  });

  it('shows the home grid and the collection tiles, images from the asset base', () => {
    // Arrange
    const products = { items: [cardFixture()], totalItems: 1, skip: 0, take: 24 };
    // Act
    const html = render('home', {
      products,
      collections: [collectionFixture({ imagePath: 'b/1/s/1001/preview/kitchen.jpg' })],
    });
    // Assert
    expect(html).toContain('href="/product/kettle"');
    expect(html).toContain('Steel Kettle');
    expect(html).toContain('href="/category/kitchen"');
    // Tests run next/image with its default loader; the source it wraps is the asset URL built on the server.
    expect(html).toContain(encodeURIComponent(`${BASE}/b/1/s/1001/preview/kettle.jpg`));
  });

  it('shows the sold-out badge on a card the store keeps', () => {
    // Arrange
    const products = { items: [cardFixture({ soldOut: true })], totalItems: 1, skip: 0, take: 24 };
    // Act
    const html = render('home', { products });
    // Assert
    expect(html).toContain('Sold out');
  });

  it('renders the product page sections from the product: gallery, picker, checkout shell, description', () => {
    // Act
    const html = render('product', { product: productFixture() });
    // Assert
    expect(html).toContain('Wool Scarf');
    expect(html).toContain('data-section="in-page-checkout"');
    expect(html).toContain('Warm and soft');
    expect(html).toContain('Choose Colour');
  });

  it('leaves the current product out of the related grid', () => {
    // Arrange
    const products = {
      items: [cardFixture({ id: '5002', slug: 'scarf' }), cardFixture()],
      totalItems: 2,
      skip: 0,
      take: 24,
    };
    // Act
    const html = render('product', { product: productFixture(), products });
    // Assert
    expect(html).toContain('href="/product/kettle"');
    expect(html).not.toContain('href="/product/scarf"');
  });

  it.each([
    [true, true],
    [false, false],
  ])('shows the address field in the checkout shell when showAddressField is %s', (showAddressField, shown) => {
    // Arrange
    const store = storeFixture({ showAddressField });
    // Act
    const html = renderToStaticMarkup(
      renderPage('checkout', DEFAULT_THEME, { locale: 'en', store, year: 2026, checkoutStep: 'checkout' }),
    );
    // Assert
    expect(html.includes('data-field="address"')).toBe(shown);
    expect(html).toContain('data-field="phone"');
  });

  it('heads a collection page with its title and links each sort, and paginates the listing', () => {
    // Arrange
    const products = { items: [cardFixture()], totalItems: 60, skip: 24, take: 24 };
    const listing = { basePath: '/category/kitchen', page: 2, pageCount: 3, sort: 'newest' as const };
    // Act
    const html = render('collection', { collection: collectionFixture(), products, listing });
    // Assert
    expect(html).toContain('<h1>Kitchen</h1>');
    expect(html).toContain('href="/category/kitchen?sort=price-asc"');
    expect(html).toContain('href="/category/kitchen?sort=newest&amp;page=3"');
    expect(html).toContain('href="/category/kitchen?sort=newest"');
  });

  it('keeps the search query in the form and says when nothing matches', () => {
    // Arrange
    const products = { items: [], totalItems: 0, skip: 0, take: 24 };
    // Act
    const html = render('search', { products, listing: { basePath: '/search', page: 1, pageCount: 0, q: 'kettle' } });
    // Assert
    expect(html).toContain('value="kettle"');
    expect(html).toContain('No products match “kettle”.');
  });

  it('writes the store language and direction on the page itself', () => {
    const html = renderToStaticMarkup(renderPage('home', DEFAULT_THEME, { locale: 'ar', store: STORE, year: 2026 }));
    expect(html).toMatch(/class="theme-root"[^>]*lang="ar" dir="rtl"/);
  });
});
