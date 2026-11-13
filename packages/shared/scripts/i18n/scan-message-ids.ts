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

/** Whether the binary `parent` may yield `node`: either operand of `??`/`||`, the right one of `flag && 'Save'`. */
function binaryYields(node: ts.Node, parent: ts.BinaryExpression): boolean {
  const operator = parent.operatorToken.kind;
  if (FALLBACK_OPERATORS.has(operator)) return true;
  return operator === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === node;
}

/** Whether `parent` passes the value of `node` through unchanged, so `node` may be the message itself. */
function passesValueThrough(node: ts.Node, parent: ts.Node): boolean {
  if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)) return true;
  if (ts.isSatisfiesExpression(parent) || ts.isNonNullExpression(parent)) return true;
  if (ts.isConditionalExpression(parent)) return parent.condition !== node;
  return ts.isBinaryExpression(parent) && binaryYields(node, parent);
}

/** The outermost expression whose value may be the literal: `i18n._(flag ? 'Save' : 'Cancel')` yields the argument. */
function messageSlot(node: ts.Node): ts.Node {
  let slot = node;
  while (passesValueThrough(slot, slot.parent)) slot = slot.parent;
  return slot;
}

/** Whether `slot` is the first argument of a message call, `i18n._(…)` or `i18n.t(…)`. */
function isMessageCallArgument(slot: ts.Node): boolean {
  const { parent } = slot;
  if (!ts.isCallExpression(parent) || parent.arguments[0] !== slot) return false;
  const callee = parent.expression;
  return ts.isPropertyAccessExpression(callee) && MESSAGE_CALLS.has(callee.name.text);
}

/** Whether the value sits where only a catalogue id belongs: a message call, a title property, a message constant. */
function isExplicitMessage(node: ts.Node): boolean {
  const slot = messageSlot(node);
  const { parent } = slot;
  if (isMessageCallArgument(slot)) return true;
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
  /**
   * Matches every id the template can produce: its fixed parts, with anything between them. `null` when the fixed
   * parts hold no dot (`` `${key}` ``): such a pattern would match any registered id, so it proves nothing.
   */
  readonly pattern: RegExp | null;
}

/** What one dashboard file uses: literal ids in order of appearance, and template ids built at run time. */
export interface ScannedMessages {
  readonly ids: readonly string[];
  readonly templates: readonly TemplateMessageId[];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The fixed head of a template that builds a catalogue id wherever it is written: `` `orders.status.${s}` ``. */
const DOTTED_TEMPLATE_HEAD = /^[a-z][a-z0-9-]*\./;

/**
 * Whether a template literal builds a catalogue id: any template given to a message call, and anywhere else (a
 * variable, a builder's return, a JSX `id`, a `title` value) one whose fixed head starts like a dotted id. Display
 * text such as `` title: `${name} – Settings` `` is therefore not taken for an id.
 */
function isTemplateMessageId(node: ts.TemplateExpression): boolean {
  return DOTTED_TEMPLATE_HEAD.test(node.head.text) || isMessageCallArgument(messageSlot(node));
}

function templateMessageId(node: ts.TemplateExpression, file: ts.SourceFile): TemplateMessageId {
  const fixed = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
  const text = node.getText(file).slice(1, -1);
  if (!fixed.some((part) => part.includes('.'))) return { text, pattern: null };
  return { text, pattern: new RegExp(`^${fixed.map(escapeRegExp).join('.+')}$`) };
}

/**
 * Scans a dashboard file. A literal counts when it is (or may be, through `?:`, `??`, `||`, the right side of `&&`,
 * parentheses, `as`, `satisfies` or `!`) the argument of a message call, a `title`/`titleId` value or a
 * `*_MESSAGE_ID`/`*_TITLE` constant, or when it is any dotted literal other than a module specifier, a file name, a
 * permission key or one of `nonMessageLiterals`. A template literal with substitutions is a template id when a message
 * call receives it or its fixed head starts like a dotted id (see `isTemplateMessageId`). Comments are not code.
 */
export function scanDashboardSource(source: DashboardSource, nonMessageLiterals: ReadonlySet<string>): ScannedMessages {
  const kind = source.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, kind);
  const ids: string[] = [];
  const templates: TemplateMessageId[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node) && isTemplateMessageId(node)) templates.push(templateMessageId(node, file));
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
