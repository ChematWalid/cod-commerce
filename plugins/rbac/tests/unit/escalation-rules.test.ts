import { type PermissionKey, RBAC_ERROR_CODES as CODES, type StoreId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  assertCanChangeTarget,
  assertCanCreateRole,
  assertCanEditRole,
  assertCanGrantAccess,
  assertNotEditingHeldRole,
  assertNotSelf,
  assertOwnerChangeAllowed,
  assertOwnerKept,
} from '../../domain/escalation-rules';
import type { Actor } from '../../domain/store-access';

const A1 = toStoreId('11');
const A2 = toStoreId('12');
const VIEW: PermissionKey = 'orders.view';
const CANCEL: PermissionKey = 'orders.cancel';

const actor = (
  stores: ReadonlyMap<StoreId, readonly PermissionKey[]>,
  flags: Partial<Pick<Actor, 'hasAllAccess' | 'isOwnerHolder'>> = {},
): Actor => ({
  administratorId: 1,
  isOwnerHolder: false,
  hasAllAccess: false,
  ...flags,
  permissionsByStore: new Map([...stores].map(([store, keys]) => [store, new Set(keys)])),
});

const bothHeld = new Map([
  [A1, [VIEW, CANCEL]],
  [A2, [VIEW, CANCEL]],
]);
const a1Only = new Map([[A1, [VIEW, CANCEL]]]);
const a2Thin = new Map([
  [A1, [VIEW, CANCEL]],
  [A2, [VIEW]],
]);

const expectCode = (act: () => void, code: string | undefined): void => {
  if (code === undefined) {
    expect(act).not.toThrow();
    return;
  }
  expect(act).toThrow(expect.objectContaining({ code }) as Error);
};

