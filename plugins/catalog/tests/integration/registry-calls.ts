import type { PermissionKey } from '@cod/shared';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  readonly productId: string;
  readonly variantId: string;
  readonly collectionId: string;
  readonly brandId: string;
  readonly tagId: string;
  readonly highlightId: string;
  readonly mediaId: string;
}

/** The id of {@link TargetIds} an entry names: the one a malformed id replaces and an own-only answer must not hold. */
export type TargetIdField = keyof TargetIds;

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
  /** Whether the call is a GraphQL multipart upload of one file at `variables.file`. */
  readonly upload?: boolean;
  /** The id the entry is about; `productId` when absent. */
  readonly idField?: TargetIdField;
  /** The not-found code a foreign id answers; the product's when absent. */
  readonly notFound?: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** The id the entry is about; `productId` when absent. */
  readonly idField?: TargetIdField;
  /** The not-found code a foreign id answers; the product's when absent. */
  readonly notFound?: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
