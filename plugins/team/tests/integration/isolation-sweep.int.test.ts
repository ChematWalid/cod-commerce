import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { declaredOperations, declaredRoutes } from './declared-handlers';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  operationKey,
  type RouteEntry,
  ROUTE_REGISTRY,
  routeKey,
  type TargetIds,
} from './endpoint-registry';
import { authTestOptions, createTeamTestEnvironment, freshEmail, TeamKit } from './team-kit';

const SNOWFLAKE_WORKER_ID = 1020;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, {
  plugins: [RbacPlugin, AuthPlugin.init(authTestOptions())],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});
const NOT_FOUND_CODES = ['team.member-not-found', 'team.commission-not-found'];
const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const UNAUTHORIZED_STATUS = 401;
const INVALID_STATUS = 400;
const FIRST_FAILURE_STATUS = 400;
const FIRST_SERVER_FAULT_STATUS = 500;
const NO_CODE = 'NO_CODE';

let businesses: TwoBusinesses;
let kit: TeamKit;
/** The ids of business A every call names. */
let targets: Omit<TargetIds, 'email'>;
/** Strings only business A's data holds; no answer to another caller may contain one. */
let secretsOfA: string[];

/** What a call answered, the same shape over GraphQL and REST: no `code` means it succeeded. */
interface Outcome {
  readonly code: string | undefined;
  /** The HTTP status of a REST call; GraphQL answers carry none. */
  readonly status: number | undefined;
  readonly body: unknown;
}

interface ClientErrorShape {
  readonly response?: {
    readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[];
    readonly data?: unknown;
  };
}

const idsForCall = (): TargetIds => ({ ...targets, email: freshEmail('sweep') });

async function callOperation(entry: OperationEntry): Promise<Outcome> {
  try {
    const data = await adminClient.query<unknown>(gql(entry.document), entry.variables(idsForCall()));
    return { code: undefined, status: undefined, body: data };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    return { code: response?.errors?.[0]?.extensions?.code ?? NO_CODE, status: undefined, body: response ?? null };
  }
}

async function callRoute(entry: RouteEntry): Promise<Outcome> {
  const ids = idsForCall();
  const answer = await kit.rest(entry.method, entry.url(ids), entry.body?.(ids));
  const code = (answer.body as { code?: string } | null)?.code;
  return { code: answer.status < FIRST_FAILURE_STATUS ? undefined : (code ?? NO_CODE), ...answer };
}

/** Every row business A owns in the tables Team writes or reaches, rbac's bindings and activity log included. */
async function snapshotOfA(): Promise<unknown[]> {
  const id = businesses.a.businessId;
  const tables = [
    'team_member',
    'invitation',
    'commission_config',
    'salary_payment',
    'member_role_assignment',
    'role_binding',
    'activity_log',
  ];
  const rows = await Promise.all(
    tables.map((table) => kit.query(`SELECT * FROM ${table} WHERE "businessId" = $1 ORDER BY id`, [id])),
  );
  const accounts = await kit.query(
    'SELECT id, "deletedAt" FROM administrator WHERE "customFieldsBusinessid" = $1 ORDER BY id',
    [id],
  );
  return [...rows, accounts];
}

/** Activity rows of any other business that name one of A's members or commissions. */
function activityNamingAElsewhere(): Promise<unknown[]> {
  const named = [targets.memberId, targets.invitedMemberId, targets.commissionId];
  return kit.query('SELECT * FROM activity_log WHERE "businessId" <> $1 AND "entityId" = ANY($2)', [
    businesses.a.businessId,
    named,
  ]);
}

/** A refusal of the input with one of the entry's codes: never a permission refusal, a fault or a bare guard body. */
function expectInputRefusal(refusedWith: readonly string[] | undefined, outcome: Outcome): void {
  expect(refusedWith ?? []).toContain(outcome.code);
  if (outcome.status === undefined) return;
  expect(outcome.status).toBeGreaterThanOrEqual(FIRST_FAILURE_STATUS);
  expect(outcome.status).toBeLessThan(FIRST_SERVER_FAULT_STATUS);
  expect(outcome.status).not.toBe(FORBIDDEN_STATUS);
}

