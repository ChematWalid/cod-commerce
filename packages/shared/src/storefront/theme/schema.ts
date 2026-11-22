import { z } from 'zod';

/** The only theme JSON version P3 reads (D3207); the builder (P8) bumps it with a migration. */
export const THEME_VERSION = 0;

/**
 * Every section a theme page can hold. A new section is one entry here plus one component in the storefront registry
 * (§3a.7); reviews and FAQ sections come with P8.
 */
export const SECTION_TYPES = [
  'announcement-bar',
  'header',
  'hero-banner',
  'product-grid',
  'collections',
  'image-with-text',
  'trust-badges',
  'gallery',
  'product-info',
  'in-page-checkout',
  'description',
  'collection-header',
  'success-message',
  'footer',
] as const;

/** One of the {@link SECTION_TYPES}. */
export type SectionType = (typeof SECTION_TYPES)[number];

/** The storefront pages a theme lays out. */
export const THEME_PAGES = ['home', 'product', 'collection', 'checkout', 'success', 'search'] as const;

/** One of the {@link THEME_PAGES}. */
export type ThemePage = (typeof THEME_PAGES)[number];

/** Corner radius steps of a theme. */
export const THEME_RADII = ['none', 'sm', 'lg'] as const;

/** Font families a theme can pick; `plex-arabic` is the bundled IBM Plex Sans Arabic. */
export const THEME_FONTS = ['plex-arabic', 'system'] as const;

/** Longest section id; ids are short kebab-case names. */
const SECTION_ID_MAX = 64;

/** Colours are plain `#rrggbb` so a token can never inject CSS. */
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const sectionSchema = z.strictObject({
  id: z.string().regex(new RegExp(`^[a-z0-9][a-z0-9-]{0,${String(SECTION_ID_MAX - 1)}}$`)),
  type: z.enum(SECTION_TYPES),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

/** One section of a theme page: its id (unique in the page), its type and its flat settings. */
export type Section = z.output<typeof sectionSchema>;

function hasUniqueIds(sections: readonly Section[]): boolean {
  return new Set(sections.map((section) => section.id)).size === sections.length;
}

const pageSectionsSchema = z.array(sectionSchema).refine(hasUniqueIds, { message: 'duplicate section id' });

/** Design tokens the renderer turns into CSS custom properties. */
const themeTokensSchema = z.strictObject({
  colorPrimary: hexColorSchema,
  colorText: hexColorSchema,
  colorBackground: hexColorSchema,
  radius: z.enum(THEME_RADII),
  font: z.enum(THEME_FONTS),
});

/**
 * Theme JSON v0 (P3.S2, D3207): tokens plus, for each page, the ordered sections to render. Unknown keys, pages and
 * section types are refused, so a theme is data the renderer fully understands.
 */
export const themeSchema = z.strictObject({
  version: z.literal(THEME_VERSION),
  tokens: themeTokensSchema,
  pages: z.strictObject({
    home: pageSectionsSchema,
    product: pageSectionsSchema,
    collection: pageSectionsSchema,
    checkout: pageSectionsSchema,
    success: pageSectionsSchema,
    search: pageSectionsSchema,
  }),
});

/** A theme; see {@link themeSchema}. */
export type Theme = z.output<typeof themeSchema>;

/** The tokens of a theme. */
export type ThemeTokens = Theme['tokens'];

/** A section of `type` whose id is its type, which is unique while a page holds each type once. */
export function defineSection(type: SectionType, settings: Section['settings'] = {}): Section {
  return { id: type, type, settings };
}
