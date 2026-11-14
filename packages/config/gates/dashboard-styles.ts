import type { SourceFile } from './branding';
import { type InlineStyleFindings, inspectInlineStyles } from './inline-styles';
import { findNamedColourWords, findNamedCssColours, isColourProperty, isNamedColour } from './named-colours';
import { isPhysicalDeclaration } from './physical-declarations';

/** Dashboard sources of a plugin: `plugins/<name>/dashboard/**` TypeScript, TSX and CSS (ADR 0005, ADR 0010). */
const DASHBOARD_SOURCE = /^plugins\/[^/]+\/dashboard\/.+\.(?:ts|tsx|css)$/;

/**
 * The inside of an arbitrary `[…]` part. It never holds `[`, a quote or a space and stays short, so a long unbroken
 * line (`[a[a[a…`) cannot make the scan backtrack quadratically.
 */
const BRACKET_BODY = String.raw`[^\]\s\["'\x60]{0,200}`;
const BRACKET_PART = String.raw`\[${BRACKET_BODY}\]`;

/** A variant prefix: a plain one (`md:`, `group-data-open:`) or one holding an arbitrary `[…]` part (`has-[.open]:`). */
const VARIANTS = String.raw`((?:(?:[\w&>*=-]|${BRACKET_PART})+:)*)`;
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
 * `space-x-*` and `divide-x-*` are logical in Tailwind 4.3.5 (margin-inline / border-inline), D2119. Also physical in
 * 4.3.5: a gradient towards a side (`bg-linear-to-r`, `bg-gradient-to-tl`), a position naming a side (`origin-left`,
 * `object-left-top`, `bg-right`, `mask-left`) and a side mask (`mask-l-from-50%`).
 */
const PHYSICAL_UTILITY =
  /^-?(?:ml-|mr-|pl-|pr-|scroll-[mp][lr]-|left-(?!to-right)|right-(?!to-left)|text-left$|text-right$|(?:float|clear)-(?:left|right)$|rounded-(?:[lr]|[tb][lr])(?:-|$)|border-[lr](?:-|$)|bg-(?:linear|gradient)-to-[tb]?[lr]$|(?:origin|object|bg|mask)-(?:(?:top|bottom)-)?(?:left|right)(?:-(?:top|bottom))?$|mask-[lr]-(?:from|to)-)/;

/** A Tailwind arbitrary property (`[margin-left:4px]`, `md:[color:red]`); `_` stands for a space in its value. */
const ARBITRARY_PROPERTY = new RegExp(
  String.raw`(?<![\w:./-])${VARIANTS}\[([a-zA-Z-]{1,60}):([^\]\s\["'\x60]{1,200})\]`,
  'g',
);

/**
 * A CSS declaration: its property and its value. It starts after `{`, `;` or `}` and ends at `;` or `}`, so a
 * selector such as `svg.lucide-chevron-left:hover {` is no declaration. Properties match in any case.
 */
const CSS_DECLARATION = /(?:^|[{;}])\s*(-?[a-zA-Z][a-zA-Z-]*)\s*:([^;{}]*)(?=[;}]|$)/g;

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
/** Utilities that take a colour; the longer names come first so `text-shadow-red-500` reads as one utility. */
const COLOUR_TAKER =
  'text-shadow|drop-shadow|bg|text|border(?:-(?:[xytrblse]|bs|be))?|ring(?:-offset)?|fill|stroke|from|via|to|outline|decoration|shadow|inset-shadow|inset-ring|accent|caret|divide|placeholder|mask-(?:[xytrbl]|linear|radial|conic)-(?:from|to)';

/** Utilities that paint a fixed colour instead of a theme token: `bg-white`, `border-black`, `bg-red-500`. */
const COLOUR_UTILITY = new RegExp(String.raw`^(?:${COLOUR_TAKER})-(?:white|black|(?:${PALETTE})-\d{2,3})(?![\w-])`);

/** A colour utility with an arbitrary word value: `bg-[red]`, `text-[color:navy]`. The word is checked by name. */
const ARBITRARY_COLOUR_WORD = new RegExp(String.raw`(?<![\w-])(?:${COLOUR_TAKER})-\[(?:color:)?([a-zA-Z]+)\]`, 'g');

