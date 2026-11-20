import { CatalogPlugin } from '@cod/plugin-catalog';
import { OffersPlugin } from '@cod/plugin-offers';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { CORE_ENV } from '../support/deployed-env.fixture';

// Beside plugins-registered.test.ts, which is at the 300-line limit (CLAUDE.md §3a.3).
describe('buildPlugins: offers', () => {
  // Offers import catalog's module (D2402): they configure once, right after it, on every role (migrate creates tables).
  it.each(SERVER_ROLES)('registers OffersPlugin once for the %s role, after CatalogPlugin', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...CORE_ENV, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert: offers appear once, immediately after the catalog
    expect(plugins.filter((plugin) => plugin === OffersPlugin)).toHaveLength(1);
    expect(plugins.indexOf(OffersPlugin)).toBe(plugins.indexOf(CatalogPlugin) + 1);
  });
});
