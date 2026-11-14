import ts from 'typescript';
import type { SourceFile } from './branding';
import {
  collectConstants,
  forEachNode,
  isDefined,
  isPlainString,
  keyOf,
  type ParsedFile,
  parseDashboardFile,
  type PluginConstants,
  quoted,
  stringValueOf,
  unwrapped,
} from './dashboard-nav-syntax';

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

const SECTION_ID_KEY = 'sectionId';
const NAV_SECTIONS_KEY = 'navSections';
const NAV_MENU_ITEM_KEY = 'navMenuItem';
const ENTRY_ID_KEY = 'id';
const DASHBOARD_PACKAGE = '@vendure/dashboard';

type Constants = PluginConstants | undefined;

/** Why a section value is refused, or `undefined` when it names an own or staff section. */
function sectionProblem(value: ts.Expression, constants: Constants): string | undefined {
  const resolved = stringValueOf(value, constants);
  if (resolved === undefined) {
    return `names a nav section through '${quoted(value)}', not a string literal or a const of this plugin's dashboard`;
  }
  return STOCK_NAV_SECTION_IDS.includes(resolved) ? `puts a nav item in the stock section '${resolved}'` : undefined;
}

function stockLiteralOf(value: ts.Expression): string | undefined {
  const inner = unwrapped(value);
  return isPlainString(inner) && STOCK_NAV_SECTION_IDS.includes(inner.text) ? inner.text : undefined;
}

/** An object property as a key (`undefined` when unreadable) and its value; the shorthand `{ sectionId }` included. */
function propertyEntry(
  node: ts.Node,
  constants: Constants,
): { key: string | undefined; value: ts.Expression; name: ts.Node } | undefined {
  if (ts.isShorthandPropertyAssignment(node)) return { key: node.name.text, value: node.name, name: node.name };
  if (ts.isPropertyAssignment(node))
    return { key: keyOf(node.name, constants), value: node.initializer, name: node.name };
  return undefined;
}

/**
 * The value under `key` in an object literal the gate can read in full: no spread and no key it cannot resolve.
 * `undefined` when the object is unreadable or has no such plain property.
 */
function readableValue(
  object: ts.ObjectLiteralExpression,
  key: string,
  constants: Constants,
): ts.Expression | undefined {
  const entries = object.properties.map((property) => propertyEntry(property, constants));
  const unreadable = object.properties.some(
    (property, index) =>
      ts.isSpreadAssignment(property) ||
      keyOf(property.name, constants) === undefined ||
      (entries[index] === undefined && keyOf(property.name, constants) === key),
  );
  return unreadable ? undefined : entries.find((entry) => entry?.key === key)?.value;
}

/** A `navSections` array: each entry must show its `id`; any other form reshapes the nav, the owner's job alone. */
function navSectionsProblems(value: ts.Expression, file: ParsedFile, constants: Constants): string[] {
  const inner = unwrapped(value);
  if (!ts.isArrayLiteralExpression(inner)) {
    return file.plugin === NAV_OWNER_PLUGIN ? [] : ['reshapes the nav with a non-array navSections (ADR 0010)'];
  }
  return inner.elements.flatMap((entry) => {
    const objectEntry = unwrapped(entry);
    const id = ts.isObjectLiteralExpression(objectEntry)
      ? readableValue(objectEntry, ENTRY_ID_KEY, constants)
      : undefined;
    if (id === undefined) return [`has a navSections entry '${quoted(entry)}' it cannot read`];
    return [sectionProblem(id, constants)].filter(isDefined);
  });
}

/**
 * A `navMenuItem` must be an object literal, or a `const` object of the plugin's dashboard, whose `sectionId` the
 * gate can read; the `sectionId` value itself is checked where the object is written.
 */
function navMenuItemProblems(value: ts.Expression, constants: Constants): string[] {
  const inner = unwrapped(value);
  const object = ts.isIdentifier(inner) ? (constants?.objects.get(inner.text) ?? undefined) : inner;
  const readable = object !== undefined && ts.isObjectLiteralExpression(object);
  return readable && readableValue(object, SECTION_ID_KEY, constants) !== undefined
    ? []
    : [`has a navMenuItem '${quoted(value)}' it cannot read`];
}

/** The problems of one object property: a section id, a nav carrier, or a stock id behind an unreadable key. */
function propertyProblems(node: ts.Node, file: ParsedFile, constants: Constants): string[] {
  if (
    ts.isMethodDeclaration(node) &&
    keyOf(node.name, constants) === NAV_SECTIONS_KEY &&
    file.plugin !== NAV_OWNER_PLUGIN
  ) {
    return ['reshapes the nav with a non-array navSections (ADR 0010)'];
  }
  const entry = propertyEntry(node, constants);
  if (entry === undefined) return [];
  if (entry.key === SECTION_ID_KEY) return [sectionProblem(entry.value, constants)].filter(isDefined);
  if (entry.key === NAV_SECTIONS_KEY) return navSectionsProblems(entry.value, file, constants);
  if (entry.key === NAV_MENU_ITEM_KEY) return navMenuItemProblems(entry.value, constants);
  const section = entry.key === undefined ? stockLiteralOf(entry.value) : undefined;
  return section === undefined
    ? []
    : [`puts the stock section '${section}' behind the computed key '${quoted(entry.name)}'`];
}

