/** The shapes of the catalog-import endpoint registry: what a call names and what another business gets back. */
import type { PermissionKey } from '@cod/shared';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  /** An import job of the business's first store. */
  readonly importId: string;
  /** An export job of the business's first store. */
  readonly exportId: string;
  /** A product of the business's first store. */
  readonly productId: string;
  /** A link import job of the business's first store (D2214). */
  readonly linkImportId: string;
}

/**
 * `null` (a read of none), `not-found` (the entry's not-found code, 404 over REST), `reported` (the call succeeds
 * and reports each named product with the entry's not-found code, D2213) or `own-only` (the call succeeds about the
 * caller's own store only: another business's product is in no answer or file, D2258).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'reported' | 'own-only';

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
  readonly foreign: Exclude<ForeignOutcome, 'null'>;
  readonly notFound: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}
