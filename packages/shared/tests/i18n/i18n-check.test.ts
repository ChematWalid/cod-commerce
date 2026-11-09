import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCatalogues, formatProblem, usedMessageIds } from '../../scripts/i18n/check-catalogues';
import { loadPluginCatalogues } from '../../scripts/i18n/load-plugin-catalogues';

/** The repository's plugins, each with an optional `dashboard/` of its own. */
const PLUGINS_DIR = join(__dirname, '../../../../plugins');

/** Below this, the scan is broken: the shell, auth and rbac dashboards alone use more. */
const MIN_EXPECTED_IDS = 100;

describe('i18n:check (D89)', async () => {
  const plugins = await loadPluginCatalogues(PLUGINS_DIR);

  it('finds the messages of every plugin dashboard', () => {
    const total = plugins.reduce((sum, plugin) => sum + usedMessageIds(plugin).length, 0);

    expect(total).toBeGreaterThan(MIN_EXPECTED_IDS);
  });

  it('every message id has a translation in each required catalogue', () => {
    const problems = checkCatalogues({ plugins }).map(formatProblem);
    if (problems.length > 0) console.error(problems.join('\n'));

    expect(problems).toEqual([]);
  });
});
