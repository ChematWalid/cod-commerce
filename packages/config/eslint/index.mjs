// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';
import { LINT_LIMITS } from './lint-limits.mjs';
import {
  RAW_DATA_IMPORT_PATHS,
  RAW_DATA_IMPORT_PATTERNS,
  RAW_DATA_SYNTAX,
  rawDataAccessConfig,
  SERVER_SHARED_DASHBOARD_FILES,
} from './raw-data-access.mjs';

const TS_FILES = ['**/*.{ts,tsx,mts}'];
const JS_FILES = ['**/*.{js,mjs,cjs}'];
const DOMAIN_FILES = ['**/plugins/*/domain/**'];
const SHARED_FILES = ['packages/shared/src/**'];
const MAGIC_NUMBER_FILES = ['**/plugins/*/domain/**', '**/plugins/*/application/**', 'packages/shared/src/**'];
const MAGIC_NUMBER_EXEMPT = ['**/constants.ts', 'packages/shared/src/wilayas/**', 'packages/shared/src/platform/**'];
const TEST_FILES = ['**/*.test.ts', '**/tests/**'];
const MIGRATION_FILES = ['apps/server/src/migrations/**'];
const BOUNDARY_FILES = ['plugins/**', '**/tests/fixtures/arch/plugins/**'];
const FRAMEWORK_MODULES = ['@nestjs/*', '@vendure/*', 'typeorm', 'typeorm/*'];
/** The same modules as an esquery regex, for `import('@vendure/core').X` types, which `no-restricted-imports` skips. */
const FRAMEWORK_MODULE = '/^(@nestjs\\/|@vendure\\/|typeorm(\\/|$))/';
const FRAMEWORK_IMPORT_TYPES = [
  `TSImportType > TSLiteralType.argument > Literal[value=${FRAMEWORK_MODULE}]`,
  `TSImportType > Literal.source[value=${FRAMEWORK_MODULE}]`,
];
const DOMAIN_PURITY_MESSAGE = 'domain/ and @cod/shared stay framework-free (CLAUDE.md §3a.1)';
const APPLICATION_FILES = ['**/plugins/*/application/**'];
const APPLICATION_PURITY_MESSAGE =
  'application/ holds plain classes behind ports: no Nest, Vendure or TypeORM (CLAUDE.md §3a.2)';
const PLUGIN_LAYERS = ['domain', 'application', 'infrastructure', 'api', 'dashboard', 'tests'];
/** What a root file registers. `tests/` and `dashboard/` are outside the permission and data access gates. */
const SERVER_LAYERS = ['domain', 'application', 'infrastructure', 'api'];
/** The only files a plugin may keep outside its layer folders: entries, Nest module and tool configs. */
const PLUGIN_ROOT_FILES = [
  '**/plugins/*/index.ts',
  '**/plugins/*/guard.ts',
  '**/plugins/*/provisioning.ts',
  '**/plugins/*/*.plugin.ts',
  '**/plugins/*/*.config.{ts,mts}',
];
const SAME_PLUGIN = '{{ from.element.captured.plugin }}';

/** Layers each layer may import, inside its own plugin (CLAUDE.md §3a.2). */
const ALLOWED_LAYER_IMPORTS = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  api: ['api', 'application', 'domain'],
  // D92: a dashboard is presentation only (ADR 0017) and reaches no layer of its plugin's core.
  dashboard: ['dashboard'],
  tests: PLUGIN_LAYERS,
};

/**
 * Layers are folder elements matched against the full path (`partialMatch: false`; the leading `**` also classifies
 * the architecture fixtures under `tests/fixtures` like real plugins). The few files a plugin keeps beside its layers
 * are a `plugin-root` file category; any other file under a plugin is unknown and fails `boundaries/no-unknown-files`.
 */
const boundaryElements = [
  ...PLUGIN_LAYERS.map((layer) => ({
    type: layer,
    pattern: `**/plugins/*/${layer}`,
    partialMatch: false,
    capture: ['root', 'plugin'],
  })),
];

/** The one file of another plugin that a dashboard may import: the merchant shell's page registry entry (D83). */
const SHELL_API_FILE = '**/plugins/merchant-shell/dashboard/shell-api.ts';

const boundaryFiles = [
  { pattern: PLUGIN_ROOT_FILES, category: 'plugin-root', capture: ['root', 'plugin'] },
  { pattern: SHELL_API_FILE, category: 'shell-api' },
  { pattern: SERVER_SHARED_DASHBOARD_FILES, category: 'dashboard-shared', capture: ['root', 'plugin'] },
];

const SAME_ROOT_PLUGIN = '{{ from.file.captured.plugin }}';
const ROOT_FILE = { categories: 'plugin-root', captured: { plugin: SAME_ROOT_PLUGIN } };

const boundaryPolicies = [
  ...Object.entries(ALLOWED_LAYER_IMPORTS).map(([from, targets]) => ({
    from: { element: { type: from } },
    allow: { to: { element: { type: targets, captured: { plugin: SAME_PLUGIN } } } },
  })),
  // Every dashboard may import the shell's entry, whichever plugin owns it.
  { from: { element: { type: 'dashboard' } }, allow: { to: { file: { categories: 'shell-api' } } } },
  // Tests may import the plugin's root files.
  {
    from: { element: { type: 'tests' } },
    allow: { to: { file: { categories: 'plugin-root', captured: { plugin: SAME_PLUGIN } } } },
  },
  // Root files (entry, Nest module, tool configs) may import the server layers and each other, inside their own
  // plugin: never tests/, and of dashboard/ only the framework-free files an entry point re-exports.
  {
    from: { file: { categories: 'plugin-root' } },
    allow: { to: { element: { type: SERVER_LAYERS, captured: { plugin: SAME_ROOT_PLUGIN } } } },
  },
  {
    from: { file: { categories: 'plugin-root' } },
    allow: { to: { file: { categories: 'dashboard-shared', captured: { plugin: SAME_ROOT_PLUGIN } } } },
  },
  { from: { file: { categories: 'plugin-root' } }, allow: { to: { file: ROOT_FILE } } },
];

