// @ts-check

/**
 * The plugin entry gate (CLAUDE.md §3a.2): an app or a package imports a plugin through its package entry
 * (`@cod/plugin-<name>`), never by a path into the plugin's folder. It is an ESLint gate because dependency-cruiser
 * leaves test files out of its graph, and a test reaching into a plugin couples the app to that plugin's layout too.
 */

/** Production code and tests alike; the architecture fixtures are deliberate violations for dependency-cruiser. */
export const PLUGIN_ENTRY_GUARDED_FILES = ['apps/**', 'packages/**'];
export const PLUGIN_ENTRY_UNGUARDED_FILES = ['**/tests/fixtures/**'];

const PLUGIN_PACKAGE_PREFIX = '@cod/plugin-';

/**
 * The sub-entries the plugins declare in their package.json `exports`, beside the root entry. A test compares this
 * list with the manifests, so a new sub-entry is added here on purpose.
 */
export const PLUGIN_SUB_ENTRIES = ['@cod/plugin-merchant-shell/shell-api', '@cod/plugin-tenancy/provisioning'];

export const PLUGIN_ENTRY_MESSAGE =
  "Import the plugin's package entry (@cod/plugin-<name>) instead: only entry points cross a plugin boundary (CLAUDE.md §3a.2)";

const subEntryPaths = PLUGIN_SUB_ENTRIES.map((entry) => entry.slice(PLUGIN_PACKAGE_PREFIX.length)).join('|');
/** A relative specifier that enters a `plugins/` folder, whatever the detour. */
const RELATIVE_INTO_PLUGINS = '^\\.{1,2}/(.*/)?plugins(/|$)';
/** A path below a plugin package that is not one of its declared sub-entries. */
const DEEP_PLUGIN_PATH = `^${PLUGIN_PACKAGE_PREFIX}(?!(${subEntryPaths})$)[^/]+/`;
const PLUGIN_ENTRY_REGEXES = [RELATIVE_INTO_PLUGINS, DEEP_PLUGIN_PATH];

/** `no-restricted-imports` patterns of the gate, to merge with a file group's other entries. */
export const PLUGIN_ENTRY_IMPORT_PATTERNS = PLUGIN_ENTRY_REGEXES.map((regex) => ({
  regex,
  message: PLUGIN_ENTRY_MESSAGE,
}));

/** The same specifiers in `import()` and `import('…')` types, which `no-restricted-imports` skips. */
export const PLUGIN_ENTRY_SYNTAX = PLUGIN_ENTRY_REGEXES.map((regex) => `/${regex.replaceAll('/', '\\/')}/`).flatMap(
  (specifier) =>
    [
      `ImportExpression[source.value=${specifier}]`,
      `TSImportType > TSLiteralType.argument > Literal[value=${specifier}]`,
      `TSImportType > Literal.source[value=${specifier}]`,
    ].map((selector) => ({ selector, message: PLUGIN_ENTRY_MESSAGE })),
);

/**
 * The gate for the files no later block covers. A flat config block REPLACES the options of a rule set by an earlier
 * block, so the blocks that follow it for the same files (the data access gate on `apps/server/src`, the framework
 * ban on `@cod/shared`) merge the entries above with their own.
 */
export const pluginEntryConfig = {
  files: PLUGIN_ENTRY_GUARDED_FILES,
  ignores: PLUGIN_ENTRY_UNGUARDED_FILES,
  rules: {
    'no-restricted-syntax': ['error', ...PLUGIN_ENTRY_SYNTAX],
    'no-restricted-imports': ['error', { patterns: PLUGIN_ENTRY_IMPORT_PATTERNS }],
  },
};
