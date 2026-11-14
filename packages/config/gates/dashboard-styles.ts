import type { SourceFile } from './branding';
import { findPhysicalInlineStyles } from './inline-styles';
import { findNamedCssColours } from './named-colours';

/** Dashboard sources of a plugin: `plugins/<name>/dashboard/**` TypeScript, TSX and CSS (ADR 0005, ADR 0010). */
const DASHBOARD_SOURCE = /^plugins\/[^/]+\/dashboard\/.+\.(?:ts|tsx|css)$/;

/** A variant prefix: a plain one (`md:`, `group-data-open:`) or one holding an arbitrary `[…]` part (`has-[.open]:`). */
const VARIANTS = String.raw`((?:(?:[\w&>*=-]|\[[^\]\s]*\])+:)*)`;
/** An optional negative sign and the utility itself. */
const UTILITY = String.raw`(-?[a-z][\w-]*)`;

/**
 * A utility class token. In TypeScript a `.` before it marks a member or file name (`styles.left-0`, `x.css`); in CSS
 * it marks a class selector (`.ml-2 {`), which is a use.
 */
const CLASS_TOKEN = new RegExp(String.raw`(?<![\w:./-])${VARIANTS}${UTILITY}`, 'g');
const CSS_CLASS_TOKEN = new RegExp(String.raw`(?<![\w:/-])${VARIANTS}${UTILITY}`, 'g');

/**
 * Utilities that name a physical side. Their logical twins (`ms-`, `me-`, `ps-`, `pe-`, `scroll-ms-`, `start-`,
 * `end-`, `text-start`, `float-start`, `rounded-s`, `rounded-ss`, `border-s`) are the rule.
 * `space-x-*` and `divide-x-*` are logical in Tailwind 4.3.5 (margin-inline / border-inline), D2119.
 */
const PHYSICAL_UTILITY =
  /^-?(?:ml-|mr-|pl-|pr-|scroll-[mp][lr]-|left-(?!to-right)|right-(?!to-left)|text-left$|text-right$|(?:float|clear)-(?:left|right)$|rounded-(?:[lr]|[tb][lr])(?:-|$)|border-[lr](?:-|$))/;

/**
 * A CSS declaration that names a physical side: a property with a `left` or `right` part (`margin-left`, `left`,
 * `border-top-left-radius`), or `text-align`, `float` or `clear` set to one. Only declarations count: they follow `{`
 * or `;`, so a selector such as `svg.lucide-chevron-left:not(…)` does not.
 */
const PHYSICAL_PROPERTY =
  /(?:^|[{;])\s*((?:[a-z-]*-)?(?:left|right)(?:-[a-z-]+)?\s*:[^;}]*|(?:text-align|float|clear)\s*:\s*(?:left|right)\b[^;}]*)/g;

/**
 * Physical declarations allowed on purpose, by file and exact text. Each undoes a physical side a stock class sets,
 * under `html[dir='rtl']`, before a logical property places the element: only a physical declaration resets a
 * physical one.
 */
const ALLOWED_PHYSICAL_PROPERTIES: readonly { readonly path: string; readonly declaration: string }[] = [
  // The stock active-row marker's `left` class, before `inset-inline-start: 0`.
  { path: 'plugins/merchant-shell/dashboard/styles/rtl.css', declaration: 'left: auto' },
  // The stock dialog close button's `right` class, before `inset-inline-end: 1rem`.
  { path: 'plugins/merchant-shell/dashboard/styles/rtl.css', declaration: 'right: auto' },
  // The stock accordion icon's auto `margin-left`, before `margin-inline-start: auto`.
  { path: 'plugins/rbac/dashboard/styles/rbac.css', declaration: 'margin-left: 0' },
  // The stock dialog close button's `right`, before `inset-inline-end`.
  { path: 'plugins/rbac/dashboard/styles/rbac.css', declaration: 'right: auto' },
  // The stock dialog close button's `right`, before `inset-inline-end`.
  { path: 'plugins/platform-flags/dashboard/styles/flags.css', declaration: 'right: auto' },
];

