import ts from 'typescript';
import type { SourceFile } from './branding';

/**
 * The stock dashboard's top-level sections: the values of `BUILT_IN_NAV_SECTION_IDS` in `@vendure/dashboard` 3.8
 * (a test keeps the two equal). A merchant page lives in the shell's own navigation (`registerShellPage`, ADR 0010);
 * a plugin nav item in any of these would put a stock section back in front of merchants (#122, D2111, rule 18).
 * No stock section is allowed for staff either: staff pages use the own `platform` section.
 */
export const STOCK_NAV_SECTION_IDS: readonly string[] = [
  'insights',
  'catalog',
  'sales',
  'customers',
  'marketing',
  'system',
  'settings',
];

/** The plugin that owns the sidebar: its `navSections` function reshapes the stock sections for merchants (ADR 0010). */
export const NAV_OWNER_PLUGIN = 'merchant-shell';

/**
 * Names only the nav owner may use: the stock section ids, and the `@vendure/dashboard` calls that edit the nav
 * imperatively (`addNavMenuItem(item, 'catalog')` takes its section as a positional argument).
 */
const OWNER_ONLY_NAMES: ReadonlySet<string> = new Set([
  'BUILT_IN_NAV_SECTION_IDS',
  'addNavMenuItem',
  'addNavMenuSection',
  'setNavMenuConfig',
]);

/** Dashboard sources of a plugin, `plugins/<name>/dashboard/**`, in any JavaScript or TypeScript flavour. */
const DASHBOARD_SOURCE = /^plugins\/([^/]+)\/dashboard\/.+\.([cm]?[jt]sx?)$/;
const SECTION_ID_KEY = 'sectionId';
const NAV_SECTIONS_KEY = 'navSections';
const ENTRY_ID_KEY = 'id';
/** How much of an unresolvable expression a message quotes. */
const QUOTED_TEXT_MAX = 80;

/** A plugin's string constants by name; `null` marks a name declared twice with different values. */
type Constants = Map<string, string | null>;

/** One parsed dashboard source. */
interface ParsedFile {
  readonly path: string;
  readonly plugin: string;
  readonly ast: ts.SourceFile;
}

function scriptKindOf(extension: string): ts.ScriptKind {
  if (extension.endsWith('x')) return extension.includes('t') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  return extension.includes('t') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function parse({ path, content }: SourceFile): ParsedFile | undefined {
  const match = DASHBOARD_SOURCE.exec(path);
  if (match === null) return undefined;
  const kind = scriptKindOf(match[2] ?? 'ts');
  return { path, plugin: match[1] ?? '', ast: ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind) };
}

function forEachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => {
    forEachNode(child, visit);
  });
}

const isPlainString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** Drops the wrappers that leave a value unchanged: `('x')`, `'x' as const`, `<string>'x'`, `x satisfies T`, `x!`. */
function unwrapped(value: ts.Expression): ts.Expression {
  const isWrapper =
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isParenthesizedExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isNonNullExpression(value);
  return isWrapper ? unwrapped(value.expression) : value;
}

/** The text of a key, or `undefined` for a computed key that is not a plain string (`[k]`). */
function keyOf(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || isPlainString(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const expression = unwrapped(name.expression);
    return isPlainString(expression) ? expression.text : undefined;
  }
  return undefined;
}

/** Records the `const NAME = 'value'` declarations of one file (a concatenation or call stays unresolved). */
function collectConstants(file: ParsedFile, constants: Constants): void {
  forEachNode(file.ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.initializer === undefined) return;
    if (!(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const)) return;
    const value = unwrapped(node.initializer);
    if (!isPlainString(value)) return;
    const known = constants.get(node.name.text);
    constants.set(node.name.text, known === undefined || known === value.text ? value.text : null);
  });
}

function quoted(node: ts.Node): string {
  return node.getText().slice(0, QUOTED_TEXT_MAX);
}

/** Why a section value is refused, or `undefined` when it names an own or staff section. */
function sectionProblem(value: ts.Expression, constants: Constants | undefined): string | undefined {
  const inner = unwrapped(value);
  const resolved = isPlainString(inner) ? inner.text : ts.isIdentifier(inner) ? constants?.get(inner.text) : undefined;
  if (resolved === undefined || resolved === null) {
    return `names a nav section through '${quoted(value)}', not a string literal or a const of this plugin's dashboard`;
  }
  return STOCK_NAV_SECTION_IDS.includes(resolved) ? `puts a nav item in the stock section '${resolved}'` : undefined;
}

function stockLiteralOf(value: ts.Expression): string | undefined {
  const inner = unwrapped(value);
  return isPlainString(inner) && STOCK_NAV_SECTION_IDS.includes(inner.text) ? inner.text : undefined;
}

