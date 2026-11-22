import { COMPACT_THEME, DEFAULT_THEME, type StorefrontStore, type Theme, themeSchema } from '@cod/shared';
import { type StorefrontThemeName, storefrontThemeName } from '../config/storefront-env';

/** Where a store's theme comes from. P8 stores one per store; until then one theme serves every store (D3207). */
export interface ThemeSource {
  themeFor(store: StorefrontStore): Theme;
}

/** The bundled themes, validated once when this module loads: a broken bundled theme fails the build. */
const BUNDLED_THEMES: Readonly<Record<StorefrontThemeName, Theme>> = {
  default: themeSchema.parse(DEFAULT_THEME),
  compact: themeSchema.parse(COMPACT_THEME),
};

/** The theme `STOREFRONT_THEME` names (default when unset), the same for every store. */
export const themeSource: ThemeSource = {
  themeFor: () => BUNDLED_THEMES[storefrontThemeName()],
};
