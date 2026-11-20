/**
 * The registry of every catalog-import handler: its operation or route, permission, a call aimed at a target's ids,
 * and what another business gets back. The coverage test, the isolation sweep and the permission suite read it.
 * Empty until the first endpoint (Task 7); each later task appends its handlers here.
 */
import type { PermissionKey } from '@cod/shared';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  /** An import job of the business's first store. */
  readonly importId: string;
  /** An export job of the business's first store. */
  readonly exportId: string;
}

/** `null` (a read of none) or `not-found` (the entry's not-found code, 404 over REST). */
export type ForeignOutcome = 'null' | 'not-found';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  readonly notFound: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly route: string;
  readonly access: PermissionKey;
  readonly notFound: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
