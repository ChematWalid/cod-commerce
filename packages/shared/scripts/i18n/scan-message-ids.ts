import ts from 'typescript';
import { PERMISSION_CATALOG, isPermissionKey } from '../../src/permissions';

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

/**
 * A message id built at run time from a template literal, such as `` `orders.status.${status}` ``, or by `+`, such as
 * `'orders.status.' + status`. The check proves only that one registered dynamic id has its shape, not that every
 * value of a substitution is registered: build the id from the same `as const` tuple the plugin's `dynamic-ids.ts`
 * registers (as team's `CONFIRMED_COMMANDS` does), so a new value cannot reach the screen untranslated.
 */
export interface TemplateMessageId {
  /** The id as a template, without backticks: fixed parts as written, each substitution as `${expression}`. */
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

/** JSX attributes whose value is a catalogue id; any other (`data-testid`, `className`) holds no message. */
const MESSAGE_ATTRIBUTES: ReadonlySet<string> = new Set(['id', 'message']);

const PERMISSION_KEYS: readonly string[] = PERMISSION_CATALOG.map((entry) => entry.key);

/** One piece of an id built at run time: text written in the source, or an expression filled in at run time. */
type Segment = { readonly fixed: string } | { readonly hole: string };

function templateSegments(node: ts.TemplateExpression, file: ts.SourceFile): Segment[] {
  const spans = node.templateSpans.flatMap((span) => [
    { hole: span.expression.getText(file) },
    { fixed: span.literal.text },
  ]);
  return [{ fixed: node.head.text }, ...spans];
}

const isPlus = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;

function concatSegments(node: ts.Expression, file: ts.SourceFile): Segment[] {
  if (isPlus(node)) return [...concatSegments(node.left, file), ...concatSegments(node.right, file)];
  if (ts.isParenthesizedExpression(node)) return concatSegments(node.expression, file);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ fixed: node.text }];
  if (ts.isTemplateExpression(node)) return templateSegments(node, file);
  return [{ hole: node.getText(file) }];
}

function messageIdOf(segments: readonly Segment[]): TemplateMessageId {
  const text = segments.map((part) => ('fixed' in part ? part.fixed : `\${${part.hole}}`)).join('');
  if (!segments.some((part) => 'fixed' in part && part.fixed.includes('.'))) return { text, pattern: null };
  const source = segments.map((part) => ('fixed' in part ? escapeRegExp(part.fixed) : '.+')).join('');
  return { text, pattern: new RegExp(`^${source}$`) };
}

/** Whether the template sits in a JSX attribute that holds no message, such as `data-testid={`row.${id}`}`. */
function isInNonMessageAttribute(node: ts.Node): boolean {
  const { parent } = messageSlot(node);
  if (!ts.isJsxExpression(parent) || !ts.isJsxAttribute(parent.parent)) return false;
  return !MESSAGE_ATTRIBUTES.has(parent.parent.name.getText());
}

/**
 * Whether a dotted template outside a message slot is something else, as dotted literals are skipped: a file name
 * (its last fixed part), a permission key or a declared non-message literal (its shape matches one, or the registry
 * declares its text), or the value of a JSX attribute that holds no message.
 */
function isNonMessageTemplate(
  node: ts.TemplateExpression,
  id: TemplateMessageId,
  nonMessage: ReadonlySet<string>,
): boolean {
  const tail = node.templateSpans.at(-1)?.literal.text ?? '';
  if (FILE_LIKE.test(tail) || nonMessage.has(id.text) || isInNonMessageAttribute(node)) return true;
  const { pattern } = id;
  if (pattern === null) return false;
  return PERMISSION_KEYS.some((key) => pattern.test(key)) || [...nonMessage].some((literal) => pattern.test(literal));
}

/**
 * The template id a template literal builds, or `null`. Any template given to a message call counts; a template in a
 * `title` value or a message constant counts with a dotted head (so `` title: `${name} – Settings` `` does not);
 * anywhere else (a variable, a builder's return, a JSX `id`) a dotted head counts unless `isNonMessageTemplate`.
 */
function templateMessageId(
  node: ts.TemplateExpression,
  file: ts.SourceFile,
  nonMessage: ReadonlySet<string>,
): TemplateMessageId | null {
  const id = messageIdOf(templateSegments(node, file));
  if (isMessageCallArgument(messageSlot(node))) return id;
  if (!DOTTED_TEMPLATE_HEAD.test(node.head.text)) return null;
  if (isExplicitMessage(node)) return id;
  return isNonMessageTemplate(node, id, nonMessage) ? null : id;
}

/** Whether `node` is the whole of a `+` chain that sits in a message slot, such as `i18n._('orders.' + s)`. */
const isConcatenatedMessage = (node: ts.Node): node is ts.BinaryExpression =>
  isPlus(node) && !isPlus(node.parent) && isExplicitMessage(node);

/** The operands of a `+` chain that are expressions rather than text, which may hold message calls of their own. */
function concatHoles(node: ts.Expression): ts.Expression[] {
  if (isPlus(node)) return [...concatHoles(node.left), ...concatHoles(node.right)];
  if (ts.isParenthesizedExpression(node)) return concatHoles(node.expression);
  const isText = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);
  return isText ? [] : [node];
}

/**
 * Scans a dashboard file. A literal counts when it is (or may be, through `?:`, `??`, `||`, the right side of `&&`,
 * parentheses, `as`, `satisfies` or `!`) the argument of a message call, a `title`/`titleId` value or a
 * `*_MESSAGE_ID`/`*_TITLE` constant, or when it is any dotted literal other than a module specifier, a file name, a
 * permission key or one of `nonMessageLiterals`. A template literal with substitutions is a template id as
 * `templateMessageId` decides; a `+` chain in one of those message slots is one too. Comments are not code.
 */
export function scanDashboardSource(source: DashboardSource, nonMessageLiterals: ReadonlySet<string>): ScannedMessages {
  const kind = source.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, kind);
  const ids: string[] = [];
  const templates: TemplateMessageId[] = [];
  const visit = (node: ts.Node): void => {
    if (isConcatenatedMessage(node)) {
      templates.push(messageIdOf(concatSegments(node, file)));
      concatHoles(node).forEach(visit);
      return;
    }
    const template = ts.isTemplateExpression(node) ? templateMessageId(node, file, nonMessageLiterals) : null;
    if (template !== null) templates.push(template);
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
