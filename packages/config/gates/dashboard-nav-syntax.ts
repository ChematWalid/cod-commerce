import ts from 'typescript';
import type { SourceFile } from './branding';

/** Dashboard sources of a plugin, `plugins/<name>/dashboard/**`, in any JavaScript or TypeScript flavour. */
const DASHBOARD_SOURCE = /^plugins\/([^/]+)\/dashboard\/.+\.([cm]?[jt]sx?)$/;
/** How much of an unresolvable expression a message quotes. */
const QUOTED_TEXT_MAX = 80;

/** One parsed plugin dashboard source. */
export interface ParsedFile {
  readonly path: string;
  readonly plugin: string;
  readonly ast: ts.SourceFile;
}

/**
 * The `const` declarations of one plugin's dashboard by name: string values, and object literals (the form a nav
 * item may take). `null` marks a name declared twice with different values, which stays unresolved.
 */
export interface PluginConstants {
  readonly strings: Map<string, string | null>;
  readonly objects: Map<string, ts.ObjectLiteralExpression | null>;
}

function scriptKindOf(extension: string): ts.ScriptKind {
  if (extension.endsWith('x')) return extension.includes('t') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  return extension.includes('t') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

/** Parses a plugin dashboard source; any other file gives `undefined`. */
export function parseDashboardFile({ path, content }: SourceFile): ParsedFile | undefined {
  const match = DASHBOARD_SOURCE.exec(path);
  if (match === null) return undefined;
  const kind = scriptKindOf(match[2] ?? 'ts');
  return { path, plugin: match[1] ?? '', ast: ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind) };
}

/** Visits `node` and every node below it, depth first. */
export function forEachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => {
    forEachNode(child, visit);
  });
}

export const isPlainString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** Drops the wrappers that leave a value unchanged: `('x')`, `'x' as const`, `<string>'x'`, `x satisfies T`, `x!`. */
export function unwrapped(value: ts.Expression): ts.Expression {
  const isWrapper =
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isParenthesizedExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isNonNullExpression(value);
  return isWrapper ? unwrapped(value.expression) : value;
}

/** The string an expression holds when it is a plain string or a `const` of the plugin; `undefined` otherwise. */
export function stringValueOf(value: ts.Expression, constants: PluginConstants | undefined): string | undefined {
  const inner = unwrapped(value);
  if (isPlainString(inner)) return inner.text;
  return ts.isIdentifier(inner) ? (constants?.strings.get(inner.text) ?? undefined) : undefined;
}

/** The text of a key, a computed one resolved through the plugin's consts; `undefined` when it cannot be read. */
export function keyOf(name: ts.PropertyName, constants: PluginConstants | undefined): string | undefined {
  if (ts.isIdentifier(name) || isPlainString(name)) return name.text;
  return ts.isComputedPropertyName(name) ? stringValueOf(name.expression, constants) : undefined;
}

function remember<T>(map: Map<string, T | null>, name: string, value: T, same: (a: T, b: T) => boolean): void {
  const known = map.get(name);
  map.set(name, known === undefined || (known !== null && same(known, value)) ? value : null);
}

/** Records the `const NAME = 'value'` and `const NAME = { ... }` declarations of one file. */
export function collectConstants(file: ParsedFile, constants: PluginConstants): void {
  forEachNode(file.ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.initializer === undefined) return;
    if (!(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const)) return;
    const value = unwrapped(node.initializer);
    if (isPlainString(value)) remember(constants.strings, node.name.text, value.text, (a, b) => a === b);
    if (ts.isObjectLiteralExpression(value)) remember(constants.objects, node.name.text, value, (a, b) => a === b);
  });
}

/** The start of a node's source text, for a message. */
export function quoted(node: ts.Node): string {
  return node.getText().slice(0, QUOTED_TEXT_MAX);
}

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
