import { asOperationContext as asTenancyContext, type TenantLifecycleHook } from '@cod/plugin-tenancy';
import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import type { TeamConvergeService } from '../../application/converge-members.service';
import { TeamLifecycleHook } from '../../infrastructure/team-lifecycle.hook';

const ctx = asTenancyContext({});
const businessId = toBusinessId('101');

function setUp() {
  const adoptAdministrators = vi.fn(() => Promise.resolve({ created: 1, skipped: 0 }));
  const converge = { adoptAdministrators } as unknown as TeamConvergeService;
  const registrar = { register: vi.fn() };
  return { hook: new TeamLifecycleHook(registrar, converge), registrar, adoptAdministrators };
}

describe('TeamLifecycleHook', () => {
  it('registers itself with tenancy once the application boots', () => {
    // Arrange
    const { hook, registrar } = setUp();

    // Act
    hook.onApplicationBootstrap();

    // Assert
    expect(registrar.register).toHaveBeenCalledWith(hook);
  });

  it("adopts the business's owner as a member from the event alone, needing nothing from rbac", async () => {
    // Arrange
    const { hook, adoptAdministrators } = setUp();

    // Act
    await hook.businessProvisioned(ctx, { businessId, ownerRoleId: 3, ownerAdministratorId: 9 });

    // Assert
    expect(adoptAdministrators).toHaveBeenCalledWith(ctx, { businessId }, [9]);
  });

  it('does nothing when a store opens', async () => {
    // Arrange
    const { hook, adoptAdministrators } = setUp();
    const asRegistered: TenantLifecycleHook = hook;

    // Act
    await asRegistered.storeCreated(ctx, { businessId, storeId: toStoreId('11'), channelId: 4 });

    // Assert
    expect(adoptAdministrators).not.toHaveBeenCalled();
  });
});
