import {
  COMPACT_THEME,
  DEFAULT_THEME,
  defineSection,
  type StorefrontStore,
  storefrontStoreSchema,
  type Theme,
  themeSchema,
} from '@cod/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SECTION_REGISTRY } from '../../src/theme/registry';
import { renderPage, type ThemePageData } from '../../src/theme/render-page';
import { themeSource } from '../../src/theme/theme-source';

const STORE: StorefrontStore = storefrontStoreSchema.parse({
  storeId: '1001',
  businessId: '1',
  name: 'Demo Store',
  description: 'Everything for the home',
  logoPath: null,
  language: 'ar',
  direction: 'rtl',
  primaryHost: 'demo.localhost',
  showAddressField: true,
  soldOutBehavior: 'keep',
  status: 'active',
});

const DATA: ThemePageData = { locale: 'ar', store: STORE, year: 2026 };

const SECTION_ATTRIBUTE = /data-section="([a-z-]+)"/g;

/** The section types a rendered page shows, in order. */
function renderedSections(html: string): string[] {
  return [...html.matchAll(SECTION_ATTRIBUTE)].map((match) => match[1] ?? '');
}

function render(theme: Theme, registry = SECTION_REGISTRY): string {
  return renderToStaticMarkup(renderPage('home', theme, DATA, registry));
}

describe('theme renderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the default and the compact home pages in their own section orders', () => {
    // Act
    const defaultOrder = renderedSections(render(DEFAULT_THEME));
    const compactOrder = renderedSections(render(COMPACT_THEME));
    // Assert
    expect(defaultOrder[0]).toBe('announcement-bar');
    expect(compactOrder[0]).toBe('header');
    expect(compactOrder).not.toEqual(defaultOrder);
  });

  it('follows the theme data alone: a reordered theme renders reordered, with no code change', () => {
    // Arrange
    const reversed = themeSchema.parse({
      ...DEFAULT_THEME,
      pages: { ...DEFAULT_THEME.pages, home: [defineSection('footer'), defineSection('header')] },
    });
    // Act
    const order = renderedSections(render(reversed));
    // Assert
    expect(order).toEqual(['footer', 'header']);
  });

  it('skips and logs a section type the registry has no component for, rendering the rest', () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const withoutHeader = Object.fromEntries(Object.entries(SECTION_REGISTRY).filter(([type]) => type !== 'header'));
    const theme = themeSchema.parse({
      ...DEFAULT_THEME,
      pages: { ...DEFAULT_THEME.pages, home: [defineSection('header'), defineSection('footer')] },
    });
    // Act
    const order = renderedSections(render(theme, withoutHeader));
    // Assert
    expect(order).toEqual(['footer']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('storefront.theme.section_skipped'));
  });

  it('never crashes on a section type it does not know at all', () => {
    // Arrange: a theme that did not go through the schema, as a future builder version could send.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unknown = { id: 'carousel', type: 'carousel', settings: {} } as unknown as Theme['pages']['home'][number];
    const theme: Theme = {
      ...DEFAULT_THEME,
      pages: { ...DEFAULT_THEME.pages, home: [unknown, defineSection('footer')] },
    };
    // Act
    const order = renderedSections(render(theme));
    // Assert
    expect(order).toEqual(['footer']);
  });

  it('shows the store name in the header and the copy in the store language', () => {
    // Act
    const html = render(DEFAULT_THEME);
    // Assert
    expect(html).toContain('data-testid="store-name"');
    expect(html).toContain('Demo Store');
    expect(html).toContain('الدفع عند الاستلام');
  });

  it('writes the theme tokens as CSS custom properties of the page', () => {
    const html = render(COMPACT_THEME);
    expect(html).toContain('--color-primary:#7c3aed');
  });
});

describe('theme source', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives every store the default theme when STOREFRONT_THEME is not set', () => {
    vi.stubEnv('STOREFRONT_THEME', '');
    expect(themeSource.themeFor(STORE)).toEqual(DEFAULT_THEME);
  });

  it('gives the compact theme when STOREFRONT_THEME is compact', () => {
    vi.stubEnv('STOREFRONT_THEME', 'compact');
    expect(themeSource.themeFor(STORE)).toEqual(COMPACT_THEME);
  });
});
