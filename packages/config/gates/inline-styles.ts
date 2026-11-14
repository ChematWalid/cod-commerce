import ts from 'typescript';
import { findNamedColourWords, isColourProperty } from './named-colours';
import { isPhysicalDeclaration } from './physical-declarations';

/** A key naming a physical side, whatever its value (after its vendor prefix and first-letter case are dropped). */
const PHYSICAL_KEY =
  /^(?:(?:margin|padding|scrollMargin|scrollPadding)(?:Left|Right)|left|right|border(?:Top|Bottom)?(?:Left|Right)\w*)$/;

/** A React vendor prefix (`WebkitBorderLeft`, `msMarginLeft`). */
const VENDOR_PREFIX = /^(?:Webkit|Moz|ms|O)(?=[A-Z])/;

/** An LTR run (`{ direction: 'ltr', textAlign: 'left' }`) aligns to its own direction on purpose. */
const ALIGNMENT_OF_DIRECTION: Readonly<Record<string, string>> = { ltr: 'left', rtl: 'right' };

/** Operators whose either operand may become the value: `side ?? 'left'`, `x || 'white'`. */
const EITHER_OPERAND: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
]);

/** What the inline style objects of one source break: physical sides and named colours. */
export interface InlineStyleFindings {
  /** Each physical declaration as `key: value`. */
  readonly physical: readonly string[];
  /** Each named colour, as written, set by a colour key. */
  readonly namedColours: readonly string[];
}

interface StyleEntry {
  /** The key as written. */
  readonly key: string;
  /** The key without its vendor prefix, first letter lower case (`WebkitBorderLeft` → `borderLeft`). */
  readonly property: string;
  readonly valueText: string;
  /** Every plain string the value may take (`'left'`, both branches of `rtl ? 'left' : 'right'`). */
  readonly literals: readonly string[];
}

const camelToKebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function propertyOf(key: string): string {
  const bare = key.replace(VENDOR_PREFIX, '');
  return bare.charAt(0).toLowerCase() + bare.slice(1);
}

const isPlainString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

function keyOf(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || isPlainString(name)) return name.text;
  if (ts.isComputedPropertyName(name) && isPlainString(name.expression)) return name.expression.text;
  return undefined;
}

/** Drops the wrappers that leave a value unchanged: `'left' as const`, `('red')`, `x satisfies T`, `<T>x`, `x!`. */
function unwrapped(value: ts.Expression): ts.Expression {
  const isWrapper =
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isParenthesizedExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isNonNullExpression(value);
  return isWrapper ? unwrapped(value.expression) : value;
}

function literalsOf(value: ts.Expression): string[] {
  const inner = unwrapped(value);
  if (isPlainString(inner)) return [inner.text];
  if (ts.isConditionalExpression(inner)) return [...literalsOf(inner.whenTrue), ...literalsOf(inner.whenFalse)];
  if (ts.isBinaryExpression(inner) && EITHER_OPERAND.has(inner.operatorToken.kind)) {
    return [...literalsOf(inner.left), ...literalsOf(inner.right)];
  }
  return [];
}

/** A nested object, array or function is never a style value: `defineMessages({ left: { id } })`. */
function isNestedValue(value: ts.Expression): boolean {
  const inner = unwrapped(value);
  return ts.isObjectLiteralExpression(inner) || ts.isArrayLiteralExpression(inner) || ts.isFunctionLike(inner);
}

function entryOf(property: ts.ObjectLiteralElementLike, source: ts.SourceFile): StyleEntry | undefined {
  if (ts.isShorthandPropertyAssignment(property)) {
    const key = property.name.text;
    return { key, property: propertyOf(key), valueText: key, literals: [] };
  }
  if (!ts.isPropertyAssignment(property) || isNestedValue(property.initializer)) return undefined;
  const key = keyOf(property.name);
  if (key === undefined) return undefined;
  const { initializer } = property;
  return { key, property: propertyOf(key), valueText: initializer.getText(source), literals: literalsOf(initializer) };
}

function entriesOf(object: ts.ObjectLiteralExpression, source: ts.SourceFile): StyleEntry[] {
  return object.properties.flatMap((property) => entryOf(property, source) ?? []);
}

function isPhysical({ property, literals }: StyleEntry, ownAlignment: string | undefined): boolean {
  if (PHYSICAL_KEY.test(property)) return true;
  const kebab = camelToKebab(property);
  return literals
    .filter((literal) => !(property === 'textAlign' && literal === ownAlignment))
    .some((literal) => isPhysicalDeclaration(kebab, literal));
}

function ownAlignmentOf(entries: readonly StyleEntry[]): string | undefined {
  const [direction, ...others] = entries.find(({ property }) => property === 'direction')?.literals ?? [];
  return direction === undefined || others.length > 0 ? undefined : ALIGNMENT_OF_DIRECTION[direction];
}

function inspectObject(object: ts.ObjectLiteralExpression, source: ts.SourceFile): InlineStyleFindings {
  const entries = entriesOf(object, source);
  const ownAlignment = ownAlignmentOf(entries);
  const physical = entries
    .filter((entry) => isPhysical(entry, ownAlignment))
    .map(({ key, valueText }) => `${key}: ${valueText.trim()}`);
  const namedColours = entries
    .filter(({ property }) => isColourProperty(camelToKebab(property)))
    .flatMap(({ literals }) => literals.flatMap(findNamedColourWords));
  return { physical, namedColours };
}

/** The left side of `({ left } = rect)` is a destructuring target, not an object. */
function isAssignmentTarget(node: ts.ObjectLiteralExpression): boolean {
  const { parent } = node;
  return (
    ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.left === node
  );
}

function objectLiterals(source: ts.SourceFile): ts.ObjectLiteralExpression[] {
  const found: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node) && !isAssignmentTarget(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Reads every object literal of a TypeScript or TSX source (`style={{ … }}`, `const BOX_STYLE = { … }`, an object
 * nested in another or spread into one) through the TypeScript parser, so template literals, nested braces and
 * comments do not hide a key, and type literals, parameter types and destructuring patterns are never read as styles.
 * Keys are read in every form (`marginLeft: 4`, the shorthand `{ marginLeft }`, `['marginLeft']: 4`,
 * `WebkitBorderLeft`), and values through `as const`, `satisfies`, parentheses, both branches of a ternary and both
 * operands of `??`/`||`. A key holding an object, array or function (`defineMessages({ left: { id } })`) is no style.
 * Physical: `marginLeft`, `paddingRight`, `left`, `borderLeftWidth`, and every value {@link isPhysicalDeclaration}
 * rejects (`textAlign: 'right'`, `margin: '0 1px 0 2px'`, `transformOrigin: 'left'`; `textAlign` matching the
 * object's own `direction`, an LTR run, is allowed). Named colours: a plain string value of a colour key
 * (`color: 'red'`, `border: '1px solid white'`).
 *
 * @param source the TypeScript or TSX text
 * @param fileName the file name; a `.ts` file is parsed without JSX so `<T>value` casts still parse
 * @returns the physical declarations and named colours found
 */
export function inspectInlineStyles(source: string, fileName = 'source.tsx'): InlineStyleFindings {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const findings = objectLiterals(file).map((object) => inspectObject(object, file));
  return {
    physical: findings.flatMap(({ physical }) => physical),
    namedColours: findings.flatMap(({ namedColours }) => namedColours),
  };
}
