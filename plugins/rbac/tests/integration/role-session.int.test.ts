import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { ConfigService } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, type MockInstance, vi } from 'vitest';
import { ACTIVITY_LOG } from '../../application/tokens';
import { SESSION_REDELETE_DELAY_MS } from '../../domain/constants';
import type { ActivityLogPort } from '../../domain/ports/activity-log.port';
import { CANCEL_ORDER } from './built-in-roles-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi, type RoleAnswer, RoleTeam } from './roles-kit';
import { settle } from './session-kit';

const SNOWFLAKE_WORKER_ID = 1022;
const REPEAT_MARGIN_MS = 300;

describe('a role change mid-session', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let role: RoleAnswer;
  let deletes: MockInstance;
  let realDelete: (token: string) => void | Promise<void>;
  let credentials: { email: string; password: string };
  let memberToken: string;
  let counter = 0;

  const sessionDeletes = (token: string): number => deletes.mock.calls.filter(([deleted]) => deleted === token).length;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'session');
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function freshMember(): Promise<void> {
    counter += 1;
    await team.asOwner();
    role = await api.create(allStoresRole(`Session role ${String(counter)}`, { orders: 'full' }));
    const member = await team.signedInMember([role.id], undefined);
    credentials = member.credentials;
    memberToken = member.token;
    // Caches the session as the member sees it.
    await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
    await team.asOwner();
    const { sessionCacheStrategy } = server.app.get(ConfigService).authOptions;
    realDelete = sessionCacheStrategy.delete.bind(sessionCacheStrategy);
    deletes = vi.spyOn(sessionCacheStrategy, 'delete');
  }

  it('refuses the very next request after the key is removed', async () => {
    await freshMember();

    await api.update(role.id, { revokes: ['orders.cancel'] });

    adminClient.setAuthToken(memberToken);
    expect((await failureOf(adminClient.query(CANCEL_ORDER))).codes).toEqual(['FORBIDDEN']);
  });

  it('deletes each holder session after the commit and again after the delay', async () => {
    await freshMember();
    const permissionsAtDelete: (readonly string[])[] = [];
    deletes.mockImplementation(async (token: string) => {
      permissionsAtDelete.push(await team.storedPermissions(role.id));
      return realDelete(token);
    });

    await api.update(role.id, { revokes: ['orders.cancel'] });
    expect(sessionDeletes(memberToken)).toBeGreaterThanOrEqual(1);
    await settle(SESSION_REDELETE_DELAY_MS + REPEAT_MARGIN_MS);

    expect(sessionDeletes(memberToken)).toBe(2);
    expect(permissionsAtDelete[0]).not.toContain('orders.cancel');
  });

  it('deletes nothing when the change rolls back', async () => {
    await freshMember();
    vi.spyOn(server.app.get<ActivityLogPort>(ACTIVITY_LOG), 'append').mockRejectedValueOnce(new Error('append failed'));

    await expect(api.update(role.id, { revokes: ['orders.cancel'] })).rejects.toBeDefined();
    await settle(SESSION_REDELETE_DELAY_MS + REPEAT_MARGIN_MS);

    expect(sessionDeletes(memberToken)).toBe(0);
    await actAs(adminClient, credentials, team.home);
    await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
  });

  it('flushes no session for a name-only update', async () => {
    await freshMember();

    await api.update(role.id, { name: `Renamed ${String(counter)}` });
    await settle(SESSION_REDELETE_DELAY_MS + REPEAT_MARGIN_MS);

    expect(sessionDeletes(memberToken)).toBe(0);
  });
});
