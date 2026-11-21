import type { PermissionKey } from '@cod/shared';

/** The ids of one store a call names; the isolation sweep fills them with B's (or A2's) and calls as A. */
export interface TargetIds {
  readonly collectionId: string;
  readonly productId: string;
}

/** The id of {@link TargetIds} an entry names: the one a malformed id replaces and an own-only answer must not hold. */
export type TargetIdField = keyof TargetIds;

/**
 * What another store's caller gets when it names the target's ids: `null` (a read of none), `not-found`
 * (`collections.not-found`, 404 on REST), `product-not-found` (`collections.product-not-found`, 404 on REST), or
 * `own-only` (an answer about its own store only).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'product-not-found' | 'own-only';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** Whether the call names one id that a malformed id can replace. */
  readonly byId: boolean;
  /** The id the entry is about; `collectionId` when absent. */
  readonly idField?: TargetIdField;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** Whether the route names one id that a malformed id can replace. */
  readonly byId: boolean;
  /** The id the entry is about; `collectionId` when absent. */
  readonly idField?: TargetIdField;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
