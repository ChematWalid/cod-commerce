import { AuthPlugin } from '@cod/plugin-auth';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { CatalogImportPlugin } from '@cod/plugin-catalog-import';
import { CatalogPacksPlugin } from '@cod/plugin-catalog-packs';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { TeamPlugin } from '@cod/plugin-team';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { CORE_ENV } from '../support/deployed-env.fixture';

const valid = CORE_ENV;

// The catalog plugins' registration, apart from plugins-registered.test.ts, which is at its 300-line limit.
describe('buildPlugins: the catalog plugins', () => {
  it.each(SERVER_ROLES)(
    'registers Catalog once for the %s role: after Auth, before Collections and Team (its order-manager check, D2137), Packs and Import (D2200)',
    (role: ServerRole) => {
      // Arrange: collections import catalog's module, so Catalog configures once, before them (P2.S3)
      const env = loadEnv({ ...valid, ROLE: role });
      const expectedOrder: readonly unknown[] = [
        AuthPlugin,
        CatalogPlugin,
        CollectionsRulesPlugin,
        TeamPlugin,
        CatalogPacksPlugin,
        CatalogImportPlugin,
      ];

      // Act
      const plugins = buildPlugins(env, role);

      // Assert: each of them appears once, in this order
      expect(plugins.filter((plugin) => expectedOrder.includes(plugin))).toEqual(expectedOrder);
    },
  );

  it.each(SERVER_ROLES)(
    'registers CatalogImportPlugin on the private bucket for the %s role (D2208)',
    (role: ServerRole) => {
      // Arrange
      const env = loadEnv({ ...valid, ROLE: role, S3_PUBLIC_ENDPOINT: 'http://localhost:3900' });

      // Act
      const plugins = buildPlugins(env, role);

      // Assert
      expect(plugins).toContain(CatalogImportPlugin);
      expect(CatalogImportPlugin.options).toMatchObject({
        objectStorage: {
          kind: 's3',
          endpoint: env.S3_ENDPOINT,
          publicEndpoint: 'http://localhost:3900',
          bucket: env.S3_BUCKET_PRIVATE,
        },
        linkScraper: 'http',
        appEnv: env.APP_ENV,
      });
    },
  );
});
