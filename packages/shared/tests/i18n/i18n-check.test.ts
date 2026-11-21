import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCatalogues, formatProblem, SHELL_PLUGIN, usedMessageIds } from '../../scripts/i18n/check-catalogues';
import { loadPluginCatalogues } from '../../scripts/i18n/load-plugin-catalogues';
import { PERMISSION_CATALOG } from '../../src/permissions';

/** The repository's plugins, each with an optional `dashboard/` of its own. */
const PLUGINS_DIR = join(__dirname, '../../../../plugins');

/** Below this, the scan is broken: the shell, auth and rbac dashboards alone use more. */
const MIN_EXPECTED_IDS = 100;

describe('i18n:check (D89)', async () => {
  const plugins = await loadPluginCatalogues(PLUGINS_DIR);

  it('finds the messages of every plugin dashboard', () => {
    // The shell's literals hold for every dashboard, as checkCatalogues applies them.
    const shellLiterals = plugins.find((plugin) => plugin.plugin === SHELL_PLUGIN)?.nonMessageLiterals ?? [];
    expect(shellLiterals.length).toBeGreaterThan(0);
    const total = plugins.reduce((sum, plugin) => sum + usedMessageIds(plugin, shellLiterals).length, 0);

    expect(total).toBeGreaterThan(MIN_EXPECTED_IDS);
  });

  it('reports a namespace template beside the real permission keys and shell leaf ids', () => {
    // Arrange: every namespace of a real permission key or shell leaf id, as `ns.${field}` outside a message slot.
    const shell = plugins.find((plugin) => plugin.plugin === SHELL_PLUGIN);
    const leafIds = shell?.nonMessageLiterals ?? [];
    const namespaces = [...PERMISSION_CATALOG.map((entry) => entry.key), ...leafIds]
      .filter((key) => key.includes('.'))
      .map((key) => key.slice(0, key.lastIndexOf('.')));
    const templates = [...new Set(['catalog.products', ...namespaces])].map((ns) => `${ns}.\${field}`);
    const source = templates.map((text, index) => `const k${String(index)} = \`${text}\`;`).join('\n');
    const demo = { plugin: 'demo', sources: [{ path: 'dashboard/page.tsx', text: source }], catalogues: {} };

    // Act
    const reported = checkCatalogues({ plugins: [...(shell ? [shell] : []), demo] })
      .filter((problem) => problem.plugin === 'demo' && problem.kind === 'dynamic')
      .map((problem) => problem.id);

    // Assert
    expect(leafIds.length).toBeGreaterThan(0);
    expect(reported).toEqual(expect.arrayContaining(templates));
    expect(reported).toContain('catalog.products.${field}');
  });

  it('every message id has a translation in each required catalogue', () => {
    const problems = checkCatalogues({ plugins }).map(formatProblem);
    if (problems.length > 0) console.error(problems.join('\n'));

    expect(problems).toEqual([]);
  });
});
