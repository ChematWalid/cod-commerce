import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { type PermissionKey, teamCommissionActivityDiffSchema } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CommissionAnswer,
  CONFIGS,
  configBody,
  configOf,
  CREATE_TEAM_COMMISSION_CONFIG,
  FIRST_VALUE,
  ownerOf,
  SECOND_VALUE,
  TEAM_COMMISSION_CONFIG,
  TEAM_COMMISSION_CONFIGS,
  uniqueName,
  UPDATE_TEAM_COMMISSION_CONFIG,
} from './commission-operations';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import { ACTIVITY_LOG, type ActivityItem } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1006;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);

let businesses: TwoBusinesses;
let kit: TeamKit;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
});

afterAll(async () => {
  await server.destroy();
});

describe('who may manage commissions', () => {
  /** The REST status and GraphQL outcome of each commission handler, for a holder of `grant` alone. */
  async function outcomesFor(grant: PermissionKey) {
    const { a } = businesses;
    const config = await configOf(kit, a);
    const holder = await kit.teamMemberWith(a, await kit.customRole(a, [grant]));
    await kit.newSession(holder, a.stores[0]);
    const id = config.id;
    const rest = {
      list: (await kit.rest('GET', CONFIGS)).status,
      bases: (await kit.rest('GET', `${CONFIGS}/actions`)).status,
      read: (await kit.rest('GET', `${CONFIGS}/${id}`)).status,
      create: (await kit.rest('POST', CONFIGS, configBody(uniqueName('Perm')))).status,
      edit: (await kit.rest('PATCH', `${CONFIGS}/${id}`, { value: SECOND_VALUE })).status,
      delete: (await kit.rest('DELETE', `${CONFIGS}/${id}`)).status,
    };
    const forbidden = async (call: Promise<unknown>) =>
      call.then(
        () => false,
        async () => (await failureOf(call)).codes.includes('FORBIDDEN'),
      );
    const graphql = {
      list: await forbidden(adminClient.query(TEAM_COMMISSION_CONFIGS)),
      create: await forbidden(adminClient.query(CREATE_TEAM_COMMISSION_CONFIG, { input: configBody(uniqueName('G')) })),
      edit: await forbidden(adminClient.query(UPDATE_TEAM_COMMISSION_CONFIG, { id, input: { value: 2 } })),
    };
    return { rest, graphql };
  }

  it('lets a holder of team.commissions.view read only', async () => {
    // Act
    const { rest, graphql } = await outcomesFor('team.commissions.view');

    // Assert
    expect(rest).toEqual({ list: 200, bases: 200, read: 200, create: 403, edit: 403, delete: 403 });
    expect(graphql).toEqual({ list: false, create: true, edit: true });
  });

  it('lets a holder of team.commissions.set create only', async () => {
    // Act
    const { rest } = await outcomesFor('team.commissions.set');

    // Assert
    expect(rest).toEqual({ list: 403, bases: 403, read: 403, create: 201, edit: 403, delete: 403 });
  });

  it('lets a holder of team.commissions.edit edit only', async () => {
    // Act
    const { rest } = await outcomesFor('team.commissions.edit');

    // Assert
    expect(rest).toEqual({ list: 403, bases: 403, read: 403, create: 403, edit: 200, delete: 403 });
  });

  it('lets a holder of team.commissions.delete delete only', async () => {
    // Act
    const { rest } = await outcomesFor('team.commissions.delete');

    // Assert
    expect(rest).toEqual({ list: 403, bases: 403, read: 403, create: 403, edit: 403, delete: 200 });
  });
});

describe('commission configs between two businesses', () => {
  it("never shows, edits or deletes another business's config, and lets it reuse the name", async () => {
    // Arrange
    const ofA = await configOf(kit, businesses.a);
    await ownerOf(kit, businesses.b);

    // Act
    const listed = await kit.rest('GET', CONFIGS);
    const read = await kit.rest('GET', `${CONFIGS}/${ofA.id}`);
    const edited = await kit.rest('PATCH', `${CONFIGS}/${ofA.id}`, { value: SECOND_VALUE });
    const deleted = await kit.rest('DELETE', `${CONFIGS}/${ofA.id}`);
    const graphql = await failureOf(adminClient.query(TEAM_COMMISSION_CONFIG, { id: ofA.id }));
    const sameName = await kit.rest('POST', CONFIGS, configBody(ofA.name));

    // Assert
    expect((listed.body as CommissionAnswer[]).map((config) => config.id)).not.toContain(ofA.id);
    for (const answer of [read, edited, deleted]) {
      expect(answer).toMatchObject({ status: 404, body: { code: 'team.commission-not-found' } });
    }
    expect(graphql.codes).toEqual(['team.commission-not-found']);
    expect(sameName.status).toBe(201);
    await ownerOf(kit, businesses.a);
    expect((await kit.rest('GET', `${CONFIGS}/${ofA.id}`)).body).toMatchObject({ value: FIRST_VALUE });
  });
});

describe('the activity of commission configs (D216)', () => {
  it('names the config and the changed fields, never its value', async () => {
    // Arrange
    const { a } = businesses;
    const config = await configOf(kit, a);
    await kit.rest('PATCH', `${CONFIGS}/${config.id}`, { value: SECOND_VALUE });
    await kit.rest('DELETE', `${CONFIGS}/${config.id}`);
    const reader = await kit.teamMemberWith(a, await kit.customRole(a, ['settings.activity-log.view']));
    await kit.newSession(reader, a.stores[0]);

    // Act
    const { activityLog } = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {});

    // Assert
    const rows = activityLog.items.filter((item) => item.entityId === config.id);
    expect(rows.map((row) => row.action).sort()).toEqual([
      'team.commission.created',
      'team.commission.deleted',
      'team.commission.updated',
    ]);
    const diffs = rows.map((row) => teamCommissionActivityDiffSchema.parse(row.diff));
    expect(diffs.find((diff) => diff.changedFields.length === 1)?.changedFields).toEqual(['value']);
    const serialized = JSON.stringify(rows);
    for (const value of [FIRST_VALUE, SECOND_VALUE]) expect(serialized).not.toContain(String(value));
  });
});
