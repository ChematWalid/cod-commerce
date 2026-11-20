import type { PermissionKey } from '@cod/shared';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  readonly offerId: string;
  /** A code of {@link offerId}. */
  readonly code: string;
  readonly productId: string;
  readonly variantId: string;
}

/** The id of {@link TargetIds} an entry names: the one a malformed id replaces and an own-only answer must not hold. */
export type TargetIdField = keyof TargetIds;

/**
 * What another business's caller gets when it names the target's ids:
 * - `null`: a read of none;
 * - `not-found`: `offers.offer-not-found` (REST 404);
 * - `own-only`: a successful answer about its own store only, never holding the target's id;
 * - `no-read`: a successful answer computed from the input alone, reading no row (app types, preview, D2516);
 * - `dangling`: a successful create in the caller's store that keeps the target's variant id as a plain reference,
 *   never checked against the target's store and never reading its row (D2536).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'own-only' | 'no-read' | 'dangling';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** Whether the call names one id that a malformed id can replace. */
  readonly byId: boolean;
  /** The id the entry is about; `offerId` when absent. */
  readonly idField?: TargetIdField;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** The id the entry is about; `offerId` when absent. */
  readonly idField?: TargetIdField;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;

/** The id an entry is about. */
export const idFieldOf = (entry: { readonly idField?: TargetIdField }): TargetIdField => entry.idField ?? 'offerId';

/** A quantity draft activated by codes on the target's variant: what a create or a preview sends. */
export const offerNaming = (ids: TargetIds): Readonly<Record<string, unknown>> => ({
  kind: 'quantity',
  method: 'codes',
  title: 'Synthetic offer',
  config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] },
  targets: [{ refType: 'variant', refId: ids.variantId }],
});
