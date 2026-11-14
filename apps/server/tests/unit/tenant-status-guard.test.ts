import { enginePermissionsFor } from '@cod/plugin-rbac';
import { ownerRolePermissions } from '@cod/plugin-tenancy';
import { PERMISSION_CATALOG } from '@cod/shared';
import { defaultConfig, mergeConfig, Permission, runPluginConfigurations } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { CORE_ENV } from '../support/deployed-env.fixture';

const STOCK_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(Permission));

const HOW_TO_FIX =
  'A catalogue key now carries a stock Vendure permission, so a merchant can reach stock handlers that are not ' +
  '@TenantScoped(): archive and suspension are not enforced there (TEN-3). Before keeping the grant, add the global ' +
  'tenant status guard (option A, an APP_GUARD) as the ADR 0002 addendum "tenant status on every handler (P2.S1)" ' +
  'requires, then widen this test.';

const OWNER_HOW_TO_FIX =
  'The Owner role now carries a stock Vendure permission (a plugin permission named like a core one, or one added to ' +
  'ownerRolePermissions), so an owner of a suspended business or an archived store can reach stock handlers that are ' +
  'not @TenantScoped() (TEN-3). Rename the permission, or add the global tenant status guard (option A) first, as ' +
  'the ADR 0002 addendum "tenant status on every handler (P2.S1)" requires.';

/** The permissions an Owner role receives in a process started with `ROLE=role`, after every plugin's `configuration` ran. */
async function ownerPermissionsOf(role: ServerRole): Promise<{ owner: readonly string[]; custom: number }> {
  const userConfig = buildVendureConfig(loadEnv({ ...CORE_ENV, ROLE: role }), role);
  const config = await runPluginConfigurations(mergeConfig(defaultConfig, userConfig));
  const { customPermissions } = config.authOptions;
  return { owner: ownerRolePermissions(customPermissions), custom: customPermissions.length };
}

// An invariant pin, not a test-first case: it passes while REVIEWED_STOCK_ENGINE_GRANTS is empty. It overlaps
// plugins/rbac/tests/unit/engine-grants.test.ts on purpose, and adds the TEN-3 reason and the ADR pointer, so the
// session that reviews the first stock grant learns that the status guard has to come with it (D2117).
describe('tenant status guard', () => {
  it('no catalogue key projects onto a stock Vendure permission while status checks run only on tenant-scoped handlers (TEN-3)', () => {
    // Arrange
    const keys = PERMISSION_CATALOG.map((entry) => entry.key);

    // Act
    const granted = enginePermissionsFor(keys);
    const stock = granted.filter((name) => STOCK_PERMISSIONS.has(name));

    // Assert: the positive control shows the projection ran over the whole catalogue
    expect(granted.length).toBeGreaterThanOrEqual(keys.length);
    expect(stock, HOW_TO_FIX).toEqual([]);
  });

  // The Owner role is not projected from catalogue keys: tenancy and rbac grant it ownerRolePermissions directly
  // (the channel provisioner, the RBAC converge and the binding projector), so the gate above cannot see it.
  it.each(SERVER_ROLES)(
    'the Owner role carries no stock Vendure permission besides the engine base for the %s role (TEN-3)',
    async (role: ServerRole) => {
      // Act
      const { owner, custom } = await ownerPermissionsOf(role);
      const stock = owner.filter((name) => STOCK_PERMISSIONS.has(name));

      // Assert: the positive control shows the plugins' configuration functions ran and the Owner holds some
      expect(custom).toBeGreaterThan(PERMISSION_CATALOG.length);
      expect(owner.length).toBeGreaterThan(0);
      expect(stock, OWNER_HOW_TO_FIX).toEqual([]);
    },
  );
});
