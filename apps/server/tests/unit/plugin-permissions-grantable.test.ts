import { enginePermissionsFor } from '@cod/plugin-rbac';
import { ownerRolePermissions } from '@cod/plugin-tenancy';
import { PERMISSION_CATALOG } from '@cod/shared';
import { defaultConfig, mergeConfig, runPluginConfigurations } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';

const valid = {
  APP_ENV: 'test',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
};

const HOW_TO_FIX =
  'No business role can be granted these plugin permissions, so only an Owner could ever call their handlers. ' +
  "Guard the handlers with requirePermission('<area>.<action>') from @cod/plugin-rbac/guard instead of a " +
  'permission of your own, or map a catalogue key to the permission in ENGINE_GRANTS ' +
  '(plugins/rbac/domain/engine-grants.ts), or list it in PLATFORM_ONLY_CUSTOM_PERMISSIONS ' +
  '(plugins/tenancy/domain/constants.ts) when only platform staff may hold it.';

/** Every permission a business role can carry: the catalogue's own names and their engine grants (D59). */
const GRANTABLE: ReadonlySet<string> = new Set(enginePermissionsFor(PERMISSION_CATALOG.map((entry) => entry.key)));

/** The custom permissions of a process started with `ROLE=role`, after every plugin's `configuration` ran. */
async function customPermissionsOf(role: ServerRole): Promise<Parameters<typeof ownerRolePermissions>[0]> {
  const userConfig = buildVendureConfig(loadEnv({ ...valid, ROLE: role }), role);
  const config = await runPluginConfigurations(mergeConfig(defaultConfig, userConfig));
  return config.authOptions.customPermissions;
}

describe('plugin permissions', () => {
  // An Owner role receives every assignable plugin permission that is not platform-only (D59). One that no
  // catalogue key carries reaches nobody else: every other role is projected from catalogue keys alone.
  it.each(SERVER_ROLES)('are all grantable through the catalogue for the %s role', async (role: ServerRole) => {
    // Arrange
    const customPermissions = await customPermissionsOf(role);

    // Act
    const ownerOnly = ownerRolePermissions(customPermissions).filter((name) => !GRANTABLE.has(name));

    // Assert: the positive control shows the plugins' configuration functions ran
    expect(customPermissions.length).toBeGreaterThan(PERMISSION_CATALOG.length);
    expect(ownerOnly, HOW_TO_FIX).toEqual([]);
  });
});