/**
 * Colour functions and hex literals. A hex literal has 3, 4, 6 or 8 digits and stands alone; an in-page link
 * (`href="#add"`) is not one. `color-mix()` is flagged too: mixing belongs in the theme, not in a plugin. `color()`
 * counts only with a colour space (`color(display-p3 …)`), so a call to a function named `color` is no literal.
 * CSS function names match in any case (`RGB(`, `OKLCH(`).
 */
const COLOUR_LITERAL =
  /(?<![\w&])(?<!href=["'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|(?<![\w$.-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(|(?<![\w$.-])color\((?=\s*(?:from|srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)\b)/gi;

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** An `rtl:` or `ltr:` variant is a deliberate direction-specific rule, not a physical use. */
const isDirectionVariant = (variants: string): boolean => /(?:^|:)(?:rtl|ltr):/.test(variants);

const isCss = (path: string): boolean => path.endsWith('.css');

function classTokens(path: string, content: string): { variants: string; utility: string }[] {
  const pattern = isCss(path) ? CSS_CLASS_TOKEN : CLASS_TOKEN;
  return [...content.matchAll(pattern)].map(([, variants = '', utility = '']) => ({ variants, utility }));
}

interface ArbitraryProperty {
  readonly token: string;
  readonly variants: string;
  readonly property: string;
  readonly value: string;
}

function arbitraryProperties(content: string): ArbitraryProperty[] {
  return [...content.matchAll(ARBITRARY_PROPERTY)].map(([token, variants = '', property = '', value = '']) => ({
    token,
    variants,
    property,
    value: value.replaceAll('_', ' '),
  }));
}

function physicalUses(path: string, content: string): string[] {
  const utilities = classTokens(path, content)
    .filter(({ variants, utility }) => PHYSICAL_UTILITY.test(utility) && !isDirectionVariant(variants))
    .map(({ variants, utility }) => `${variants}${utility}`);
  const arbitrary = arbitraryProperties(content)
    .filter(({ variants, property, value }) => !isDirectionVariant(variants) && isPhysicalDeclaration(property, value))
    .map(({ token }) => token);
  return [...utilities, ...arbitrary];
}

function physicalCssDeclarations(path: string, content: string): string[] {
  const allowed = new Set(ALLOWED_PHYSICAL_PROPERTIES.filter((entry) => entry.path === path).map((e) => e.declaration));
  return [...content.replace(CSS_COMMENT, '').matchAll(CSS_DECLARATION)]
    .filter(([, property = '', value = '']) => isPhysicalDeclaration(property, value))
    .map(([, property = '', value = '']) => `${property}: ${value.trim()}`)
    .filter((declaration) => !allowed.has(declaration.toLowerCase()));
}

function physicalProperties(path: string, content: string, inline: InlineStyleFindings | undefined): string[] {
  return inline === undefined ? physicalCssDeclarations(path, content) : [...inline.physical];
}

function colourUses(path: string, content: string, inline: InlineStyleFindings | undefined): string[] {
  const utilities = classTokens(path, content)
    .filter(({ utility }) => COLOUR_UTILITY.test(utility))
    .map(({ variants, utility }) => `${variants}${utility}`);
  const arbitrary = [...content.matchAll(ARBITRARY_COLOUR_WORD)]
    .filter(([, word = '']) => isNamedColour(word))
    .map(([token]) => token);
  const named = inline === undefined ? findNamedCssColours(content.replace(CSS_COMMENT, '')) : inline.namedColours;
  const literals = [...content.matchAll(COLOUR_LITERAL)].map(([literal]) => literal);
  const arbitraryProperty = arbitraryProperties(content)
    .filter(({ property, value }) => isColourProperty(property) && findNamedColourWords(value).length > 0)
    .map(({ token }) => token);
  return [...utilities, ...arbitrary, ...arbitraryProperty, ...literals, ...named];
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
    .flatMap(({ path, content }) => violationsOfFile(path, content));
}

function violationsOfFile(path: string, content: string): string[] {
  // One TypeScript parse per file feeds both the physical and the colour check.
  const inline = isCss(path) ? undefined : inspectInlineStyles(content, path);
  return [
    ...physicalUses(path, content).map((use) => `${path} uses the physical utility "${use}" (use the logical one)`),
    ...physicalProperties(path, content, inline).map(
      (declaration) => `${path} uses the physical property "${declaration}" (use the logical one)`,
    ),
    ...colourUses(path, content, inline).map((use) => `${path} uses the colour literal "${use}" (use a theme token)`),
  ];
}
