// @ts-check

/** Plugin source and app source. Tests reset a plugin's static state between cases, so they stay outside the gate. */
const GUARDED_FILES = ['**/plugins/*/**', 'apps/**'];
const UNGUARDED_FILES = ['**/*.test.ts', '**/tests/**'];

/** The static members a plugin class keeps what its host registered it with. */
const STATIC_CONFIGURATION = new Set(['options', 'config']);
const PLUGIN_CLASS = /Plugin$/;

/**
 * The name of the member a member expression reaches, for `X.options` and `X['options']`.
 *
 * @param {import('estree').MemberExpression} member
 * @returns {string | undefined}
 */
const memberName = (member) => {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.property.type === 'Literal' && typeof member.property.value === 'string') return member.property.value;
  return undefined;
};

/**
 * A plugin's static configuration is written only in the file that declares the plugin class (its own `init`). Any
 * other file writing `XPlugin.options` configures a plugin from outside its host: the host could then forget
 * `XPlugin.init(...)` and still boot, on whatever defaults the writer chose (CLAUDE.md §3a.2, §3a.5).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noForeignPluginOptions = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      foreign:
        "The host composes plugins: call {{plugin}}.init(...) in the host instead of writing another plugin's static {{member}} (CLAUDE.md §3a.2).",
    },
  },
  create(context) {
    /** @type {Set<string>} */
    const declaredHere = new Set();
    /** @type {{ node: import('estree').Node, plugin: string, member: string }[]} */
    const writes = [];
    return {
      /** @param {import('estree').ClassDeclaration | import('estree').ClassExpression} node */
      ':matches(ClassDeclaration, ClassExpression)'(node) {
        if (node.id) declaredHere.add(node.id.name);
      },
      AssignmentExpression(node) {
        const { left } = node;
        if (left.type !== 'MemberExpression' || left.object.type !== 'Identifier') return;
        const member = memberName(left);
        if (member === undefined || !STATIC_CONFIGURATION.has(member) || !PLUGIN_CLASS.test(left.object.name)) return;
        writes.push({ node, plugin: left.object.name, member });
      },
      'Program:exit'() {
        for (const { node, plugin, member } of writes) {
          if (!declaredHere.has(plugin)) context.report({ node, messageId: 'foreign', data: { plugin, member } });
        }
      },
    };
  },
};

/**
 * The plugin configuration gate. It is a rule of its own rather than `no-restricted-syntax` entries: a selector cannot
 * tell the plugin a file declares from the one it imports, and every real plugin's `init` writes `XPlugin.options`.
 */
export const pluginStaticOptionsConfig = {
  files: GUARDED_FILES,
  ignores: UNGUARDED_FILES,
  plugins: { cod: { rules: { 'no-foreign-plugin-options': noForeignPluginOptions } } },
  rules: { 'cod/no-foreign-plugin-options': 'error' },
};
