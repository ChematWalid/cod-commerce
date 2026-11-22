import { describe, expect, it } from 'vitest';
import { COMPACT_THEME } from '../../src/storefront/theme/compact-theme';
import { DEFAULT_THEME } from '../../src/storefront/theme/default-theme';
import { SECTION_TYPES, THEME_PAGES, themeSchema, type Theme } from '../../src/storefront/theme/schema';

/** A deep copy of the default theme, safe to break in one test. */
function copyOfDefault(): Theme {
  return structuredClone(DEFAULT_THEME);
}

describe('theme json v0 schema', () => {
  it('accepts the default theme', () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
  });

  it('accepts the compact theme', () => {
    expect(themeSchema.safeParse(COMPACT_THEME).success).toBe(true);
  });

  it('rejects a section of an unknown type', () => {
    // Arrange
    const theme = copyOfDefault() as unknown as { pages: { home: { type: string }[] } };
    const first = theme.pages.home[0];
    if (first) first.type = 'reviews-carousel';
    // Act
    const result = themeSchema.safeParse(theme);
    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects an unknown page', () => {
    // Arrange
    const theme = { ...copyOfDefault(), pages: { ...DEFAULT_THEME.pages, blog: [] } };
    // Act
    const result = themeSchema.safeParse(theme);
    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects a page that is missing', () => {
    // Arrange
    const pages: Record<string, unknown> = { ...DEFAULT_THEME.pages };
    delete pages['search'];
    // Act
    const result = themeSchema.safeParse({ ...copyOfDefault(), pages });
    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects two sections of one page with the same id', () => {
    // Arrange
    const theme = copyOfDefault();
    const [first, second] = theme.pages.home;
    if (first && second) theme.pages.home[1] = { ...second, id: first.id };
    // Act
    const result = themeSchema.safeParse(theme);
    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects a version other than 0', () => {
    expect(themeSchema.safeParse({ ...copyOfDefault(), version: 1 }).success).toBe(false);
  });

  it('rejects a colour token that is not a #rrggbb hex', () => {
    // Arrange
    const theme = copyOfDefault();
    const broken = { ...theme, tokens: { ...theme.tokens, colorPrimary: 'url(javascript:alert(1))' } };
    // Act
    const result = themeSchema.safeParse(broken);
    // Assert
    expect(result.success).toBe(false);
  });

  it('gives the default home page the builder template order', () => {
    expect(DEFAULT_THEME.pages.home.map((section) => section.type)).toEqual([
      'announcement-bar',
      'header',
      'hero-banner',
      'product-grid',
      'collections',
      'image-with-text',
      'trust-badges',
      'footer',
    ]);
  });

  it('gives the default product page the builder template order', () => {
    expect(DEFAULT_THEME.pages.product.map((section) => section.type)).toEqual([
      'announcement-bar',
      'header',
      'gallery',
      'product-info',
      'in-page-checkout',
      'description',
      'product-grid',
      'footer',
    ]);
  });

  it('makes the compact theme differ from the default in order and tokens', () => {
    // Arrange
    const order = (theme: Theme): string[] =>
      THEME_PAGES.flatMap((page) => theme.pages[page].map((section) => `${page}:${section.type}`));
    // Assert
    expect(order(COMPACT_THEME)).not.toEqual(order(DEFAULT_THEME));
    expect(COMPACT_THEME.tokens).not.toEqual(DEFAULT_THEME.tokens);
  });

  it('uses only declared section types in both themes', () => {
    const types = [DEFAULT_THEME, COMPACT_THEME].flatMap((theme) =>
      THEME_PAGES.flatMap((page) => theme.pages[page].map((section) => section.type)),
    );
    expect(types.every((type) => (SECTION_TYPES as readonly string[]).includes(type))).toBe(true);
  });
});