/** The ids of a `navSections` array; any other form reshapes the nav and is refused outside the owner. */
function navSectionsProblems(value: ts.Expression, file: ParsedFile, constants: Constants | undefined): string[] {
  const inner = unwrapped(value);
  if (!ts.isArrayLiteralExpression(inner)) {
    return file.plugin === NAV_OWNER_PLUGIN ? [] : ['reshapes the nav with a non-array navSections (ADR 0010)'];
  }
  return inner.elements.flatMap((entry) => {
    const objectEntry = unwrapped(entry);
    if (!ts.isObjectLiteralExpression(objectEntry))
      return [`has a navSections entry '${quoted(entry)}' it cannot read`];
    const id = objectEntry.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) && keyOf(property.name) === ENTRY_ID_KEY,
    );
    const problem = id === undefined ? undefined : sectionProblem(id.initializer, constants);
    return problem === undefined ? [] : [problem];
  });
}

/** An object property as a key (`undefined` when computed) and its value; the shorthand `{ sectionId }` included. */
function propertyEntry(node: ts.Node): { key: string | undefined; value: ts.Expression; name: ts.Node } | undefined {
  if (ts.isShorthandPropertyAssignment(node)) return { key: node.name.text, value: node.name, name: node.name };
  if (ts.isPropertyAssignment(node)) return { key: keyOf(node.name), value: node.initializer, name: node.name };
  return undefined;
}

/** The problems of one object property: a section id, a `navSections` value, or a stock id behind a computed key. */
function propertyProblems(node: ts.Node, file: ParsedFile, constants: Constants | undefined): string[] {
  if (ts.isMethodDeclaration(node) && keyOf(node.name) === NAV_SECTIONS_KEY && file.plugin !== NAV_OWNER_PLUGIN) {
    return ['reshapes the nav with a non-array navSections (ADR 0010)'];
  }
  const entry = propertyEntry(node);
  if (entry === undefined) return [];
  if (entry.key === SECTION_ID_KEY) return [sectionProblem(entry.value, constants)].filter(isDefined);
  if (entry.key === NAV_SECTIONS_KEY) return navSectionsProblems(entry.value, file, constants);
  const section = entry.key === undefined ? stockLiteralOf(entry.value) : undefined;
  return section === undefined
    ? []
    : [`puts the stock section '${section}' behind the computed key '${quoted(entry.name)}'`];
}

/** A `sectionId` JSX attribute: `<NavItem sectionId="catalog" />`. */
function jsxProblems(node: ts.Node, constants: Constants | undefined): string[] {
  if (!ts.isJsxAttribute(node) || node.name.getText() !== SECTION_ID_KEY || node.initializer === undefined) return [];
  const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
  if (value === undefined) return [];
  return [sectionProblem(value, constants)].filter(isDefined);
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

/** The owner-only names a file uses, each once, outside the nav owner. */
function ownerOnlyProblems(file: ParsedFile): string[] {
  if (file.plugin === NAV_OWNER_PLUGIN) return [];
  const used = new Set<string>();
  forEachNode(file.ast, (node) => {
    if (ts.isIdentifier(node) && OWNER_ONLY_NAMES.has(node.text)) used.add(node.text);
  });
  return [...used].map((name) =>
    name === 'BUILT_IN_NAV_SECTION_IDS'
      ? 'refers to BUILT_IN_NAV_SECTION_IDS, the stock sections'
      : `uses '${name}', which edits the stock nav outside the merchant shell (ADR 0010)`,
  );
}

function problemsOf(file: ParsedFile, constants: Constants | undefined): string[] {
  const problems = ownerOnlyProblems(file);
  forEachNode(file.ast, (node) => {
    problems.push(...propertyProblems(node, file, constants), ...jsxProblems(node, constants));
  });
  return problems;
}

/**
 * Finds plugin dashboard sources that put a nav item or section in a stock dashboard section. It reads the syntax
 * tree and fails closed: a section named by anything but a string literal (parentheses and casts aside) or a `const`
 * of the same plugin's dashboard is reported, and so is any use of the imperative nav API outside the merchant shell.
 *
 * @param files the repository files to scan; only plugin dashboard sources are read
 * @returns one message per problem; empty when every nav entry is in an own or staff section
 */
export function findStockNavSections(files: readonly SourceFile[]): string[] {
  const parsed = files.map(parse).filter(isDefined);
  const constantsByPlugin = new Map<string, Constants>();
  for (const file of parsed) {
    const constants = constantsByPlugin.get(file.plugin) ?? new Map<string, string | null>();
    constantsByPlugin.set(file.plugin, constants);
    collectConstants(file, constants);
  }
  return parsed.flatMap((file) =>
    problemsOf(file, constantsByPlugin.get(file.plugin)).map((problem) => `${file.path} ${problem} (#122, D2111)`),
  );
}
