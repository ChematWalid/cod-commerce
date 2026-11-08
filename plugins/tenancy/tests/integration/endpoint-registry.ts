import type { GraphQlDocument, StoreFixture, TwoBusinesses } from '@cod/testing';
import { TenancyPlugin } from '../../tenancy.plugin';
import {
  ACTIVE_BUSINESS,
  ARCHIVE_STORE,
  BUSINESS,
  CHANGE_STORE_SUBDOMAIN,
  CREATE_STORE,
  PROVISION_BUSINESS,
  STORE,
  STORES,
  SUBDOMAIN_AVAILABILITY,
  UPDATE_BUSINESS,
  UPDATE_STORE,
} from './admin-api-operations';

/** What one registry case attacks: B's store `victim`, as a caller from business A. */
export interface Probe extends TwoBusinesses {
  readonly victim: StoreFixture;
}

/** What A's call must come to; it is never B's data. */
export type IsolationOutcome =
  | { readonly kind: 'null' }
  | { readonly kind: 'rejected'; readonly code: string }
  | { readonly kind: 'callerOwned'; readonly businessIdsOf: (value: unknown) => readonly string[] }
  | { readonly kind: 'sameForEveryCaller' };

/** One Admin API operation and its call from A against B. */
export interface AdminApiEntry {
  readonly operation: string;
  readonly document: GraphQlDocument;
  readonly variables: (probe: Probe) => Record<string, unknown>;
  readonly outcome: IsolationOutcome;
}

/** A public REST route. Its answer is exact, and must not depend on who asks. */
export interface RestRouteEntry {
  /** The route as the controller declares it. */
  readonly route: string;
  readonly url: (probe: Probe) => string;
  readonly body: (probe: Probe) => unknown;
}

const STORE_NOT_FOUND = 'tenancy.store-not-found';
const SUBDOMAIN_TAKEN = 'tenancy.subdomain-taken';
const PLATFORM_DOMAIN = 'localhost';
const FORBIDDEN = 'FORBIDDEN';
const TAKEN_MESSAGE = 'This subdomain is already taken';
const OWNER_INPUT = { emailAddress: 'intruder@example.test', firstName: 'A', lastName: 'B', password: 'synthetic' };

const businessIdOfRow = (value: unknown): string => (value as { businessId: string }).businessId;
const idOfRow = (value: unknown): string => (value as { id: string }).id;
const hostOf = (store: StoreFixture): string => `${store.subdomain}.${PLATFORM_DOMAIN}`;

const storeNotFound: IsolationOutcome = { kind: 'rejected', code: STORE_NOT_FOUND };

/** Every Admin API operation of the plugin; `two-business.isolation` fails on one without an entry. */
export const ADMIN_API_REGISTRY: readonly AdminApiEntry[] = [
  {
    operation: 'activeBusiness',
    document: ACTIVE_BUSINESS,
    variables: () => ({}),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => [idOfRow(value)] },
  },
  { operation: 'business', document: BUSINESS, variables: ({ b }) => ({ id: b.businessId }), outcome: { kind: 'null' } },
  {
    operation: 'stores',
    document: STORES,
    variables: () => ({}),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => (value as unknown[]).map(businessIdOfRow) },
  },
  { operation: 'store', document: STORE, variables: ({ victim }) => ({ id: victim.id }), outcome: { kind: 'null' } },
  {
    operation: 'subdomainAvailability',
    document: SUBDOMAIN_AVAILABILITY,
    variables: ({ victim }) => ({ subdomain: victim.subdomain }),
    outcome: { kind: 'sameForEveryCaller' },
  },
  {
    operation: 'provisionBusiness',
    document: PROVISION_BUSINESS,
    variables: ({ victim }) => ({
      input: {
        name: 'Intruder',
        owner: OWNER_INPUT,
        store: { name: 'Intruder', subdomain: `x${victim.subdomain}`, language: 'ar' },
      },
    }),
    outcome: { kind: 'rejected', code: FORBIDDEN },
  },
  {
    operation: 'updateBusiness',
    document: UPDATE_BUSINESS,
    variables: () => ({ input: { name: 'A renamed' } }),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => [idOfRow(value)] },
  },
  {
    operation: 'createStore',
    document: CREATE_STORE,
    variables: ({ victim }) => ({ input: { name: 'Taken', subdomain: victim.subdomain, language: 'ar' } }),
    outcome: { kind: 'rejected', code: SUBDOMAIN_TAKEN },
  },
  {
    operation: 'updateStore',
    document: UPDATE_STORE,
    variables: ({ victim }) => ({ id: victim.id, input: { name: 'Hijacked' } }),
    outcome: storeNotFound,
  },
  {
    operation: 'archiveStore',
    document: ARCHIVE_STORE,
    variables: ({ victim }) => ({ id: victim.id }),
    outcome: storeNotFound,
  },
  {
    operation: 'changeStoreSubdomain',
    document: CHANGE_STORE_SUBDOMAIN,
    variables: ({ victim }) => ({ id: victim.id, subdomain: `moved-${victim.subdomain}` }),
    outcome: storeNotFound,
  },
];

function publicFieldsOf({ b, victim }: Probe): unknown {
  return {
    storeId: victim.id,
    businessId: b.businessId,
    language: 'ar',
    name: `${victim === b.stores[0] ? 'b1' : 'b2'} store`,
    logo: null,
    primaryHost: hostOf(victim),
    status: 'active',
  };
}

/** Every REST route of the plugin; `two-business.isolation` fails on one without an entry. */
export const REST_ROUTE_REGISTRY: readonly RestRouteEntry[] = [
  {
    route: '/stores/subdomain-availability',
    url: ({ victim }) => `/stores/subdomain-availability?subdomain=${victim.subdomain}`,
    body: ({ victim }) => ({ subdomain: victim.subdomain, status: 'taken', reason: TAKEN_MESSAGE }),
  },
  {
    route: '/store/resolve',
    url: ({ victim }) => `/store/resolve?host=${encodeURIComponent(hostOf(victim))}`,
    body: publicFieldsOf,
  },
  { route: '/store/by-id/:storeId', url: ({ victim }) => `/store/by-id/${victim.id}`, body: publicFieldsOf },
];

type Controller = abstract new (...args: never[]) => object;

/** Every route the plugin's controllers declare, as `/<controller>/<method path>`. */
export function declaredRoutes(): string[] {
  const controllers = Reflect.getMetadata('controllers', TenancyPlugin) as Controller[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    const handlers = Object.getOwnPropertyNames(controller.prototype as object)
      .filter((name) => name !== 'constructor')
      .map((name) => (controller.prototype as Record<string, object>)[name] as object);
    return handlers.flatMap((handler) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      return path === undefined ? [] : [`/${base}/${path}`];
    });
  });
}