describe('D60 escalation rules', () => {
  describe('1. a new role', () => {
    it.each([
      ['a subset of the active store', a1Only, [VIEW], undefined],
      ['all it holds', a1Only, [VIEW, CANCEL], undefined],
      ['a permission it lacks on the active store', a2Thin, ['orders.delete'], CODES.PRIVILEGE_EXCEEDED],
    ] as const)('%s', (_name, stores, permissions, code) => {
      expectCode(() => {
        assertCanCreateRole(actor(stores), A1, permissions);
      }, code);
    });

    it('is judged on the active store, not another', () => {
      expectCode(() => {
        assertCanCreateRole(actor(a2Thin), A2, [CANCEL]);
      }, CODES.PRIVILEGE_EXCEEDED);
    });
  });

  describe('2. editing a role', () => {
    const edit =
      (stores: typeof bothHeld, reach: readonly StoreId[], allAccess = false) =>
      () => {
        assertCanEditRole(actor(stores, { hasAllAccess: allAccess }), {
          reach,
          activeStoreId: A1,
          current: [VIEW],
          next: [VIEW, CANCEL],
        });
      };

    it.each([
      ['every bound store in reach, permissions on each', bothHeld, [A1, A2], false, undefined],
      ['all access with the permissions', bothHeld, [A1, A2], true, undefined],
      ['a bound store out of reach', a1Only, [A1, A2], false, CODES.PRIVILEGE_EXCEEDED],
      ['two stores, new permission missing on the second', a2Thin, [A1, A2], false, CODES.PRIVILEGE_EXCEEDED],
      ['all access without the permission on one store', a2Thin, [A1, A2], true, CODES.PRIVILEGE_EXCEEDED],
    ] as const)('%s', (...[, stores, reach, allAccess, code]) => {
      expectCode(edit(stores, reach, allAccess), code);
    });

    it('needs the current permissions too, on each store', () => {
      expectCode(() => {
        assertCanEditRole(actor(a2Thin), { reach: [A1, A2], activeStoreId: A1, current: [CANCEL], next: [VIEW] });
      }, CODES.PRIVILEGE_EXCEEDED);
    });

    it('judges an unbound role on the active store', () => {
      expectCode(() => {
        assertCanEditRole(actor(a2Thin), { reach: [], activeStoreId: A2, current: [VIEW], next: [CANCEL] });
      }, CODES.PRIVILEGE_EXCEEDED);
    });
  });

  describe('3. granting access', () => {
    const grant = (permissions: readonly PermissionKey[], storeId: StoreId) => ({ storeId, permissions });

    it.each([
      ['a held role on a held store', a1Only, false, false, [grant([VIEW], A1)], undefined],
      ['nothing changed', a1Only, false, false, [], undefined],
      ['a store the actor lacks', a1Only, false, false, [grant([VIEW], A2)], CODES.STORE_NOT_ACCESSIBLE],
      ['a permission the actor lacks there', a2Thin, false, false, [grant([CANCEL], A2)], CODES.PRIVILEGE_EXCEEDED],
      ['all stores by a selected actor', bothHeld, false, true, [grant([VIEW], A1)], CODES.STORE_NOT_ACCESSIBLE],
      ['all stores by an all-access actor', bothHeld, true, true, [grant([VIEW], A1)], undefined],
    ] as const)('%s', (...[, stores, hasAllAccess, wantsAllStores, grants, code]) => {
      expectCode(() => {
        assertCanGrantAccess(actor(stores, { hasAllAccess }), { wantsAllStores, grants });
      }, code);
    });
  });

  describe('4. changing a target', () => {
    it.each([
      ['target within the actor', a1Only, false, a1Only, false, undefined],
      ['target on a store the actor lacks', a1Only, false, bothHeld, false, CODES.PRIVILEGE_EXCEEDED],
      ['target holds more on a shared store', a2Thin, false, bothHeld, false, CODES.PRIVILEGE_EXCEEDED],
      ['all-stores target, selected actor covering today', bothHeld, false, bothHeld, true, CODES.PRIVILEGE_EXCEEDED],
      ['all-stores target, all-stores actor', bothHeld, true, bothHeld, true, undefined],
      ['target with no access', a1Only, false, new Map<StoreId, PermissionKey[]>(), false, undefined],
    ] as const)('%s', (...[, actorStores, actorAll, targetStores, targetAll, code]) => {
      expectCode(() => {
        assertCanChangeTarget(
          actor(actorStores, { hasAllAccess: actorAll }),
          actor(targetStores, { hasAllAccess: targetAll }),
        );
      }, code);
    });
  });

  describe('5. self-assignment', () => {
    it.each([
      [1, 2, undefined],
      [1, 1, CODES.SELF_ASSIGNMENT],
    ] as const)('actor %d, target %d', (actorId, targetId, code) => {
      expectCode(() => {
        assertNotSelf(actorId, targetId);
      }, code);
    });
  });

  describe('6. editing a role one holds', () => {
    it.each([
      ['non-owner, role not held', false, false, undefined],
      ['owner, role held', true, true, undefined],
      ['non-owner, role held', false, true, CODES.SELF_HELD_ROLE],
    ] as const)('%s', (_name, isOwnerHolder, holdsRole, code) => {
      expectCode(() => {
        assertNotEditingHeldRole(actor(a1Only, { isOwnerHolder }), holdsRole);
      }, code);
    });
  });

  describe('7. granting or removing Owner', () => {
    it.each([
      ['non-owner, Owner untouched', false, false, undefined],
      ['owner, Owner touched', true, true, undefined],
      ['non-owner, Owner touched', false, true, CODES.OWNER_RESTRICTED],
    ] as const)('%s', (_name, isOwnerHolder, touchesOwner, code) => {
      expectCode(() => {
        assertOwnerChangeAllowed(actor(a1Only, { isOwnerHolder }), touchesOwner);
      }, code);
    });
  });

  describe('8. keeping an owner', () => {
    const base = { isBusinessOwner: false, heldOwner: true, keepsOwnerOnAllStores: false, otherAllAccessHolders: 1 };

    it.each([
      ['a holder leaves while another remains', base, undefined],
      ['a non-holder is changed', { ...base, heldOwner: false, otherAllAccessHolders: 0 }, undefined],
      [
        'the owner keeps Owner on all stores',
        { ...base, isBusinessOwner: true, keepsOwnerOnAllStores: true },
        undefined,
      ],
      ['the owner loses Owner', { ...base, isBusinessOwner: true }, CODES.LAST_OWNER],
      ['the last holder leaves', { ...base, otherAllAccessHolders: 0 }, CODES.LAST_OWNER],
    ] as const)('%s', (_name, facts, code) => {
      expectCode(() => {
        assertOwnerKept(facts);
      }, code);
    });
  });
});