/** Tailwind's default palette: a class such as `bg-red-500` paints a fixed colour. */
const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe';
/** Utilities that take a colour. */
const COLOUR_TAKER =
  'bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|fill|stroke|from|via|to|outline|decoration|shadow|inset-shadow|inset-ring|accent|caret|divide|placeholder';

/** Utilities that paint a fixed colour instead of a theme token: `bg-white`, `text-black`, `bg-red-500`. */
const COLOUR_UTILITY = new RegExp(
  String.raw`^(?:(?:bg|text)-(?:white|black)|(?:${COLOUR_TAKER})-(?:${PALETTE})-\d{2,3})(?![\w-])`,
);

/**
 * Colour functions and hex literals. A hex literal has 3, 4, 6 or 8 digits and stands alone; an in-page link
 * (`href="#add"`) is not one. `color-mix()` is flagged too: mixing belongs in the theme, not in a plugin.
 */
const COLOUR_LITERAL =
  /(?<![\w&])(?<!href=["'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|(?<![\w$.-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix|color)\(/g;

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** An `rtl:` or `ltr:` variant is a deliberate direction-specific rule, not a physical use. */
const isDirectionVariant = (variants: string): boolean => /(?:^|:)(?:rtl|ltr):/.test(variants);

const isCss = (path: string): boolean => path.endsWith('.css');

function classTokens(path: string, content: string): { variants: string; utility: string }[] {
  const pattern = isCss(path) ? CSS_CLASS_TOKEN : CLASS_TOKEN;
  return [...content.matchAll(pattern)].map(([, variants = '', utility = '']) => ({ variants, utility }));
}

function physicalUses(path: string, content: string): string[] {
  return classTokens(path, content)
    .filter(({ variants, utility }) => PHYSICAL_UTILITY.test(utility) && !isDirectionVariant(variants))
    .map(({ variants, utility }) => `${variants}${utility}`);
}

function physicalProperties(path: string, content: string): string[] {
  if (!isCss(path)) return findPhysicalInlineStyles(content);
  const allowed = new Set(ALLOWED_PHYSICAL_PROPERTIES.filter((entry) => entry.path === path).map((e) => e.declaration));
  return [...content.replace(CSS_COMMENT, '').matchAll(PHYSICAL_PROPERTY)]
    .map(([, declaration = '']) => declaration.trim().replace(/\s*:\s*/, ': '))
    .filter((declaration) => !allowed.has(declaration));
}

function colourUses(path: string, content: string): string[] {
  const utilities = classTokens(path, content)
    .filter(({ utility }) => COLOUR_UTILITY.test(utility))
    .map(({ variants, utility }) => `${variants}${utility}`);
  const named = isCss(path) ? findNamedCssColours(content.replace(CSS_COMMENT, '')) : [];
  return [...utilities, ...[...content.matchAll(COLOUR_LITERAL)].map(([literal]) => literal), ...named];
}

/**
 * Checks the dashboard style rules: layout uses logical utilities (`ms-2`, `text-start`) and, in CSS, logical
 * properties (`margin-inline-start`) and inline style keys (`marginInlineStart`) so it mirrors under `dir="rtl"`,
 * and colour comes from the theme tokens (`bg-background`, `var(--…)`), never a palette class, a colour function or a
 * named CSS colour, so dark mode follows. Icons are unaffected.
 *
 * @param files the repo-relative files to scan; those outside `plugins/*\/dashboard` are ignored
 * @returns one message per offending use; empty when the sources are clean
 */
export function findDashboardStyleViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path }) => DASHBOARD_SOURCE.test(path))
    .flatMap(({ path, content }) => [
      ...physicalUses(path, content).map((use) => `${path} uses the physical utility "${use}" (use the logical one)`),
      ...physicalProperties(path, content).map(
        (declaration) => `${path} uses the physical property "${declaration}" (use the logical one)`,
      ),
      ...colourUses(path, content).map((use) => `${path} uses the colour literal "${use}" (use a theme token)`),
    ]);
}
