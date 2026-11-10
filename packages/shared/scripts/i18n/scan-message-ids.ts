import ts from 'typescript';
import { isPermissionKey } from '../../src/permissions';

/** A dashboard source file, by its path (for the parser's dialect) and its text. */
export interface DashboardSource {
  readonly path: string;
  readonly text: string;
}

/** Any dotted literal is taken for a catalogue id, so a later plugin's prefix needs no change here (D89). */
const DOTTED_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;

/** A literal naming a file rather than a message. */
const FILE_LIKE = /\.(?:css|po|svg|png|jpe?g|webp|ico|woff2?|json|tsx?|m?js)$/;

/** Calls whose first argument is a catalogue id: Lingui's `i18n._(id)` and `i18n.t(id)`. */
const MESSAGE_CALLS: ReadonlySet<string> = new Set(['_', 't']);

/** Object properties whose literal value is a catalogue id. */
const MESSAGE_PROPERTIES: ReadonlySet<string> = new Set(['title', 'titleId']);

/** Constants whose literal value is a catalogue id, whatever its shape. */
const MESSAGE_CONSTANT = /_(?:MESSAGE_ID|TITLE)$/;

type Literal = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;

function isModuleSpecifier(node: Literal): boolean {
  const { parent } = node;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) return true;
  return ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword;
}

/** Whether the literal sits where only a catalogue id belongs: a message call, a title property, a message constant. */
function isExplicitMessage(node: Literal): boolean {
  const { parent } = node;
  if (ts.isCallExpression(parent) && parent.arguments[0] === node) {
    const callee = parent.expression;
    return ts.isPropertyAccessExpression(callee) && MESSAGE_CALLS.has(callee.name.text);
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return ts.isIdentifier(parent.name) && MESSAGE_PROPERTIES.has(parent.name.text);
  }
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    return ts.isIdentifier(parent.name) && MESSAGE_CONSTANT.test(parent.name.text);
  }
  return false;
}

function isGenericMessage(text: string, nonMessageLiterals: ReadonlySet<string>): boolean {
  if (!DOTTED_ID.test(text) || FILE_LIKE.test(text)) return false;
  return !isPermissionKey(text) && !nonMessageLiterals.has(text);
}

/**
 * The catalogue ids a dashboard file uses, in order of appearance. A literal counts when it is the argument of a
 * message call, a `title`/`titleId` value or a `*_MESSAGE_ID`/`*_TITLE` constant, or when it is any dotted literal
 * other than a module specifier, a file name, a permission key or one of `nonMessageLiterals`. Comments are not code.
 */
export function scanMessageIds(source: DashboardSource, nonMessageLiterals: ReadonlySet<string>): string[] {
  const kind = source.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, kind);
  const ids: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isModuleSpecifier(node)) return;
      if (isExplicitMessage(node) || isGenericMessage(node.text, nonMessageLiterals)) ids.push(node.text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return ids;
}
