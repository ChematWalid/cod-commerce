import ts from 'typescript';
import { findNamedColourWords, isColourProperty } from './named-colours';

/** A key naming a physical side, whatever its value. */
const PHYSICAL_KEY =
  /^(?:(?:margin|padding|scrollMargin|scrollPadding)(?:Left|Right)|left|right|border(?:Top|Bottom)?(?:Left|Right)\w*)$/;

/** A key that is physical only with a `left` or `right` value. */
const SIDE_VALUED_KEY = /^(?:textAlign|float|clear)$/;
const SIDE = /^(?:left|right)$/;

/** An LTR run (`{ direction: 'ltr', textAlign: 'left' }`) aligns to its own direction on purpose. */
const ALIGNMENT_OF_DIRECTION: Readonly<Record<string, string>> = { ltr: 'left', rtl: 'right' };

/** What the inline style objects of one source break: physical sides and named colours. */
export interface InlineStyleFindings {
  /** Each physical declaration as `key: value`. */
  readonly physical: readonly string[];
  /** Each named colour, as written, set by a colour key. */
  readonly namedColours: readonly string[];
}

interface StyleEntry {
  readonly key: string;
  readonly valueText: string;
  /** The value when it is a plain string (`'left'`, `` `red` ``); undefined for any other expression. */
  readonly literal: string | undefined;
}

const camelToKebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function keyOf(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return undefined;
}

function literalOf(value: ts.Expression): string | undefined {
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  return undefined;
}

function entriesOf(object: ts.ObjectLiteralExpression, source: ts.SourceFile): StyleEntry[] {
  return object.properties.filter(ts.isPropertyAssignment).flatMap((property) => {
    const key = keyOf(property.name);
    if (key === undefined) return [];
    const { initializer } = property;
    return [{ key, valueText: initializer.getText(source), literal: literalOf(initializer) }];
  });
}

function isPhysical({ key, literal }: StyleEntry, ownAlignment: string | undefined): boolean {
  if (PHYSICAL_KEY.test(key)) return true;
  if (!SIDE_VALUED_KEY.test(key) || literal === undefined || !SIDE.test(literal)) return false;
  return !(key === 'textAlign' && literal === ownAlignment);
}

function inspectObject(object: ts.ObjectLiteralExpression, source: ts.SourceFile): InlineStyleFindings {
  const entries = entriesOf(object, source);
  const direction = entries.find(({ key }) => key === 'direction')?.literal;
  const ownAlignment = direction === undefined ? undefined : ALIGNMENT_OF_DIRECTION[direction];
  const physical = entries
    .filter((entry) => isPhysical(entry, ownAlignment))
    .map(({ key, valueText }) => `${key}: ${valueText.trim()}`);
  const namedColours = entries
    .filter(({ key, literal }) => literal !== undefined && isColourProperty(camelToKebab(key)))
    .flatMap(({ literal = '' }) => findNamedColourWords(literal));
  return { physical, namedColours };
}

function objectLiterals(source: ts.SourceFile): ts.ObjectLiteralExpression[] {
  const found: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Reads every object literal of a TypeScript or TSX source (`style={{ … }}`, `const BOX_STYLE = { … }`, an object
 * nested in another or spread into one) through the TypeScript parser, so template literals, nested braces and
 * comments do not hide a key, and type literals, parameter types and destructuring patterns are never read as styles.
 * Physical: `marginLeft`, `paddingRight`, `left`, `borderLeftWidth`, and `textAlign`, `float` or `clear` set to
 * `'left'` or `'right'` (`textAlign` matching the object's own `direction`, an LTR run, is allowed). Named colours: a
 * plain string value of a colour key (`color: 'red'`, `border: '1px solid white'`).
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
