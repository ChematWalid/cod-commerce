import { type PermissionKey, type Snowflake, type StoreId, toSnowflake, toStoreId } from '@cod/shared';
import type { BusinessRole, MemberAssignment } from './business-role';
import type { MemberStoreAccess } from './constants';
import { StoreAccessInvalidError, StoreNotAccessibleError } from './errors';

/** A store of the business and its Vendure channel. */
export interface BusinessStore {
  readonly id: StoreId;
  readonly channelId: number;
  readonly status: 'active' | 'archived';
}

/** Who is acting, or being acted on, as our own rows say (D60); never read from the session. */
export interface Actor {
  readonly administratorId: number;
  readonly isOwnerHolder: boolean;
  readonly hasAllAccess: boolean;
  readonly permissionsByStore: ReadonlyMap<StoreId, ReadonlySet<PermissionKey>>;
}

/** Store access as a client asks for it. */
export interface RequestedStoreAccess {
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds: readonly string[];
}

/** Validated store access: the stores are active stores of the business. */
export interface ResolvedStoreAccess {
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds: readonly StoreId[];
}

/** The part of an assignment that says what it reaches. */
export type AssignmentReach = Pick<MemberAssignment, 'businessRoleId' | 'storeAccess' | 'storeIds'>;

/** One role on one store, gained or lost. */
export interface RoleOnStore {
  readonly businessRoleId: Snowflake;
  readonly storeId: StoreId;
}

/** The stores of a business that can grant anything: an archived store grants nothing (Review Focus 5). */
export function activeStoreIdsOf(stores: readonly BusinessStore[]): readonly StoreId[] {
  return stores.filter((store) => store.status === 'active').map((store) => store.id);
}

/**
 * Checks a client's store access against the stores of the business. A list sent with `all` is ignored.
 *
 * @throws {@link StoreAccessInvalidError} when `selected` names no store
 * @throws {@link StoreNotAccessibleError} when a named store is unknown to the business or archived
 */
export function resolveStoreAccess(
  request: RequestedStoreAccess,
  stores: readonly BusinessStore[],
): ResolvedStoreAccess {
  if (request.storeAccess === 'all') return { storeAccess: 'all', storeIds: [] };
  if (request.storeIds.length === 0) throw new StoreAccessInvalidError();
  const active = new Set<string>(activeStoreIdsOf(stores));
  if (!request.storeIds.every((id) => active.has(id))) throw new StoreNotAccessibleError();
  return { storeAccess: 'selected', storeIds: [...new Set(request.storeIds)].map(toStoreId) };
}

/** The active stores an assignment reaches. */
function storesReached(assignment: AssignmentReach, activeStoreIds: readonly StoreId[]): readonly StoreId[] {
  if (assignment.storeAccess === 'all') return activeStoreIds;
  const named = new Set<string>(assignment.storeIds);
  return activeStoreIds.filter((id) => named.has(id));
}

/** Fails closed on a mix of `all` and `selected` rows, which the API cannot produce (D54). */
export function holdsAllAccess(assignments: readonly Pick<AssignmentReach, 'storeAccess'>[]): boolean {
  return assignments.length > 0 && assignments.every((assignment) => assignment.storeAccess === 'all');
}

/** Builds an {@link Actor} from a member's rows; roles missing from `roles` grant nothing. */
export function buildActor(
  administratorId: number,
  assignments: readonly AssignmentReach[],
  roles: ReadonlyMap<string, BusinessRole>,
  activeStoreIds: readonly StoreId[],
): Actor {
  const permissionsByStore = new Map<StoreId, Set<PermissionKey>>();
  for (const assignment of assignments) {
    const permissions = roles.get(assignment.businessRoleId)?.permissions ?? [];
    for (const storeId of storesReached(assignment, activeStoreIds)) {
      const held = permissionsByStore.get(storeId) ?? new Set<PermissionKey>();
      permissions.forEach((key) => held.add(key));
      permissionsByStore.set(storeId, held);
    }
  }
  return {
    administratorId,
    isOwnerHolder: assignments.some((row) => roles.get(row.businessRoleId)?.builtInKey === 'owner'),
    hasAllAccess: holdsAllAccess(assignments),
    permissionsByStore,
  };
}

const pairsOf = (assignments: readonly AssignmentReach[], activeStoreIds: readonly StoreId[]): RoleOnStore[] =>
  assignments.flatMap((assignment) =>
    storesReached(assignment, activeStoreIds).map((storeId) => ({
      businessRoleId: assignment.businessRoleId,
      storeId,
    })),
  );

const keyOf = ({ businessRoleId, storeId }: RoleOnStore): string => `${businessRoleId}:${storeId}`;

/** Every role-on-store pair gained, then every pair lost, between two sets of assignments. */
export function accessChange(
  before: readonly AssignmentReach[],
  after: readonly AssignmentReach[],
  activeStoreIds: readonly StoreId[],
): readonly RoleOnStore[] {
  const old = pairsOf(before, activeStoreIds);
  const next = pairsOf(after, activeStoreIds);
  const oldKeys = new Set(old.map(keyOf));
  const nextKeys = new Set(next.map(keyOf));
  return [...next.filter((pair) => !oldKeys.has(keyOf(pair))), ...old.filter((pair) => !nextKeys.has(keyOf(pair)))];
}

const sameStores = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((id) => right.includes(id));

/** Whether a role is held the same way in both: same mode, same stores. */
export function sameReach(left: AssignmentReach | undefined, right: AssignmentReach | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.storeAccess === right.storeAccess && sameStores(left.storeIds, right.storeIds);
}

/** The assignment row's stored form of a store id. */
export const storeRowId = (id: StoreId): Snowflake => toSnowflake(id);
