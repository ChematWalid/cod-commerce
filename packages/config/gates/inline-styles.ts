/**
 * An innermost `{ … }` block in an expression position: after `=` (not `=>`), `(`, `,`, `{`, `:`, `?`, `[` or
 * `return`. That covers `style={{ … }}`, `const BOX_STYLE = { … }` and an object passed as an argument, and leaves
 * out function and class bodies (after `)`, `=>` or a name), so a parameter list such as `(left: A, right: B)` inside
 * a body is never read as style keys.
 */
const OBJECT_LITERAL = /(?:(?<![=!<>])=|[(,{:?[]|\breturn)\s*(\{[^{}]*\})/g;

/** A key naming a physical side, whatever its value. */
const PHYSICAL_KEY =
  /[{,]\s*['"]?((?:margin|padding|scrollMargin|scrollPadding)(?:Left|Right)|left|right|border(?:Top|Bottom)?(?:Left|Right)\w*)['"]?\s*:\s*([^,}]*)/g;

/** A key that is physical only with a `left` or `right` value. */
const PHYSICAL_VALUE = /[{,]\s*['"]?(textAlign|float|clear)['"]?\s*:\s*['"](left|right)['"]/g;

/** An LTR run (`{ direction: 'ltr', textAlign: 'left' }`) aligns to its own direction on purpose. */
const DIRECTION = /[{,]\s*['"]?direction['"]?\s*:\s*['"](ltr|rtl)['"]/;
const ALIGNMENT_OF_DIRECTION: Readonly<Record<string, string>> = { ltr: 'left', rtl: 'right' };

const declarationOf = (key: string, value: string): string => `${key}: ${value.trim()}`;

function physicalDeclarations(block: string): string[] {
  const direction = DIRECTION.exec(block)?.[1];
  const ownAlignment = direction === undefined ? undefined : ALIGNMENT_OF_DIRECTION[direction];
  const keys = [...block.matchAll(PHYSICAL_KEY)].map(([, key = '', value = '']) => declarationOf(key, value));
  const values = [...block.matchAll(PHYSICAL_VALUE)]
    .filter(([, key, side]) => !(key === 'textAlign' && side === ownAlignment))
    .map(([, key = '', side = '']) => declarationOf(key, `'${side}'`));
  return [...keys, ...values];
}

/**
 * Finds the physical-side keys of the inline style objects in a TypeScript or TSX source: `marginLeft`,
 * `paddingRight`, `left`, `borderLeftWidth`, and `textAlign`, `float` or `clear` set to `'left'` or `'right'`.
 * `textAlign` matching the object's own `direction` (an LTR run) is allowed.
 *
 * @param source the TypeScript or TSX text
 * @returns each offending declaration as `key: value`
 */
export function findPhysicalInlineStyles(source: string): string[] {
  return [...source.matchAll(OBJECT_LITERAL)].flatMap(([, block = '']) => physicalDeclarations(block));
}
