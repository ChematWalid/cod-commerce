import { MAX_OPEN_ORDERS_LIMIT, type Snowflake, type StoreAccessKind } from '@cod/shared';
import { InvalidInputError, OwnerProtectedError } from './errors';
import type { MemberActivityField } from './member-activity';
import type { MemberGrant } from './member-grant';
import type { TeamMember } from './team-member';

/** What "edit a member" may change; every field is optional, at least one is given (brief step 4). */
export interface MemberEdit {
  readonly roleIds?: readonly Snowflake[];
  readonly storeAccess?: StoreAccessKind;
  readonly storeIds?: readonly Snowflake[];
  readonly baseSalary?: number;
  readonly commissionConfigIds?: readonly Snowflake[];
}

/**
 * Refuses an action the business owner is protected from: deactivate, remove, or a change of its roles and stores
 * (D204). Checked before rbac is asked anything.
 *
 * @throws {OwnerProtectedError} when the member is the business owner.
 */
export function assertNotOwner(member: Pick<TeamMember, 'administratorId'>, ownerAdministratorId: number | null): void {
  if (member.administratorId !== null && member.administratorId === ownerAdministratorId) {
    throw new OwnerProtectedError();
  }
}

/**
 * The most open orders a member may hold: a whole number from 1 to {@link MAX_OPEN_ORDERS_LIMIT}, or `null` for no
 * limit.
 *
 * @throws {InvalidInputError} for zero, a negative, a fraction or a value above the cap.
 */
export function assertMaxOpenOrders(maxOpenOrders: number | null): void {
  if (maxOpenOrders === null) return;
  if (!Number.isInteger(maxOpenOrders) || maxOpenOrders < 1 || maxOpenOrders > MAX_OPEN_ORDERS_LIMIT) {
    throw new InvalidInputError();
  }
}

/**
 * The grant that withdraws every role of a member holding `held` (D204). rbac reads a store access even with no role:
 * an all-store actor names all stores, a store-limited one the member's own stores, which it reaches (D211).
 */
export function clearingGrantOf(held: MemberGrant, actorAllStores: boolean): MemberGrant {
  if (actorAllStores) return { roleIds: [], storeAccess: 'all', storeIds: [] };
  return { roleIds: [], storeAccess: held.storeAccess, storeIds: held.storeIds };
}

/** Whether an edit changes roles or stores, which rbac holds (D204). */
export function touchesAccess(edit: MemberEdit): boolean {
  return edit.roleIds !== undefined || edit.storeAccess !== undefined || edit.storeIds !== undefined;
}

/** Whether an edit changes what the member is paid, which nobody may do to their own row (D212). */
export function touchesPay(edit: MemberEdit): boolean {
  return edit.baseSalary !== undefined || edit.commissionConfigIds !== undefined;
}

/** The grant after an edit: what the edit names replaces what the member holds; `all` lists no store. */
export function editedGrantOf(held: MemberGrant, edit: MemberEdit): MemberGrant {
  const storeAccess = edit.storeAccess ?? held.storeAccess;
  return {
    roleIds: edit.roleIds ?? held.roleIds,
    storeAccess,
    storeIds: storeAccess === 'all' ? [] : (edit.storeIds ?? held.storeIds),
  };
}

/** The fields an edit names, as its activity row lists them, never with their values (D216). */
export function changedFieldsOf(edit: MemberEdit): MemberActivityField[] {
  const named: [MemberActivityField, unknown][] = [
    ['roles', edit.roleIds],
    ['storeAccess', edit.storeAccess],
    ['storeIds', edit.storeIds],
    ['baseSalary', edit.baseSalary],
    ['commissionConfigIds', edit.commissionConfigIds],
  ];
  return named.filter(([, value]) => value !== undefined).map(([field]) => field);
}
