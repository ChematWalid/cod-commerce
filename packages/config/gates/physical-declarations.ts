/** A vendor prefix of a CSS property (`-webkit-mask-position`). */
const CSS_VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;

/** A property with a `left` or `right` part: `margin-left`, `left`, `border-top-left-radius`. */
const SIDED_PROPERTY = /(?:^|-)(?:left|right)(?:-|$)/;

/**
 * Properties that are physical only with a `left` or `right` value. The side word may come second
 * (`justify-content: safe left`, `justify-items: legacy right`).
 */
const SIDE_VALUED_PROPERTY = /^(?:text-align(?:-last)?|float|clear|justify-(?:content|self|items))$/;

/** Shorthands whose position part (`url(a.png) no-repeat left center`) may name a side. */
const POSITION_SHORTHAND = /^(?:background|mask)$/;

/**
 * A gradient towards a side (`linear-gradient(to right, …)`, `to top left`) or centred on one
 * (`radial-gradient(circle at left, …)`), in any property.
 */
const SIDED_GRADIENT = /(?:linear|radial|conic)-gradient\(\s*(?:[^,()]*\s)?(?:to|at)\s+(?:[a-z]+\s+)?(?:left|right)\b/;

/** Properties whose position keywords (`left top`) do not mirror under `dir="rtl"`. */
const POSITION_PROPERTY =
  /^(?:background-position(?:-x)?|transform-origin|object-position|mask-position|perspective-origin)$/;

/** Box shorthands whose 4-value form (`top right bottom left`) sets each side. */
const BOX_SHORTHAND = /^(?:margin|padding|inset|scroll-margin|scroll-padding|border-width|border-style|border-color)$/;

const SIDE_WORD = /^(?:left|right)$/;
const IMPORTANT = /\s*!\s*important\s*$/i;

/**
 * Splits a value into its space-separated parts, keeping a function call (`calc(1px + 2px)`) whole.
 *
 * @param value the value text
 * @returns the top-level parts, lower case
 */
function partsOf(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value.replace(IMPORTANT, '').trim().toLowerCase()) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
    } else current += char;
  }
  return current === '' ? parts : [...parts, current];
}

/** The words of a shorthand, past its `url(…)`, string and function parts, layer commas and `position/size` slash. */
const shorthandWords = (parts: readonly string[]): string[] =>
  parts.filter((part) => !/[("']/.test(part)).flatMap((part) => part.split(/[,/]/));

/** A 4-value box shorthand is physical unless its right and left parts match. */
const isOneSidedBox = (parts: readonly string[]): boolean => parts.length === 4 && parts[1] !== parts[3];

/** A radius list is physical unless the top corners and the bottom corners pair up (`tl tr br bl`). */
function isOneSidedRadius(parts: readonly string[]): boolean {
  const [a, b = a, c = a, d = b] = parts;
  return a !== b || c !== d;
}

const isOneSidedRadiusValue = (value: string): boolean =>
  value.split('/').some((side) => isOneSidedRadius(partsOf(side)));

/**
 * Tells whether a CSS declaration places something on a physical side, so it does not mirror under `dir="rtl"`: a
 * property with a `left`/`right` part, `text-align(-last)`/`float`/`clear`/`justify-*` set to one, a position
 * (`background-position`, `transform-origin`, the `background`/`mask` shorthands…) naming one, a gradient towards or
 * at one, a 4-value box shorthand whose right and left differ, or a `border-radius` whose corners differ from side to
 * side.
 *
 * @param property the property, kebab case, in any case and with any vendor prefix
 * @param value the value text; empty when it is not a plain string
 * @returns true when the declaration is physical
 */
export function isPhysicalDeclaration(property: string, value: string): boolean {
  const name = property.toLowerCase().replace(CSS_VENDOR_PREFIX, '');
  if (name.startsWith('--')) return false;
  if (SIDED_PROPERTY.test(name)) return true;
  if (SIDED_GRADIENT.test(value.toLowerCase())) return true;
  const parts = partsOf(value);
  if (SIDE_VALUED_PROPERTY.test(name) || POSITION_PROPERTY.test(name))
    return parts.some((part) => SIDE_WORD.test(part));
  if (POSITION_SHORTHAND.test(name)) return shorthandWords(parts).some((word) => SIDE_WORD.test(word));
  if (BOX_SHORTHAND.test(name)) return isOneSidedBox(parts);
  if (name === 'border-radius') return isOneSidedRadiusValue(value);
  return false;
}
