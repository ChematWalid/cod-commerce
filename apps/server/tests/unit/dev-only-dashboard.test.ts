import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TemplatePlugin } from '@cod/plugin-template';
import { PLUGIN_METADATA } from '@vendure/core';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { DEPLOYED_OVERRIDES, TEST_ENV } from '../support/deployed-env.fixture';

/**
 * The image builds the dashboard once, with `APP_ENV=development` (Dockerfile), so it bundles the dashboard
 * extension of every development-only plugin while the deployed server does not register their APIs. Such an
 * extension must therefore add nothing a merchant can reach: no route, nav entry, page or toolbar item.
 */
const REACHABLE_KEYS: ReadonlySet<string> = new Set([
  'routes',
  'navSections',
  'navMenuItem',
  'pageBlocks',
  'toolbarItems',
  'actionBarItems',
  'addNavMenuItem',
  'addNavMenuSection',
  'registerShellPage',
]);

/** Where each development-only plugin's package lives, to find its dashboard entry. */
const PACKAGE_OF = new Map<object, string>([[TemplatePlugin, '@cod/plugin-template']]);
/** The server's own `node_modules`, where pnpm links each workspace plugin package. */
const SERVER_MODULES = join(__dirname, '../../node_modules');

const developmentOnly = (): unknown[] => {
  const deployed = buildPlugins(loadEnv({ ...TEST_ENV, ...DEPLOYED_OVERRIDES, APP_ENV: 'production' }), 'api');
  const development = buildPlugins(loadEnv({ ...TEST_ENV, APP_ENV: 'development' }), 'api');
  return development.filter((plugin) => !deployed.includes(plugin));
};

/** The names a source spells as identifiers or property keys; comments and strings are not read. */
function spelledNames(path: string): Set<string> {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

describe('development-only plugins in the shared dashboard bundle', () => {
  it('lists every development-only plugin with its package', () => {
    // Act
    const plugins = developmentOnly();

    // Assert
    expect(plugins).toEqual([...PACKAGE_OF.keys()]);
  });

  it.each([...PACKAGE_OF])(
    'gives the plugin of $1 a dashboard extension a merchant cannot reach',
    (plugin, packageName) => {
      // Arrange
      const entry = Reflect.getMetadata(PLUGIN_METADATA.DASHBOARD, plugin) as string | undefined;
      const packageDir = join(SERVER_MODULES, packageName);

      // Act
      const reachable =
        entry === undefined
          ? []
          : [...spelledNames(join(packageDir, entry))].filter((name) => REACHABLE_KEYS.has(name));

      // Assert
      expect(reachable).toEqual([]);
    },
  );
});
