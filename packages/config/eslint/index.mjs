// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';
import { LINT_LIMITS } from './lint-limits.mjs';

const TS_FILES = ['**/*.{ts,tsx,mts}'];
const JS_FILES = ['**/*.{js,mjs,cjs}'];
const DOMAIN_FILES = ['**/plugins/*/domain/**', 'packages/shared/src/**'];
const MAGIC_NUMBER_FILES = ['**/plugins/*/domain/**', '**/plugins/*/application/**', 'packages/shared/src/**'];
const MAGIC_NUMBER_EXEMPT = ['**/constants.ts', 'packages/shared/src/wilayas/**', 'packages/shared/src/platform/**'];
const TEST_FILES = ['**/*.test.ts', '**/tests/**'];
const MIGRATION_FILES = ['apps/server/src/migrations/**'];
const BOUNDARY_FILES = ['plugins/**', '**/tests/fixtures/arch/plugins/**'];
const FRAMEWORK_MODULES = ['@nestjs/*', '@vendure/*', 'typeorm', 'typeorm/*'];
const DOMAIN_PURITY_MESSAGE = 'domain/ and @cod/shared stay framework-free (CLAUDE.md §3a.1)';
const APPLICATION_FILES = ['**/plugins/*/application/**'];
const APPLICATION_PURITY_MESSAGE =
  'application/ holds plain classes behind ports: no Nest, Vendure or TypeORM (CLAUDE.md §3a.2)';
const PLUGIN_LAYERS = ['domain', 'application', 'infrastructure', 'api', 'dashboard', 'tests'];
/** The only files a plugin may keep outside its layer folders: entry, Nest module and tool configs. */
const PLUGIN_ROOT_FILES = ['**/plugins/*/index.ts', '**/plugins/*/*.plugin.ts', '**/plugins/*/*.config.{ts,mts}'];
const SAME_PLUGIN = '{{ from.element.captured.plugin }}';

/** Layers each layer may import, inside its own plugin (CLAUDE.md §3a.2). */
const ALLOWED_LAYER_IMPORTS = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  api: ['api', 'application', 'domain'],
  dashboard: ['dashboard', 'domain'],
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

const boundaryFiles = [{ pattern: PLUGIN_ROOT_FILES, category: 'plugin-root', capture: ['root', 'plugin'] }];

const SAME_ROOT_PLUGIN = '{{ from.file.captured.plugin }}';
const ROOT_FILE = { categories: 'plugin-root', captured: { plugin: SAME_ROOT_PLUGIN } };

const boundaryPolicies = [
  ...Object.entries(ALLOWED_LAYER_IMPORTS).map(([from, targets]) => ({
    from: { element: { type: from } },
    allow: { to: { element: { type: targets, captured: { plugin: SAME_PLUGIN } } } },
  })),
  // Tests may import the plugin's root files.
  {
    from: { element: { type: 'tests' } },
    allow: { to: { file: { categories: 'plugin-root', captured: { plugin: SAME_PLUGIN } } } },
  },
  // Root files (entry, Nest module, tool configs) may import every layer and each other, inside their own plugin.
  {
    from: { file: { categories: 'plugin-root' } },
    allow: { to: { element: { type: PLUGIN_LAYERS, captured: { plugin: SAME_ROOT_PLUGIN } } } },
  },
  { from: { file: { categories: 'plugin-root' } }, allow: { to: { file: ROOT_FILE } } },
];

/**
 * Forbids framework imports (type imports and dynamic `import()` included) in `files`.
 *
 * @param {string[]} files
 * @param {string} message
 */
const frameworkFree = (files, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: FRAMEWORK_MODULES, allowTypeImports: false, message }] }],
    'no-restricted-syntax': [
      'error',
      { selector: 'ImportExpression', message: `Dynamic import() is not allowed: ${message}` },
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
      frameworkFree(DOMAIN_FILES, DOMAIN_PURITY_MESSAGE),
      frameworkFree(APPLICATION_FILES, APPLICATION_PURITY_MESSAGE),
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
