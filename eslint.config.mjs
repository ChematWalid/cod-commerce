// @ts-check
import { codEslintConfig } from '@cod/config/eslint';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const STOREFRONT = 'apps/storefront';

/**
 * eslint-config-next's flat `core-web-vitals` config, applied to the storefront only: each entry's `files`
 * (or global `ignores`) is re-rooted under the storefront folder.
 *
 * @param {import('eslint').Linter.Config} config
 * @returns {import('eslint').Linter.Config}
 */
function scopeToStorefront(config) {
  const onlyIgnores = config.ignores !== undefined && Object.keys(config).every((key) => key === 'ignores');
  if (onlyIgnores) return { ignores: (config.ignores ?? []).map((pattern) => `${STOREFRONT}/${pattern}`) };
  const files = /** @type {string[]} */ (config.files ?? ['**/*']);
  return { ...config, files: files.map((pattern) => `${STOREFRONT}/${pattern}`) };
}

export default [
  ...codEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  .../** @type {import('eslint').Linter.Config[]} */ (nextCoreWebVitals).map(scopeToStorefront),
  // @next/next rules look for pages/ and app/ relative to this root.
  { files: [`${STOREFRONT}/**`], settings: { next: { rootDir: STOREFRONT } } },
];