/** The data access gate's entries, for the framework-free plugin layers that are also under that gate. */
const RAW_DATA_GATE = { syntax: RAW_DATA_SYNTAX, paths: RAW_DATA_IMPORT_PATHS, patterns: RAW_DATA_IMPORT_PATTERNS };
/** `@cod/shared` is framework-free but not under the data access gate: it holds contracts and has no connection. */
const NO_GATE = { syntax: [], paths: [], patterns: [] };

/**
 * Forbids framework imports (type imports, `import('…')` types and dynamic `import()` included) in `files`. This block
 * replaces the options of both rules, so a file group that is also under the data access gate passes that gate's
 * entries as `gate` and gets them merged in.
 *
 * @param {string[]} files
 * @param {string} message
 * @param {typeof RAW_DATA_GATE | typeof NO_GATE} gate
 */
const frameworkFree = (files, message, gate) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: gate.paths,
        patterns: [{ group: FRAMEWORK_MODULES, allowTypeImports: false, message }, ...gate.patterns],
      },
    ],
    'no-restricted-syntax': [
      'error',
      { selector: 'ImportExpression', message: `Dynamic import() is not allowed: ${message}` },
      ...FRAMEWORK_IMPORT_TYPES.map((selector) => ({ selector, message })),
      ...gate.syntax,
    ],
  },
});

/**
 * The workspace ESLint flat config: type-checked TypeScript rules, the size limits of CLAUDE.md §3a.3,
 * domain and application purity (§3a.1, §3a.2) and plugin layer boundaries (§3a.2).
 *
 * @param {{ tsconfigRootDir: string }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function codEslintConfig({ tsconfigRootDir }) {
  return /** @type {import('eslint').Linter.Config[]} */ (
    tseslint.config(
      {
        ignores: [
          '**/dist/**',
          '**/.next/**',
          '**/.turbo/**',
          '**/coverage/**',
          '**/cache/dist/**',
          '**/src/gql/**',
          '.claude/**',
          'docs/**',
          '**/tests/fixtures/**',
        ],
      },
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      {
        languageOptions: {
          parserOptions: { projectService: { allowDefaultProject: ['*.mjs', '*.ts'] }, tsconfigRootDir },
        },
      },
      { files: JS_FILES, ...tseslint.configs.disableTypeChecked },
      {
        files: TS_FILES,
        rules: {
          '@typescript-eslint/no-explicit-any': 'error',
          '@typescript-eslint/no-floating-promises': 'error',
          '@typescript-eslint/no-require-imports': 'error',
          'no-empty': ['error', { allowEmptyCatch: false }],
          complexity: ['error', LINT_LIMITS.complexity],
          'max-lines': ['error', LINT_LIMITS.maxLines],
          'max-lines-per-function': ['error', { max: LINT_LIMITS.maxLinesPerFunction, IIFEs: true }],
          'max-depth': ['error', LINT_LIMITS.maxDepth],
          'max-params': ['error', LINT_LIMITS.maxParams],
        },
      },
      {
        files: MAGIC_NUMBER_FILES,
        ignores: MAGIC_NUMBER_EXEMPT,
        rules: {
          '@typescript-eslint/no-magic-numbers': [
            'error',
            {
              ignore: [0, 1, -1],
              ignoreEnums: true,
              ignoreReadonlyClassProperties: true,
              ignoreTypeIndexes: true,
            },
          ],
        },
      },
      {
        files: BOUNDARY_FILES,
        plugins: { boundaries },
        settings: {
          'import/resolver': { node: { extensions: ['.ts', '.tsx', '.mts', '.js'] } },
          'boundaries/elements': boundaryElements,
          'boundaries/files': boundaryFiles,
        },
        rules: {
          'boundaries/dependencies': [2, { default: 'disallow', policies: boundaryPolicies }],
          'boundaries/external': 'off',
          'boundaries/no-unknown-files': 'error',
        },
      },
      rawDataAccessConfig,
      frameworkFree(DOMAIN_FILES, DOMAIN_PURITY_MESSAGE, RAW_DATA_GATE),
      frameworkFree(SHARED_FILES, DOMAIN_PURITY_MESSAGE, NO_GATE),
      frameworkFree(APPLICATION_FILES, APPLICATION_PURITY_MESSAGE, RAW_DATA_GATE),
      {
        files: TEST_FILES,
        rules: { 'max-lines-per-function': 'off', '@typescript-eslint/no-magic-numbers': 'off' },
      },
      {
        // 2026-11-07 (P0.S2b-3, Task 9): migrations are generated SQL, one statement per line; the size limits of
        // CLAUDE.md §3a.3 would split a generated file by hand. Prettier ignores the folder for the same reason.
        files: MIGRATION_FILES,
        rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' },
      },
      prettierConfig,
    )
  );
}
