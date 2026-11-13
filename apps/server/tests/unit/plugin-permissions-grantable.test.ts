import { enginePermissionsFor } from '@cod/plugin-rbac';
import { ownerRolePermissions } from '@cod/plugin-tenancy';
import { PERMISSION_CATALOG } from '@cod/shared';
import { defaultConfig, mergeConfig, runPluginConfigurations } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { CORE_ENV } from '../support/deployed-env.fixture';

const valid = CORE_ENV;

const HOW_TO_FIX =
  'No business role can be granted these plugin permissions, so only an Owner could ever call their handlers. ' +
  "Guard the handlers with requirePermission('<area>.<action>') from @cod/plugin-rbac/guard instead of a " +
  'permission of your own, or map a catalogue key to the permission in ENGINE_GRANTS ' +
  '(plugins/rbac/domain/engine-grants.ts).';

/** Every permission a business role can carry: the catalogue's own names and their engine grants (D59). */
const GRANTABLE: ReadonlySet<string> = new Set(enginePermissionsFor(PERMISSION_CATALOG.map((entry) => entry.key)));

/**
 * Tenancy permissions that reach an Owner and no other role today. D59 and D97 map six tenancy permissions to
 * catalogue keys and leave these two out: they guard no handler. Each needs a product decision (a catalogue key and
 * an `ENGINE_GRANTS` entry, or the platform-only list); until then they are named here so that nothing new joins
 * them unnoticed.
 */
const OWNER_ONLY_PENDING_DECISION: readonly string[] = ['CreateTenantBusiness', 'DeleteTenantBusiness'];

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
    expect(
      ownerOnly.filter((name) => !OWNER_ONLY_PENDING_DECISION.includes(name)),
      HOW_TO_FIX,
    ).toEqual([]);
  });

  it('keeps no exception that became grantable or no longer exists', async () => {
    // Arrange
    const ownerPermissions: readonly string[] = ownerRolePermissions(await customPermissionsOf('api'));

    // Act
    const stale = OWNER_ONLY_PENDING_DECISION.filter((name) => GRANTABLE.has(name) || !ownerPermissions.includes(name));

    // Assert
    expect(stale).toEqual([]);
  });
});
