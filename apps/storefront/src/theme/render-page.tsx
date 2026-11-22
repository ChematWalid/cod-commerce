import type { Section, ThemePage, Theme, ThemeTokens } from '@cod/shared';
import type { CSSProperties, ReactNode } from 'react';
import { SECTION_REGISTRY, type SectionRegistry } from './registry';
import type { ThemePageData } from './section-props';

export type { ThemePageData } from './section-props';

/** Corner radius of each theme radius step. */
const RADIUS_VALUES: Readonly<Record<ThemeTokens['radius'], string>> = { none: '0', sm: '0.375rem', lg: '1rem' };

/** Font stack of each theme font; `plex-arabic` is bundled with the storefront. */
const FONT_STACKS: Readonly<Record<ThemeTokens['font'], string>> = {
  'plex-arabic': "'IBM Plex Sans Arabic', ui-sans-serif, system-ui, sans-serif",
  system: 'ui-sans-serif, system-ui, sans-serif',
};

/** An inline style made of CSS custom properties. */
type CustomPropertyStyle = CSSProperties & Readonly<Record<`--${string}`, string>>;

/** The theme tokens as CSS custom properties; colours are `#rrggbb` by schema, so nothing else reaches the CSS. */
function tokenStyle(tokens: ThemeTokens): CustomPropertyStyle {
  return {
    '--color-primary': tokens.colorPrimary,
    '--color-text': tokens.colorText,
    '--color-background': tokens.colorBackground,
    '--radius': RADIUS_VALUES[tokens.radius],
    '--font-family': FONT_STACKS[tokens.font],
  };
}

function logSkippedSection(page: ThemePage, section: Section): void {
  console.warn(
    JSON.stringify({ level: 'warn', event: 'storefront.theme.section_skipped', page, sectionType: section.type }),
  );
}

function renderSection(page: ThemePage, section: Section, data: ThemePageData, registry: SectionRegistry): ReactNode {
  const Component = Object.hasOwn(registry, section.type) ? registry[section.type] : undefined;
  if (Component === undefined) {
    logSkippedSection(page, section);
    return null;
  }
  return (
    <div key={section.id} data-section={section.type} className={`section section-${section.type}`}>
      <Component section={section} data={data} />
    </div>
  );
}

/**
 * Renders a theme page: each section of `theme.pages[page]`, in the theme's order, through its registry component.
 * The order and the settings come from the theme data alone, so a theme swap needs no code change (D3207). A section
 * type without a component is skipped and logged, never a crash.
 */
export function renderPage(
  page: ThemePage,
  theme: Theme,
  data: ThemePageData,
  registry: SectionRegistry = SECTION_REGISTRY,
): ReactNode {
  return (
    <div className="theme-root" data-page={page} style={tokenStyle(theme.tokens)}>
      {theme.pages[page].map((section) => renderSection(page, section, data, registry))}
    </div>
  );
}
