import { COMPACT_THEME, DEFAULT_THEME, type StorefrontStore, type Theme, themeSchema } from '@cod/shared';
import { type StorefrontThemeName, storefrontThemeName } from '../config/storefront-env';

/**
 * Where a store's theme comes from. P8 stores one per store; until then one theme serves every store (D3207). The
 * name is read outside any `'use cache'` function and passed into it, so it is part of the cache key: an entry
 * rendered with one theme is never served under another.
 */
export interface ThemeSource {
  /** The name of the theme `store` renders with; reads the environment, so never call it inside a cached function. */
  themeNameFor(store: StorefrontStore): StorefrontThemeName;
  /** The bundled theme of `name`: pure, safe inside a cached function. */
  themeNamed(name: StorefrontThemeName): Theme;
}

/** The bundled themes, validated once when this module loads: a broken bundled theme fails the build. */
const BUNDLED_THEMES: Readonly<Record<StorefrontThemeName, Theme>> = {
  default: themeSchema.parse(DEFAULT_THEME),
  compact: themeSchema.parse(COMPACT_THEME),
};

/** The theme `STOREFRONT_THEME` names (default when unset), the same for every store. */
export const themeSource: ThemeSource = {
  themeNameFor: () => storefrontThemeName(),
  themeNamed: (name) => BUNDLED_THEMES[name],
};