/** `item.sectionId = …`, `item['sectionId'] = …`, and an element assignment through a key it cannot resolve. */
function assignmentProblems(node: ts.Node, constants: Constants): string[] {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return [];
  const target = unwrapped(node.left);
  if (ts.isPropertyAccessExpression(target)) {
    return target.name.text === SECTION_ID_KEY ? [sectionProblem(node.right, constants)].filter(isDefined) : [];
  }
  if (!ts.isElementAccessExpression(target) || ts.isNumericLiteral(unwrapped(target.argumentExpression))) return [];
  const key = stringValueOf(target.argumentExpression, constants);
  if (key === undefined)
    return [`sets a property through '${quoted(target.argumentExpression)}', a key it cannot resolve`];
  return key === SECTION_ID_KEY ? [sectionProblem(node.right, constants)].filter(isDefined) : [];
}

/** A `sectionId` JSX attribute: `<NavItem sectionId="catalog" />`. */
function jsxProblems(node: ts.Node, constants: Constants): string[] {
  if (!ts.isJsxAttribute(node) || node.name.getText() !== SECTION_ID_KEY || node.initializer === undefined) return [];
  const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
  if (value === undefined) return [];
  return [sectionProblem(value, constants)].filter(isDefined);
}

/** The local names of `import * as name from '@vendure/dashboard'`. */
function dashboardNamespaces(file: ParsedFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.ast.statements) {
    if (!ts.isImportDeclaration(statement) || !isPlainString(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (
      statement.moduleSpecifier.text === DASHBOARD_PACKAGE &&
      bindings !== undefined &&
      ts.isNamespaceImport(bindings)
    ) {
      names.add(bindings.name.text);
    }
  }
  return names;
}

/** The name a node spells: an identifier, or a plain string used as a member (`d['addNavMenuItem']`). */
function spelledName(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (!ts.isElementAccessExpression(node)) return undefined;
  const argument = unwrapped(node.argumentExpression);
  return isPlainString(argument) ? argument.text : undefined;
}

/** A member of a `@vendure/dashboard` namespace read through a key it cannot resolve: `vd['addNavMenu' + 'Item']`. */
function isOpaqueDashboardMember(node: ts.Node, namespaces: ReadonlySet<string>): node is ts.ElementAccessExpression {
  if (!ts.isElementAccessExpression(node) || !ts.isIdentifier(node.expression)) return false;
  return namespaces.has(node.expression.text) && !isPlainString(unwrapped(node.argumentExpression));
}

/** The owner-only names a file uses, each once, and the dashboard members it hides, outside the nav owner. */
function ownerOnlyProblems(file: ParsedFile): string[] {
  if (file.plugin === NAV_OWNER_PLUGIN) return [];
  const used = new Set<string>();
  const opaque: string[] = [];
  const namespaces = dashboardNamespaces(file);
  forEachNode(file.ast, (node) => {
    const name = spelledName(node);
    if (name !== undefined && OWNER_ONLY_NAMES.has(name)) used.add(name);
    if (isOpaqueDashboardMember(node, namespaces)) {
      opaque.push(`reaches ${DASHBOARD_PACKAGE} through '${quoted(node)}', a member it cannot resolve (ADR 0010)`);
    }
  });
  const named = [...used].map((name) =>
    name === 'BUILT_IN_NAV_SECTION_IDS'
      ? 'refers to BUILT_IN_NAV_SECTION_IDS, the stock sections'
      : `uses '${name}', which edits the stock nav outside the merchant shell (ADR 0010)`,
  );
  return [...named, ...opaque];
}

function problemsOf(file: ParsedFile, constants: Constants): string[] {
  const problems = ownerOnlyProblems(file);
  forEachNode(file.ast, (node) => {
    problems.push(
      ...propertyProblems(node, file, constants),
      ...assignmentProblems(node, constants),
      ...jsxProblems(node, constants),
    );
  });
  return problems;
}

/**
 * Finds plugin dashboard sources that put a nav item or section in a stock dashboard section. It reads the syntax
 * tree of each file and resolves string and object `const`s across the same plugin's dashboard. It reports:
 * - a `sectionId` (property, shorthand, computed key, JSX attribute or assignment) or a `navSections` `id` that is
 *   a stock section, or that is neither a string literal (parentheses and casts aside) nor such a `const`;
 * - a `navMenuItem` that is not an object literal or object `const` with a readable `sectionId` (no spread, no key
 *   it cannot resolve), and a `navSections` entry without a readable `id`;
 * - an element assignment through a key it cannot resolve;
 * - outside the merchant shell, the imperative nav API and `BUILT_IN_NAV_SECTION_IDS` by name or bracket access,
 *   any bracket access to a `@vendure/dashboard` namespace it cannot resolve, and a non-array `navSections`.
 * It does not follow route objects imported from outside the plugin's dashboard into `routes`.
 *
 * @param files the repository files to scan; only plugin dashboard sources are read
 * @returns one message per problem; empty when every nav entry is in an own or staff section
 */
export function findStockNavSections(files: readonly SourceFile[]): string[] {
  const parsed = files.map(parseDashboardFile).filter(isDefined);
  const constantsByPlugin = new Map<string, PluginConstants>();
  for (const file of parsed) {
    const constants = constantsByPlugin.get(file.plugin) ?? { strings: new Map(), objects: new Map() };
    constantsByPlugin.set(file.plugin, constants);
    collectConstants(file, constants);
  }
  return parsed.flatMap((file) =>
    problemsOf(file, constantsByPlugin.get(file.plugin)).map((problem) => `${file.path} ${problem} (#122, D2111)`),
  );
}
