import type { MatrixRequest } from './http';
import type { BusinessWorld, World } from './world-types';

/** The P1 tenant data the matrix covers; each is a row of the evidence matrix. */
export type IsolationEntity =
  | 'business'
  | 'store'
  | 'role'
  | 'member'
  | 'activity log'
  | 'tenant secret'
  | 'flag override'
  | 'outbox and jobs'
  | 'inbound webhook'
  | 'account'
  | 'logo asset'
  | 'template note'
  | 'team member'
  | 'invitation'
  | 'commission'
  | 'salary payment'
  | 'stock Vendure data';

/** How the attacker reaches for the victim's data; each is a column of the evidence matrix. */
export type IsolationAccess =
  /** The victim's id in a by-id read. */
  | 'read by id'
  /** A list of the attacker's own business: it must hold none of the victim's rows. */
  | 'list'
  /** A write naming the victim's id; the victim's data must stay unchanged. */
  | 'write'
  /** The attacker's own session with the victim's store token. */
  | 'victim channel';

/** What the attacker must get back. */
export type Expectation =
  /** A GraphQL error with code FORBIDDEN, and no data for the operation. */
  | { readonly kind: 'forbidden' }
  /** GraphQL data whose `field` is null, with no error: "no such row" for the caller. */
  | { readonly kind: 'null'; readonly field: string }
  /** A GraphQL error with this code (the "not found" of a write). */
  | { readonly kind: 'code'; readonly code: string }
  /** A REST status, and optionally the body's `code`. */
  | { readonly kind: 'status'; readonly status: number; readonly code?: string }
  /**
   * A success that holds the attacker's own data (`mustInclude`, a positive control) and, like every answer, none
   * of the victim's.
   */
  | { readonly kind: 'own'; readonly mustInclude: (attacker: BusinessWorld) => readonly string[] };

/** One cell of the matrix: an endpoint, an entity, how the attacker reaches, and what must come back. */
export interface IsolationCase {
  /** Unique and stable: it names the transcript section. */
  readonly id: string;
  readonly entity: IsolationEntity;
  /** The operation or route as a reader knows it, e.g. `store(id)` or `GET /roles/:id`. */
  readonly endpoint: string;
  readonly access: IsolationAccess;
  /** What the case shows, in one sentence for the transcript. */
  readonly title: string;
  readonly request: (attacker: BusinessWorld, victim: BusinessWorld, world: World) => MatrixRequest;
  readonly expect: Expectation;
  /** Runs B against A too (the reverse direction sample). */
  readonly reverse?: boolean;
}

/** The attacker's session on its own first store. */
export const ownChannel = (attacker: BusinessWorld): NonNullable<MatrixRequest['channel']> => ({
  label: attacker.stores[0].label,
  token: attacker.stores[0].channelToken,
});

/** The attacker's session with the victim's first store token. */
export const victimChannel = (victim: BusinessWorld): NonNullable<MatrixRequest['channel']> => ({
  label: victim.stores[0].label,
  token: victim.stores[0].channelToken,
});

/** A GraphQL request of the attacker's owner on the attacker's own store. */
export function ownerGraphql(
  attacker: BusinessWorld,
  query: string,
  variables: Record<string, unknown> = {},
  channel = ownChannel(attacker),
): MatrixRequest {
  return { method: 'POST', path: '/admin-api', caller: attacker.owner, channel, body: { query, variables } };
}

/** A REST request of the attacker's owner on the attacker's own store. */
export function ownerRest(
  attacker: BusinessWorld,
  method: MatrixRequest['method'],
  path: string,
  body?: unknown,
): MatrixRequest {
  return { method, path, caller: attacker.owner, channel: ownChannel(attacker), body };
}

/** The same request sent with another store's token. */
export const onChannel = (request: MatrixRequest, channel: NonNullable<MatrixRequest['channel']>): MatrixRequest => ({
  ...request,
  channel,
});