/** Asserts what business B gets when it names A's ids, as the registry entry declares it. */
function expectForeignOutcome(
  { foreign, refusedWith }: Pick<OperationEntry, 'foreign' | 'refusedWith'>,
  outcome: Outcome,
): void {
  // A refusal's `path` echoes the URL the caller itself sent, with the id it named; that tells it nothing of A.
  const text = JSON.stringify(outcome.body, (key, value: unknown) => (key === 'path' ? undefined : value));
  expect(secretsOfA.filter((secret) => text.includes(secret))).toEqual([]);
  if (foreign === 'not-found') {
    expect(NOT_FOUND_CODES).toContain(outcome.code);
    if (outcome.status !== undefined) expect(outcome.status).toBe(NOT_FOUND_STATUS);
  }
  if (foreign === 'refused') expectInputRefusal(refusedWith, outcome);
  if (foreign === 'own-only') expect(outcome.code).toBeUndefined();
  if (foreign === 'token-bound') {
    expect(outcome.code).toBe('team.invitation-invalid');
    expect(outcome.status).toBe(INVALID_STATUS);
  }
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
  const { a } = businesses;
  const roleId = await kit.builtInRoleId(a, 'order-tracker');
  const active = await kit.teamMemberWith(a, roleId, [a.stores[0]]);
  const invitedEmail = freshEmail('sweep-invited');
  const commissionName = `Sweep commission of A ${invitedEmail}`;
  await kit.signIn(a.owner, a.stores[0]);
  const invited = await kit.rest('POST', '/employees', {
    email: invitedEmail,
    roleIds: [roleId],
    storeAccess: 'selected',
    storeIds: [a.stores[0].id],
    baseSalary: 12_345,
  });
  const commission = await kit.rest('POST', '/commissions/configs', {
    name: commissionName,
    basis: 'per-confirmed-order',
    valueKind: 'fixed',
    value: 777,
    scope: 'all',
  });
  expect([invited.status, commission.status]).toEqual([201, 201]);
  targets = {
    memberId: active.memberId,
    invitedMemberId: (invited.body as { id: string }).id,
    commissionId: (commission.body as { id: string }).id,
    roleId,
    storeId: a.stores[0].id,
  };
  secretsOfA = [
    targets.memberId,
    targets.invitedMemberId,
    targets.commissionId,
    active.email,
    invitedEmail,
    commissionName,
    a.businessId,
    a.owner.email,
    a.stores[0].subdomain,
    a.stores[1].subdomain,
  ];
}, 180_000);

afterAll(async () => {
  await server.destroy();
});

const guarded = <T extends { access: string }>(entries: readonly T[]): T[] =>
  entries.filter((entry) => entry.access !== 'public');

describe('the Team isolation sweep', () => {
  it('covers every handler the plugin declares, so a handler left out of the registry fails here', () => {
    // Act
    const swept = [...OPERATION_REGISTRY.map(operationKey), ...ROUTE_REGISTRY.map(routeKey)].sort();
    const declared = [...declaredOperations(), ...declaredRoutes()].map(({ key }) => key).sort();

    // Assert
    expect(swept).toEqual(declared);
  });

  describe("as the owner of business B, naming business A's ids", () => {
    it.each(OPERATION_REGISTRY)('$operation answers $foreign and changes nothing of A', async (entry) => {
      // Arrange
      await kit.signIn(businesses.b.owner, businesses.b.stores[0]);
      const before = await snapshotOfA();

      // Act
      const outcome = await callOperation(entry);

      // Assert
      expectForeignOutcome(entry, outcome);
      expect(await snapshotOfA()).toEqual(before);
      expect(await activityNamingAElsewhere()).toEqual([]);
    });

    it.each(ROUTE_REGISTRY)('$method $route answers $foreign and changes nothing of A', async (entry) => {
      // Arrange
      await kit.signIn(businesses.b.owner, businesses.b.stores[0]);
      const before = await snapshotOfA();

      // Act
      const outcome = await callRoute(entry);

      // Assert
      expectForeignOutcome(entry, outcome);
      expect(await snapshotOfA()).toEqual(before);
      expect(await activityNamingAElsewhere()).toEqual([]);
    });
  });

  describe('as a member of B holding no Team permission', () => {
    beforeAll(async () => {
      const { b } = businesses;
      const bystander = await kit.memberWith(b, await kit.customRole(b, ['orders.view']));
      await kit.signIn(bystander, b.stores[0]);
    });

    it.each(guarded(OPERATION_REGISTRY))('$operation is FORBIDDEN', async (entry) => {
      // Act
      const outcome = await callOperation(entry);

      // Assert
      expect(outcome.code).toBe('FORBIDDEN');
    });

    it.each(guarded(ROUTE_REGISTRY))('$method $route answers 403', async (entry) => {
      // Act
      const outcome = await callRoute(entry);

      // Assert
      expect(outcome.status).toBe(FORBIDDEN_STATUS);
    });
  });

  describe('without a session', () => {
    beforeAll(async () => {
      await adminClient.asAnonymousUser();
      adminClient.setChannelToken(businesses.a.stores[0].channelToken);
    });

    it.each(guarded(OPERATION_REGISTRY))('$operation is FORBIDDEN', async (entry) => {
      // Act
      const outcome = await callOperation(entry);

      // Assert
      expect(outcome.code).toBe('FORBIDDEN');
    });

    it.each(guarded(ROUTE_REGISTRY))('$method $route answers 401 or 403', async (entry) => {
      // Act
      const outcome = await callRoute(entry);

      // Assert
      expect([UNAUTHORIZED_STATUS, FORBIDDEN_STATUS]).toContain(outcome.status);
    });
  });
});
