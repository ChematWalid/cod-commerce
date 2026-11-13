import type { MatrixRequest } from '../http';
import { type IsolationCase, ownChannel, ownerGraphql, ownerRest, victimChannel, onChannel } from '../matrix';
import type { BusinessWorld } from '../world-types';

const PROFILE_FIELDS = 'firstName lastName emailAddress phone avatarUrl emailVerified';
const STATUS_FIELDS = 'emailVerified verificationRequired resendAvailableAt pendingEmail';
const NOTE_FIELDS = 'id title body createdAt';

/** A GraphQL request of the attacker's member (a business role on the first store only). */
function memberGraphql(
  attacker: BusinessWorld,
  query: string,
  variables: Record<string, unknown> = {},
  channel = ownChannel(attacker),
): MatrixRequest {
  return { method: 'POST', path: '/admin-api', caller: attacker.member, channel, body: { query, variables } };
}

/** The owner's account (plugins/auth), the store logo, the template notes (plugins/_template) and the member. */
export const ACCOUNT_CASES: readonly IsolationCase[] = [
  {
    id: 'account.profile',
    entity: 'account',
    endpoint: 'accountProfile',
    access: 'list',
    title: "A's owner reads the account profile: A's own",
    request: (a) => ownerGraphql(a, `query { accountProfile { ${PROFILE_FIELDS} } }`),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email, a.owner.lastName] },
  },
  {
    id: 'account.profile-victim-channel',
    entity: 'account',
    endpoint: 'accountProfile',
    access: 'victim channel',
    title: "A's owner reads the account profile with B's store token: A's own, nothing of B",
    request: (a, b) => ownerGraphql(a, `query { accountProfile { ${PROFILE_FIELDS} } }`, {}, victimChannel(b)),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email, a.owner.lastName] },
    reverse: true,
  },
  {
    id: 'account.rest-profile-victim-channel',
    entity: 'account',
    endpoint: 'GET /auth/profile',
    access: 'victim channel',
    title: "A's owner GETs /auth/profile with B's store token: A's own, nothing of B",
    request: (a, b) => onChannel(ownerRest(a, 'GET', '/auth/profile'), victimChannel(b)),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email, a.owner.lastName] },
  },
  {
    id: 'account.status-victim-channel',
    entity: 'account',
    endpoint: 'accountStatus',
    access: 'victim channel',
    title: "A's owner reads the account status and email with B's store token: A's own, nothing of B",
    request: (a, b) =>
      ownerGraphql(
        a,
        `query { accountStatus { ${STATUS_FIELDS} } accountProfile { emailAddress } }`,
        {},
        victimChannel(b),
      ),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email] },
  },
  {
    id: 'account.update-profile-victim-channel',
    entity: 'account',
    endpoint: 'updateAccountProfile(input)',
    access: 'victim channel',
    title: "A's owner updates the account profile with B's store token: writes A only, B's profile untouched",
    request: (a, b) =>
      ownerGraphql(
        a,
        `mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { ${PROFILE_FIELDS} } }`,
        { input: { lastName: a.owner.lastName } },
        victimChannel(b),
      ),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email, a.owner.lastName] },
  },
  {
    id: 'account.rest-update-profile-victim-channel',
    entity: 'account',
    endpoint: 'PATCH /auth/profile',
    access: 'victim channel',
    title: "A's owner PATCHes /auth/profile with B's store token: writes A only, B's profile untouched",
    request: (a, b) =>
      onChannel(ownerRest(a, 'PATCH', '/auth/profile', { lastName: a.owner.lastName }), victimChannel(b)),
    expect: { kind: 'own', mustInclude: (a) => [a.owner.email, a.owner.lastName] },
  },
  {
    id: 'logo.update-store-with-victim-logo',
    entity: 'logo asset',
    endpoint: 'updateStore(input.logoAssetId)',
    access: 'write',
    title: "A's owner sets B's logo asset as A's store logo: tenancy.asset-not-available",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }',
        {
          id: a.stores[0].id,
          input: { logoAssetId: b.logoAssetId },
        },
      ),
    expect: { kind: 'code', code: 'tenancy.asset-not-available' },
  },
  {
    id: 'note.list',
    entity: 'template note',
    endpoint: 'templateNotes',
    access: 'list',
    title: "A's owner lists template notes: A's note only",
    request: (a) => ownerGraphql(a, `query { templateNotes(take: 100) { ${NOTE_FIELDS} } }`),
    expect: { kind: 'own', mustInclude: (a) => [a.note.id, a.note.title] },
    reverse: true,
  },
  {
    id: 'note.by-id',
    entity: 'template note',
    endpoint: 'templateNote(id)',
    access: 'read by id',
    title: "A's owner asks for B's template note by id: null",
    request: (a, b) =>
      ownerGraphql(a, `query ($id: String!) { templateNote(id: $id) { ${NOTE_FIELDS} } }`, { id: b.note.id }),
    expect: { kind: 'null', field: 'templateNote' },
    reverse: true,
  },
  {
    id: 'note.victim-channel',
    entity: 'template note',
    endpoint: 'templateNotes',
    access: 'victim channel',
    title: "A's owner lists template notes with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, `query { templateNotes { ${NOTE_FIELDS} } }`, {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'note.create-victim-channel',
    entity: 'template note',
    endpoint: 'createTemplateNote(input)',
    access: 'write',
    title: "A's owner creates a template note with B's store token: FORBIDDEN, B's notes untouched",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title } }',
        { input: { title: 'Planted', body: 'planted in B' } },
        victimChannel(b),
      ),
    expect: { kind: 'forbidden' },
  },

  {
    id: 'member.switcher',
    entity: 'member',
    endpoint: 'switchableStores',
    access: 'list',
    title: "A's member opens the store switcher: A's store, nothing of B",
    request: (a) => memberGraphql(a, 'query { switchableStores { stores { id businessId name subdomain } } }'),
    expect: { kind: 'own', mustInclude: (a) => [a.stores[0].id] },
  },

  {
    id: 'member.member-effective-victim-channel',
    entity: 'member',
    endpoint: 'effectivePermissions',
    access: 'victim channel',
    title: "A's member asks what it holds with B's store token: FORBIDDEN",
    request: (a, b) =>
      memberGraphql(a, 'query { effectivePermissions { storeId permissions storeAccess } }', {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
];
