// @ts-check

/** Where ids are handled: the apps, the plugins and the shared contracts. Tests build fixture ids as they like. */
const GUARDED_FILES = ['**/*.{ts,tsx,mts}'];
const UNGUARDED_FILES = ['**/*.test.ts', '**/tests/**', '**/*.d.ts'];

/** An identifier or property named like an id: `id`, `orderId`, `store_id`. */
const ID_NAME = /^id$|Id$|_id$/;

/** Global functions that turn a string into a number. */
const NUMBER_FUNCTIONS = new Set(['Number', 'parseInt', 'parseFloat']);
/** Static methods of `Number` that do the same. */
const NUMBER_METHODS = new Set(['parseInt', 'parseFloat']);

/**
 * The name an expression reads: `orderId` for `orderId`, `id` for `row.id` or `row['id']`.
 *
 * @param {import('estree').Node | undefined} node
 * @returns {string | undefined}
 */
const readName = (node) => {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type !== 'MemberExpression') return undefined;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  return node.property.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : undefined;
};

/** @param {import('estree').Node | undefined} node */
const isIdExpression = (node) => {
  const name = readName(node);
  return name !== undefined && ID_NAME.test(name);
};

/**
 * True for `Number(…)`, `parseInt(…)`, `parseFloat(…)`, `Number.parseInt(…)` and `Number.parseFloat(…)`.
 *
 * @param {import('estree').Expression | import('estree').Super} callee
 */
const isNumberConversion = (callee) => {
  if (callee.type === 'Identifier') return NUMBER_FUNCTIONS.has(callee.name);
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Number' &&
    callee.property.type === 'Identifier' &&
    NUMBER_METHODS.has(callee.property.name)
  );
};

/**
 * Ids are decimal strings up to 2^63 − 1 (ADR 0003); a JavaScript number keeps only 2^53, so a converted id silently
 * becomes another id. Validate with `idSchema` / `coreIdSchema` from `@cod/shared` and keep the string.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noNumericId = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      convert:
        'Do not turn an id into a number: it loses digits past 2^53 (ADR 0003). Keep the string and validate it with idSchema or coreIdSchema from @cod/shared.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isNumberConversion(node.callee) && isIdExpression(node.arguments[0])) {
          context.report({ node, messageId: 'convert' });
        }
      },
      UnaryExpression(node) {
        if (node.operator === '+' && isIdExpression(node.argument)) {
          context.report({ node, messageId: 'convert' });
        }
      },
    };
  },
};

/**
 * The id gate. It is a rule of its own rather than `no-restricted-syntax` entries: several blocks of this config
 * already set that rule's options for the same files, and the last one to match would replace these.
 */
export const numericIdConfig = {
  files: GUARDED_FILES,
  ignores: UNGUARDED_FILES,
  plugins: { 'cod-ids': { rules: { 'no-numeric-id': noNumericId } } },
  rules: { 'cod-ids/no-numeric-id': 'error' },
};
