import type { SourceFile } from './branding';

/** Dashboard sources of a plugin: `plugins/<name>/dashboard/**` TypeScript, TSX and CSS (ADR 0005, ADR 0010). */
const DASHBOARD_SOURCE = /^plugins\/[^/]+\/dashboard\/.+\.(?:ts|tsx|css)$/;

/** A utility class token: optional variants (`md:`, `dark:`), an optional negative sign, the utility. */
const CLASS_TOKEN = /(?<![\w:./-])((?:[\w[\]&>*=-]+:)*)(-?[a-z][\w-]*)/g;

/** Utilities that name a physical side. Their logical twins (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `rounded-s-`, `border-s-`) are the rule. */
const PHYSICAL_UTILITY =
  /^-?(?:ml-|mr-|pl-|pr-|left-(?!to-right)|right-(?!to-left)|text-left$|text-right$|rounded-l-|rounded-r-|border-l-|border-r-)/;

/** Utilities that paint a fixed colour instead of a theme token. */
const COLOUR_UTILITY = /^(?:bg-white|bg-black|text-white|text-black)(?![\w-])/;

/** Colour functions and hex literals. A hex literal has 3, 4, 6 or 8 digits and stands alone. */
const COLOUR_LITERAL = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/;

/** An `rtl:` or `ltr:` variant is a deliberate direction-specific rule, not a physical use. */
const isDirectionVariant = (variants: string): boolean => /(?:^|:)(?:rtl|ltr):/.test(variants);

function physicalUse(content: string): string | undefined {
  for (const [, variants = '', utility = ''] of content.matchAll(CLASS_TOKEN)) {
    if (PHYSICAL_UTILITY.test(utility) && !isDirectionVariant(variants)) return `${variants}${utility}`;
  }
  return undefined;
}

function colourUse(content: string): string | undefined {
  for (const [, variants = '', utility = ''] of content.matchAll(CLASS_TOKEN)) {
    if (COLOUR_UTILITY.test(utility)) return `${variants}${utility}`;
  }
  return COLOUR_LITERAL.exec(content)?.[0];
}

/**
 * Checks the dashboard style rules: layout uses logical utilities (`ms-2`, `text-start`) so it mirrors under
 * `dir="rtl"`, and colour comes from the theme tokens (`bg-background`) so dark mode follows. Icons are unaffected.
 *
 * @param files the repo-relative files to scan; those outside `plugins/*\/dashboard` are ignored
 * @returns one message per offending file and rule; empty when the sources are clean
 */
export function findDashboardStyleViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path }) => DASHBOARD_SOURCE.test(path))
    .flatMap(({ path, content }) => {
      const physical = physicalUse(content);
      const colour = colourUse(content);
      return [
        ...(physical === undefined ? [] : [`${path} uses the physical utility "${physical}" (use the logical one)`]),
        ...(colour === undefined ? [] : [`${path} uses the colour literal "${colour}" (use a theme token)`]),
      ];
    });
}
