import type { PermissionKey } from '@cod/shared';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  readonly productId: string;
  readonly variantId: string;
  readonly collectionId: string;
}

/**
 * What another business's caller gets when it names the target's ids: `null` (a read of none), `not-found` (the
 * catalog's not-found code or 404), or `own-only` (an answer about its own store only).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'own-only';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** Whether the call names one id that a malformed id can replace. */
  readonly byId: boolean;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
