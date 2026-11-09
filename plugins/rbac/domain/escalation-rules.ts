import type { PermissionKey, StoreId } from '@cod/shared';
import {
  LastOwnerError,
  OwnerRestrictedError,
  PrivilegeExceededError,
  SelfAssignmentError,
  SelfHeldRoleError,
  StoreNotAccessibleError,
} from './errors';
import type { Actor } from './store-access';

const holdsAll = (actor: Actor, storeId: StoreId, permissions: readonly PermissionKey[]): boolean => {
  const held = actor.permissionsByStore.get(storeId);
  return held !== undefined && permissions.every((key) => held.has(key));
};

/**
 * D60.1: a new or duplicated role has no bindings, so its permissions must be held on the active store.
 *
 * @throws {@link PrivilegeExceededError}
 */
export function assertCanCreateRole(actor: Actor, activeStoreId: StoreId, permissions: readonly PermissionKey[]): void {
  if (!holdsAll(actor, activeStoreId, permissions)) throw new PrivilegeExceededError();
}

/** A role being edited or deleted. `next` equals `current` for a delete. */
export interface RoleEdit {
  /** Every store the role is bound to; an `all` binding reaches every store of the business. */
  readonly reach: readonly StoreId[];
  /** The role has an `all` binding, so its keys also reach stores opened later. */
  readonly allStoresBound: boolean;
  readonly activeStoreId: StoreId;
  readonly current: readonly PermissionKey[];
  readonly next: readonly PermissionKey[];
}

/**
 * D60.2: the actor reaches every store the role is bound to, and holds its current and new permissions on each.
 * A role with an `all` binding needs an all-stores actor. A role with no bindings is judged on the active store,
 * like a new one.
 *
 * @throws {@link PrivilegeExceededError}
 */
export function assertCanEditRole(actor: Actor, edit: RoleEdit): void {
  const { reach, allStoresBound, activeStoreId, current, next } = edit;
  if (allStoresBound && !actor.hasAllAccess) throw new PrivilegeExceededError();
  const stores = reach.length === 0 ? [activeStoreId] : reach;
  const needed = [...current, ...next];
  if (!stores.every((storeId) => holdsAll(actor, storeId, needed))) throw new PrivilegeExceededError();
}

/** The access a change adds or removes: for each store, the permissions of the role concerned. */
export interface AccessGrant {
  readonly wantsAllStores: boolean;
  readonly grants: readonly { readonly storeId: StoreId; readonly permissions: readonly PermissionKey[] }[];
}

/**
 * D60.3: on each store the actor holds every permission of every role added or removed, and "all stores" needs the
 * actor to have all-stores access, since it also covers stores opened later.
 *
 * @throws {@link StoreNotAccessibleError} when the actor lacks the store, or asks for all stores without having them
 * @throws {@link PrivilegeExceededError} when the actor lacks a permission on a store it has
 */
export function assertCanGrantAccess(actor: Actor, { wantsAllStores, grants }: AccessGrant): void {
  if (wantsAllStores && !actor.hasAllAccess) throw new StoreNotAccessibleError();
  for (const { storeId, permissions } of grants) {
    if (!actor.permissionsByStore.has(storeId)) throw new StoreNotAccessibleError();
    if (!holdsAll(actor, storeId, permissions)) throw new PrivilegeExceededError();
  }
}

/**
 * D60.4: on every store the target can access, the actor has access and holds the target's permissions. An
 * all-stores target also reaches stores opened later, so it needs an all-stores actor.
 *
 * @throws {@link PrivilegeExceededError}
 */
export function assertCanChangeTarget(actor: Actor, target: Actor): void {
  if (target.hasAllAccess && !actor.hasAllAccess) throw new PrivilegeExceededError();
  for (const [storeId, permissions] of target.permissionsByStore) {
    if (!holdsAll(actor, storeId, [...permissions])) throw new PrivilegeExceededError();
  }
}

/**
 * D60.5: nobody changes their own assignment.
 *
 * @throws {@link SelfAssignmentError}
 */
export function assertNotSelf(actorAdministratorId: number, targetAdministratorId: number): void {
  if (actorAdministratorId === targetAdministratorId) throw new SelfAssignmentError();
}

/**
 * D60.6: a non-owner cannot edit a role they hold.
 *
 * @throws {@link SelfHeldRoleError}
 */
export function assertNotEditingHeldRole(actor: Actor, holdsRole: boolean): void {
  if (holdsRole && !actor.isOwnerHolder) throw new SelfHeldRoleError();
}

/**
 * D60.7: only an Owner holder grants, removes or re-scopes Owner.
 *
 * @throws {@link OwnerRestrictedError}
 */
export function assertOwnerChangeAllowed(actor: Actor, touchesOwner: boolean): void {
  if (touchesOwner && !actor.isOwnerHolder) throw new OwnerRestrictedError();
}

/** What the change does to the target's Owner role. */
export interface OwnerFacts {
  readonly isBusinessOwner: boolean;
  readonly heldOwner: boolean;
  readonly keepsOwnerOnAllStores: boolean;
  readonly otherAllAccessHolders: number;
}

/**
 * D60.8: the business's owner keeps Owner on all stores, and a holder may leave only if another all-stores holder
 * remains. Only an all-stores holder counts: anyone less cannot run the whole business.
 *
 * @throws {@link LastOwnerError}
 */
export function assertOwnerKept(facts: OwnerFacts): void {
  if (facts.keepsOwnerOnAllStores) return;
  if (facts.isBusinessOwner) throw new LastOwnerError();
  if (facts.heldOwner && facts.otherAllAccessHolders === 0) throw new LastOwnerError();
}
