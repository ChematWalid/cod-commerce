import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCatalogues, formatProblem, SHELL_PLUGIN, usedMessageIds } from '../../scripts/i18n/check-catalogues';
import { loadPluginCatalogues } from '../../scripts/i18n/load-plugin-catalogues';

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

  it('every message id has a translation in each required catalogue', () => {
    const problems = checkCatalogues({ plugins }).map(formatProblem);
    if (problems.length > 0) console.error(problems.join('\n'));

    expect(problems).toEqual([]);
  });
});
