import { type IsolationCase, ownerGraphql, victimChannel } from '../matrix';
import { demoSignature } from '../world';

const SECRET_FIELDS = 'id provider ref last4 updatedAt';
const FLAG_FIELDS = 'key defaultEnabled rolloutPercent overrides { scope scopeId enabled }';
/** The flag every business of the world holds an override of (seed-operations OVERRIDDEN_FLAG). */
const FLAG = 'ai.enabled';
/** A value the attacker writes; it is not any business's real signing secret. */
const ATTEMPT_VALUE = 'isolation-attempt-value-0001';

const SET_SECRET = 'mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id } }';
const DELETE_SECRET = 'mutation ($id: String!) { deleteTenantSecret(id: $id) }';
const SET_OVERRIDE = `mutation ($input: FeatureFlagOverrideInput!) { setFeatureFlagOverride(input: $input) { ${FLAG_FIELDS} } }`;
const REMOVE_OVERRIDE = `mutation ($input: FeatureFlagOverrideKeyInput!) { removeFeatureFlagOverride(input: $input) { ${FLAG_FIELDS} } }`;
const UPDATE_FLAG = `mutation ($input: UpdateFeatureFlagInput!) { updateFeatureFlag(input: $input) { ${FLAG_FIELDS} } }`;
const JOBS_HEALTH =
  'query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }';

/** Tenant secrets (plugins/platform-secrets), staff-only flags, jobs health, and the inbound webhook gateway. */
export const PLATFORM_CASES: readonly IsolationCase[] = [
  {
    id: 'secret.list',
    entity: 'tenant secret',
    endpoint: 'tenantSecrets',
    access: 'list',
    title: "A's owner lists tenant secrets: A's own only, never a value",
    request: (a) => ownerGraphql(a, `query { tenantSecrets { ${SECRET_FIELDS} } }`),
    expect: { kind: 'own', mustInclude: (a) => [a.secret.id] },
    reverse: true,
  },
  {
    id: 'secret.delete',
    entity: 'tenant secret',
    endpoint: 'deleteTenantSecret(id)',
    access: 'write',
    title: "A's owner deletes B's tenant secret by id: tenant-secret.not-found, B's secret survives",
    request: (a, b) => ownerGraphql(a, DELETE_SECRET, { id: b.secret.id }),
    expect: { kind: 'code', code: 'tenant-secret.not-found' },
    reverse: true,
  },
  {
    id: 'secret.victim-channel-list',
    entity: 'tenant secret',
    endpoint: 'tenantSecrets',
    access: 'victim channel',
    title: "A's owner lists tenant secrets with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, `query { tenantSecrets { ${SECRET_FIELDS} } }`, {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
    reverse: true,
  },
  {
    id: 'secret.victim-channel-set',
    entity: 'tenant secret',
    endpoint: 'setTenantSecret(input)',
    access: 'victim channel',
    title: "A's owner replaces the demo signing secret with B's store token: FORBIDDEN, B's secret unchanged",
    request: (a, b) =>
      ownerGraphql(
        a,
        SET_SECRET,
        { input: { provider: 'demo-webhook', ref: 'signing', value: ATTEMPT_VALUE } },
        victimChannel(b),
      ),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'secret.victim-channel-delete',
    entity: 'tenant secret',
    endpoint: 'deleteTenantSecret(id)',
    access: 'victim channel',
    title: "A's owner deletes B's tenant secret with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, DELETE_SECRET, { id: b.secret.id }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'flag.list',
    entity: 'flag override',
    endpoint: 'featureFlags',
    access: 'list',
    title: "A's owner lists feature flags, which hold every business's overrides: FORBIDDEN",
    request: (a) => ownerGraphql(a, `query { featureFlags { ${FLAG_FIELDS} } }`),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'flag.evaluate',
    entity: 'flag override',
    endpoint: 'evaluateFeatureFlag(key, businessId)',
    access: 'read by id',
    title: "A's owner evaluates a flag for B's business: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(
        a,
        'query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }',
        {
          key: FLAG,
          businessId: b.businessId,
        },
      ),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'flag.set-override',
    entity: 'flag override',
    endpoint: 'setFeatureFlagOverride(input)',
    access: 'write',
    title: "A's owner sets a flag override on B's business: FORBIDDEN, B's override unchanged",
    request: (a, b) =>
      ownerGraphql(a, SET_OVERRIDE, { input: { key: FLAG, scope: 'BUSINESS', scopeId: b.businessId, enabled: false } }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'flag.remove-override',
    entity: 'flag override',
    endpoint: 'removeFeatureFlagOverride(input)',
    access: 'write',
    title: "A's owner removes B's flag override: FORBIDDEN, B's override survives",
    request: (a, b) =>
      ownerGraphql(a, REMOVE_OVERRIDE, { input: { key: FLAG, scope: 'BUSINESS', scopeId: b.businessId } }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'flag.update',
    entity: 'flag override',
    endpoint: 'updateFeatureFlag(input)',
    access: 'write',
    title: "A's owner turns a platform-wide flag on for every business: FORBIDDEN, the flag unchanged",
    request: (a) => ownerGraphql(a, UPDATE_FLAG, { input: { key: FLAG, defaultEnabled: true } }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'jobs.health',
    entity: 'outbox and jobs',
    endpoint: 'platformJobsHealth',
    access: 'list',
    title: "A's owner reads the platform-wide outbox and jobs health: FORBIDDEN",
    request: (a) => ownerGraphql(a, JOBS_HEALTH),
    expect: { kind: 'forbidden' },
    reverse: true,
  },
  {
    id: 'webhook.cross-signed',
    entity: 'inbound webhook',
    endpoint: 'POST /webhooks/demo/:accountKey',
    access: 'write',
    title: "A, signing as a provider with A's secret, posts a webhook to B's store: 401, nothing stored for B",
    request: (a, b) => {
      const body = JSON.stringify({ event: 'isolation.cross-signed', store: 'A1' });
      return {
        method: 'POST',
        path: `/webhooks/demo/${b.stores[0].subdomain}`,
        caller: { label: 'A, signing as a provider' },
        rawBody: body,
        headers: {
          'x-demo-signature': demoSignature(a.secret.value, body),
          'x-demo-event-id': 'isolation-cross-signed',
        },
      };
    },
    expect: { kind: 'status', status: 401 },
    reverse: true,
  },
];
