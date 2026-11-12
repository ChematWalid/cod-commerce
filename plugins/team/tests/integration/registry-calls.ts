import type { PermissionKey } from '@cod/shared';

/**
 * What a handler demands: one catalog permission, or nobody (the two invitation routes the invitee calls with a
 * token, D205).
 */
export type Access = 'public' | PermissionKey;

/** The ids of one business a call names; the isolation sweep fills them with business A's and calls as B. */
export interface TargetIds {
  /** An active member. */
  readonly memberId: string;
  /** A member whose invitation is pending. */
  readonly invitedMemberId: string;
  readonly commissionId: string;
  readonly roleId: string;
  readonly storeId: string;
  /** A fresh address for an invite. */
  readonly email: string;
}

/**
 * What another business's caller gets when it names the target's ids: `not-found` (404, Team's not-found code),
 * `refused` (a 4xx refusal of the input, never a permission one), `own-only` (an answer about its own business only)
 * or `token-bound` (public: only the token decides, and an unknown one opens nothing).
 */
export type ForeignOutcome = 'not-found' | 'refused' | 'own-only' | 'token-bound';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: Access;
  readonly foreign: ForeignOutcome;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The route as the controllers declare it. */
  readonly route: string;
  readonly access: Access;
  readonly foreign: ForeignOutcome;
  /** The route with its parameters filled. */
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

type Call = Readonly<Record<string, unknown>>;

export const IDEMPOTENCY_KEY = 'synthetic-key';
/** A token no invitation holds. */
export const UNKNOWN_TOKEN = 'synthetic-token';
export const NO_IDS = (): Call => ({});
/** An invite naming the target's role, store and commission. */
export const inviteInput = (ids: TargetIds): Call => ({
  email: ids.email,
  roleIds: [ids.roleId],
  storeAccess: 'selected',
  storeIds: [ids.storeId],
  baseSalary: 0,
  commissionConfigIds: [ids.commissionId],
});
/** A commission scoped to the target's store. */
export const commissionInput = (ids: TargetIds): Call => ({
  name: 'Synthetic commission',
  basis: 'per-confirmed-order',
  valueKind: 'fixed',
  value: 1,
  scope: 'selected',
  storeIds: [ids.storeId],
});
export const member = (ids: TargetIds): Call => ({ id: ids.memberId });
export const commission = (ids: TargetIds): Call => ({ id: ids.commissionId });

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
