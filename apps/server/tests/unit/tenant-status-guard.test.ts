import { enginePermissionsFor } from '@cod/plugin-rbac';
import { PERMISSION_CATALOG } from '@cod/shared';
import { Permission } from '@vendure/core';
import { describe, expect, it } from 'vitest';

const STOCK_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(Permission));

const HOW_TO_FIX =
  'A catalogue key now carries a stock Vendure permission, so a merchant can reach stock handlers that are not ' +
  '@TenantScoped(): archive and suspension are not enforced there (TEN-3). Before keeping the grant, add the global ' +
  'tenant status guard (option A, an APP_GUARD) as the ADR 0002 addendum "tenant status on every handler (P2.S1)" ' +
  'requires, then widen this test.';

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
});
