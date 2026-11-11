// @ts-check

/** Where configuration is consumed: the server app, the storefront and every plugin. */
const GUARDED_FILES = ['apps/server/src/**', 'apps/storefront/**', '**/plugins/*/**'];

/**
 * Outside the gate: tests set and read the environment of their own run, and tool configs (Vitest, Vite, Next's
 * `next.config.ts`) are evaluated by the tool, before any env module exists to ask.
 */
const UNGUARDED_FILES = ['**/*.test.ts', '**/tests/**', '**/*.config.{ts,mts}', '**/*.d.ts'];

/**
 * The only guarded files that may read `process.env`, each with its reason. Everything else takes configuration
 * from one of them, or from the typed value they return. A new entry needs a reason of the same kind.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const PROCESS_ENV_READERS = {
  'apps/server/src/config/env.ts': 'the server env module: loadEnv validates process.env for every role',
  'apps/server/src/healthcheck.ts':
    'the entry of the container healthcheck, a separate process: it hands process.env to readHealthEnv',
  'apps/storefront/src/config/storefront-env.ts': 'the storefront env module: it validates process.env at boot',
  'apps/storefront/cache/cache-config.ts':
    'the env module of the cache handlers, which are compiled apart from the app and cannot import the one above',
  'apps/storefront/instrumentation.ts':
    'Next replaces the literal process.env.NEXT_RUNTIME at build time, and the boot check starts here',
};

const PROCESS_MODULES = new Set(['node:process', 'process']);

/**
 * True for the key `env`, written `x.env`, `x['env']` or `{ env }`.
 *
 * @param {import('estree').Expression | import('estree').PrivateIdentifier} key
 * @param {boolean} computed
 */
const isEnvKey = (key, computed) =>
  (!computed && key.type === 'Identifier' && key.name === 'env') || (key.type === 'Literal' && key.value === 'env');

/** @param {import('estree').Node | null | undefined} node */
const isProcess = (node) => node?.type === 'Identifier' && node.name === 'process';

/**
 * Configuration is typed and validated at boot (CLAUDE.md §3a.5). A read of `process.env` anywhere else is a
 * variable no schema knows: it is not validated, not in `.env.example`, and compose does not pass it.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noProcessEnv = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      read: 'Read configuration through the env modules, not process.env: loadEnv (apps/server/src/config/env.ts) or loadStorefrontEnv (apps/storefront/src/config/storefront-env.ts). A plugin takes it from its init options (CLAUDE.md §3a.5).',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isProcess(node.object) && isEnvKey(node.property, node.computed)) {
          context.report({ node, messageId: 'read' });
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !isProcess(node.init)) return;
        const env = node.id.properties.find(
          (property) => property.type === 'Property' && isEnvKey(property.key, property.computed),
        );
        if (env) context.report({ node: env, messageId: 'read' });
      },
      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string' || !PROCESS_MODULES.has(node.source.value)) return;
        const env = node.specifiers.find(
          (specifier) => specifier.type === 'ImportSpecifier' && isEnvKey(specifier.imported, false),
        );
        if (env) context.report({ node: env, messageId: 'read' });
      },
    };
  },
};

/**
 * The env gate. It is a rule of its own rather than a `no-restricted-syntax` entry: several blocks of this config
 * already set that rule's options for the same files, and the last one to match would replace this one.
 */
export const processEnvConfig = {
  files: GUARDED_FILES,
  ignores: [...UNGUARDED_FILES, ...Object.keys(PROCESS_ENV_READERS)],
  plugins: { 'cod-env': { rules: { 'no-process-env': noProcessEnv } } },
  rules: { 'cod-env/no-process-env': 'error' },
};
