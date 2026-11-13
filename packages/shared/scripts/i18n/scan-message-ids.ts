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

/** Operators whose operands may each be the message: `label ?? 'Fallback'`, `label || 'Fallback'`. */
const FALLBACK_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
]);

/** Whether `parent` passes the value of `node` through unchanged, so `node` may be the message itself. */
function passesValueThrough(node: ts.Node, parent: ts.Node): boolean {
  if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)) return true;
  if (ts.isSatisfiesExpression(parent) || ts.isNonNullExpression(parent)) return true;
  if (ts.isConditionalExpression(parent)) return parent.condition !== node;
  return ts.isBinaryExpression(parent) && FALLBACK_OPERATORS.has(parent.operatorToken.kind);
}

/** The outermost expression whose value may be the literal: `i18n._(flag ? 'Save' : 'Cancel')` yields the argument. */
function messageSlot(node: ts.Node): ts.Node {
  let slot = node;
  while (passesValueThrough(slot, slot.parent)) slot = slot.parent;
  return slot;
}

/** Whether the value sits where only a catalogue id belongs: a message call, a title property, a message constant. */
function isExplicitMessage(node: ts.Node): boolean {
  const slot = messageSlot(node);
  const { parent } = slot;
  if (ts.isCallExpression(parent) && parent.arguments[0] === slot) {
    const callee = parent.expression;
    return ts.isPropertyAccessExpression(callee) && MESSAGE_CALLS.has(callee.name.text);
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === slot) {
    return ts.isIdentifier(parent.name) && MESSAGE_PROPERTIES.has(parent.name.text);
  }
  if (ts.isVariableDeclaration(parent) && parent.initializer === slot) {
    return ts.isIdentifier(parent.name) && MESSAGE_CONSTANT.test(parent.name.text);
  }
  return false;
}

function isGenericMessage(text: string, nonMessageLiterals: ReadonlySet<string>): boolean {
  if (!DOTTED_ID.test(text) || FILE_LIKE.test(text)) return false;
  return !isPermissionKey(text) && !nonMessageLiterals.has(text);
}

/** A message id built at run time from a template literal, such as `` `orders.status.${status}` ``. */
export interface TemplateMessageId {
  /** The template as written in the source, without its backticks. */
  readonly text: string;
  /** Matches every id the template can produce: its fixed parts, with anything between them. */
  readonly pattern: RegExp;
}

/** What one dashboard file uses: literal ids in order of appearance, and template ids built at run time. */
export interface ScannedMessages {
  readonly ids: readonly string[];
  readonly templates: readonly TemplateMessageId[];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function templateMessageId(node: ts.TemplateExpression, file: ts.SourceFile): TemplateMessageId {
  const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].map(escapeRegExp);
  return { text: node.getText(file).slice(1, -1), pattern: new RegExp(`^${parts.join('.+')}$`) };
}

/**
 * Scans a dashboard file. A literal counts when it is (or may be, through `?:`, `??`, `||`, parentheses or `as`) the
 * argument of a message call, a `title`/`titleId` value or a `*_MESSAGE_ID`/`*_TITLE` constant, or when it is any
 * dotted literal other than a module specifier, a file name, a permission key or one of `nonMessageLiterals`. A
 * template literal with substitutions in one of those message places is a template id. Comments are not code.
 */
export function scanDashboardSource(source: DashboardSource, nonMessageLiterals: ReadonlySet<string>): ScannedMessages {
  const kind = source.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, kind);
  const ids: string[] = [];
  const templates: TemplateMessageId[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node) && isExplicitMessage(node)) templates.push(templateMessageId(node, file));
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isModuleSpecifier(node)) return;
      if (isExplicitMessage(node) || isGenericMessage(node.text, nonMessageLiterals)) ids.push(node.text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { ids, templates };
}

/** The literal catalogue ids a dashboard file uses, in order of appearance (see `scanDashboardSource`). */
export function scanMessageIds(source: DashboardSource, nonMessageLiterals: ReadonlySet<string>): string[] {
  return [...scanDashboardSource(source, nonMessageLiterals).ids];
}
