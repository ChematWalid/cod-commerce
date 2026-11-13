import { type IsolationCase, ownerGraphql, victimChannel } from '../matrix';
import type { BusinessWorld } from '../world';

const CREATE_STORE = 'mutation ($input: CreateStoreInput!) { createStore(input: $input) { id subdomain } }';
const UPDATE_STORE =
  'mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id name } }';
const CHANGE_SUBDOMAIN =
  'mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id subdomain } }';
const PROVISION =
  'mutation ($input: ProvisionBusinessInput!) { provisionBusiness(input: $input) { business { id } store { id } } }';

/**
 * A subdomain no store holds, unique to the run (the world's subdomains carry its suffix) and inside the 30
 * characters the classifier allows, so a refusal is the one the case is about and not a format or taken error.
 */
const freeSubdomain = (attacker: BusinessWorld, tag: string): string => `${attacker.stores[0].subdomain}-${tag}`;

/** A valid `CreateStoreInput` on a free subdomain. */
const newStore = (attacker: BusinessWorld, tag: string) => ({
  name: `Intruder store ${attacker.label}`,
  subdomain: freeSubdomain(attacker, tag),
  language: 'ar',
});

/** Writes to business and stores (plugins/tenancy) that name the victim's values or carry the victim's store token. */
export const TENANCY_WRITE_CASES: readonly IsolationCase[] = [
  {
    id: 'store.create-taken-subdomain',
    entity: 'store',
    endpoint: 'createStore(input.subdomain)',
    access: 'write',
    title: "A's owner opens a store on B1's subdomain: tenancy.subdomain-taken, B1 keeps it",
    request: (a, b) =>
      ownerGraphql(a, CREATE_STORE, { input: { ...newStore(a, 'taken'), subdomain: b.stores[0].subdomain } }),
    expect: { kind: 'code', code: 'tenancy.subdomain-taken' },
  },
  {
    id: 'store.create-with-victim-logo',
    entity: 'logo asset',
    endpoint: 'createStore(input.logoAssetId)',
    access: 'write',
    title: "A's owner opens a store with B's logo asset: tenancy.asset-not-available, no store opened",
    request: (a, b) => ownerGraphql(a, CREATE_STORE, { input: { ...newStore(a, 'logo'), logoAssetId: b.logoAssetId } }),
    expect: { kind: 'code', code: 'tenancy.asset-not-available' },
  },
  {
    id: 'store.create-victim-channel',
    entity: 'store',
    endpoint: 'createStore',
    access: 'victim channel',
    title: "A's owner opens a store with B's store token: FORBIDDEN, no store opened for B",
    request: (a, b) => ownerGraphql(a, CREATE_STORE, { input: newStore(a, 'chan') }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.change-subdomain-taken',
    entity: 'store',
    endpoint: 'changeStoreSubdomain(subdomain)',
    access: 'write',
    title: "A's owner moves A2 onto B2's subdomain: tenancy.subdomain-taken, B2 keeps it",
    request: (a, b) => ownerGraphql(a, CHANGE_SUBDOMAIN, { id: a.stores[1].id, subdomain: b.stores[1].subdomain }),
    expect: { kind: 'code', code: 'tenancy.subdomain-taken' },
  },
  {
    id: 'business.update-victim-channel',
    entity: 'business',
    endpoint: 'updateBusiness',
    access: 'victim channel',
    title: "A's owner renames the business with B's store token: FORBIDDEN, B's business unchanged",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id name } }',
        { input: { name: 'Taken over' } },
        victimChannel(b),
      ),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.update-victim-channel',
    entity: 'store',
    endpoint: 'updateStore(id)',
    access: 'victim channel',
    title: "A's owner renames A1 with B's store token: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(a, UPDATE_STORE, { id: a.stores[0].id, input: { name: 'Renamed via B' } }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.archive-victim-channel',
    entity: 'store',
    endpoint: 'archiveStore(id)',
    access: 'victim channel',
    title: "A's owner archives B2 with B's store token: FORBIDDEN, B2 still active",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($id: String!) { archiveStore(id: $id) { id } }',
        { id: b.stores[1].id },
        victimChannel(b),
      ),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'business.provision',
    entity: 'business',
    endpoint: 'provisionBusiness',
    access: 'write',
    title: "A's owner provisions a business, a platform-only operation: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, PROVISION, {
        input: {
          name: `Intruder business ${a.label}`,
          owner: {
            emailAddress: `intruder-owner-${freeSubdomain(a, 'prov')}@example.test`,
            firstName: 'Intruder',
            lastName: a.label,
            password: 'intruder-password',
          },
          store: newStore(a, 'prov'),
        },
      }),
    expect: { kind: 'forbidden' },
  },
];
