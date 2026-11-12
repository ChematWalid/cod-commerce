import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { COMMISSION_BASES } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BasisAnswer,
  type CommissionAnswer,
  CONFIGS,
  configBody,
  configOf,
  CREATE_TEAM_COMMISSION_CONFIG,
  DELETE_TEAM_COMMISSION_CONFIG,
  FIRST_VALUE,
  ownerOf,
  SECOND_VALUE,
  TEAM_COMMISSION_BASES,
  TEAM_COMMISSION_CONFIG,
  TEAM_COMMISSION_CONFIGS,
  uniqueName,
  UPDATE_TEAM_COMMISSION_CONFIG,
} from './commission-operations';
import { authTestOptions, createTeamTestEnvironment, freshEmail, TeamKit } from './team-kit';

const SNOWFLAKE_WORKER_ID = 1005;
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

describe('commission configs over REST', () => {
  it('creates, reads, edits and deletes a config', async () => {
    // Arrange
    await ownerOf(kit, businesses.a);
    const name = uniqueName('Confirmations');

    // Act
    const created = await kit.rest('POST', CONFIGS, configBody(name));
    const id = (created.body as CommissionAnswer).id;
    const listed = await kit.rest('GET', CONFIGS);
    const read = await kit.rest('GET', `${CONFIGS}/${id}`);
    const edited = await kit.rest('PATCH', `${CONFIGS}/${id}`, {
      valueKind: 'percent',
      value: 250,
      scope: 'selected',
      storeIds: [businesses.a.stores[1].id],
    });
    const deleted = await kit.rest('DELETE', `${CONFIGS}/${id}`);
    const gone = await kit.rest('GET', `${CONFIGS}/${id}`);

    // Assert
    expect(created).toMatchObject({ status: 201, body: { name, value: FIRST_VALUE, scope: 'all', storeIds: [] } });
    expect((listed.body as CommissionAnswer[]).map((config) => config.id)).toContain(id);
    expect(read).toMatchObject({ status: 200, body: { id, name } });
    expect(edited).toMatchObject({
      status: 200,
      body: { id, valueKind: 'percent', value: 250, scope: 'selected', storeIds: [businesses.a.stores[1].id] },
    });
    expect(deleted).toMatchObject({ status: 200, body: { success: true } });
    expect(gone).toMatchObject({ status: 404, body: { code: 'team.commission-not-found' } });
  });

  it('refuses a name the business already uses, whatever its case, and a percent above 100 %', async () => {
    // Arrange
    const existing = await configOf(kit, businesses.a, uniqueName('Delivered'));

    // Act
    const twin = await kit.rest('POST', CONFIGS, configBody(`  ${existing.name.toUpperCase()} `));
    const tooHigh = await kit.rest('POST', CONFIGS, {
      ...configBody(uniqueName('Hi')),
      valueKind: 'percent',
      value: 10_001,
    });
    const unknownBasis = await kit.rest('POST', CONFIGS, { ...configBody(uniqueName('Odd')), basis: 'per-call' });

    // Assert
    expect(twin).toMatchObject({ status: 409, body: { code: 'team.commission-name-taken' } });
    expect(tooHigh).toMatchObject({ status: 400, body: { code: 'team.invalid-input' } });
    expect(unknownBasis).toMatchObject({ status: 400, body: { code: 'team.invalid-input' } });
  });

  it('lists every basis with its Arabic and English label', async () => {
    // Arrange
    await ownerOf(kit, businesses.a);

    // Act
    const answer = await kit.rest('GET', `${CONFIGS}/actions`);

    // Assert
    const bases = answer.body as BasisAnswer[];
    expect(answer.status).toBe(200);
    expect(bases.map((option) => option.basis)).toEqual([...COMMISSION_BASES]);
    for (const option of bases) {
      expect(option.labels.ar.trim()).not.toBe('');
      expect(option.labels.en.trim()).not.toBe('');
      expect(option.labels.ar).not.toBe(option.labels.en);
    }
  });
});

describe('commission configs over GraphQL', () => {
  it('creates, lists, reads, edits and deletes a config, and lists the bases', async () => {
    // Arrange
    await ownerOf(kit, businesses.a);
    const name = uniqueName('Graph');

    // Act
    const { createTeamCommissionConfig: created } = await adminClient.query<{
      createTeamCommissionConfig: CommissionAnswer;
    }>(CREATE_TEAM_COMMISSION_CONFIG, { input: configBody(name) });
    const { teamCommissionConfigs } = await adminClient.query<{ teamCommissionConfigs: CommissionAnswer[] }>(
      TEAM_COMMISSION_CONFIGS,
    );
    const { teamCommissionConfig } = await adminClient.query<{ teamCommissionConfig: CommissionAnswer }>(
      TEAM_COMMISSION_CONFIG,
      { id: created.id },
    );
    const { updateTeamCommissionConfig: updated } = await adminClient.query<{
      updateTeamCommissionConfig: CommissionAnswer;
    }>(UPDATE_TEAM_COMMISSION_CONFIG, { id: created.id, input: { basis: 'per-delivered-order' } });
    const { teamCommissionBases } = await adminClient.query<{ teamCommissionBases: BasisAnswer[] }>(
      TEAM_COMMISSION_BASES,
    );
    const { deleteTeamCommissionConfig } = await adminClient.query<{ deleteTeamCommissionConfig: boolean }>(
      DELETE_TEAM_COMMISSION_CONFIG,
      { id: created.id },
    );
    const gone = await failureOf(adminClient.query(TEAM_COMMISSION_CONFIG, { id: created.id }));

    // Assert
    expect(created).toMatchObject({ name, basis: 'per-confirmed-order', value: FIRST_VALUE });
    expect(teamCommissionConfigs.map((config) => config.id)).toContain(created.id);
    expect(teamCommissionConfig).toEqual(created);
    expect(updated).toMatchObject({ id: created.id, basis: 'per-delivered-order', value: FIRST_VALUE });
    expect(teamCommissionBases.map((option) => option.basis)).toEqual([...COMMISSION_BASES]);
    expect(deleteTeamCommissionConfig).toBe(true);
    expect(gone.codes).toEqual(['team.commission-not-found']);
  });
});

describe('commissions given to members', () => {
  it('refuses to delete a commission a member is given, and keeps it', async () => {
    // Arrange
    const member = await kit.teamMemberWith(businesses.a, await kit.builtInRoleId(businesses.a, 'order-tracker'));
    const config = await configOf(kit, businesses.a);
    await kit.rest('PATCH', `/employees/${member.memberId}`, { commissionConfigIds: [config.id] });

    // Act
    const deleted = await kit.rest('DELETE', `${CONFIGS}/${config.id}`);

    // Assert
    expect(deleted).toMatchObject({ status: 409, body: { code: 'team.commission-in-use' } });
    expect((await kit.rest('GET', `${CONFIGS}/${config.id}`)).status).toBe(200);
  });

  it("refuses another business's commission in an invite and in a member edit, storing nothing", async () => {
    // Arrange
    const ofB = await configOf(kit, businesses.b);
    const member = await kit.teamMemberWith(businesses.a, await kit.builtInRoleId(businesses.a, 'order-tracker'));
    await ownerOf(kit, businesses.a);
    const email = freshEmail('foreign-commission');

    // Act
    const invited = await kit.rest('POST', '/employees', {
      email,
      roleIds: [await kit.builtInRoleId(businesses.a, 'order-tracker')],
      storeAccess: 'all',
      baseSalary: 0,
      commissionConfigIds: [ofB.id],
    });
    const edited = await kit.rest('PATCH', `/employees/${member.memberId}`, { commissionConfigIds: [ofB.id] });

    // Assert
    expect(invited).toMatchObject({ status: 404, body: { code: 'team.commission-not-found' } });
    expect(edited).toMatchObject({ status: 404, body: { code: 'team.commission-not-found' } });
    expect(await kit.query('SELECT id FROM team_member WHERE "emailKey" = $1', [email.toLowerCase()])).toEqual([]);
    const [row] = await kit.query<{ ids: string[] }>(
      'SELECT "commissionConfigIds" AS ids FROM team_member WHERE id = $1',
      [member.memberId],
    );
    expect(row?.ids).toEqual([]);
  });

  it('refuses an actor its own commissions: on its member row, and on a config it is given (D212)', async () => {
    // Arrange
    const { a } = businesses;
    const manager = await kit.teamMemberWith(
      a,
      await kit.customRole(a, [
        'team.members.view',
        'team.members.edit',
        'team.commissions.view',
        'team.commissions.edit',
      ]),
    );
    const config = await configOf(kit, a);
    await kit.rest('PATCH', `/employees/${manager.memberId}`, { commissionConfigIds: [config.id] });
    await kit.newSession(manager, a.stores[0]);

    // Act
    const ownRow = await kit.rest('PATCH', `/employees/${manager.memberId}`, { commissionConfigIds: [] });
    const ownConfig = await kit.rest('PATCH', `${CONFIGS}/${config.id}`, { value: SECOND_VALUE });

    // Assert
    expect(ownRow).toMatchObject({ status: 403, body: { code: 'team.self-action' } });
    expect(ownConfig).toMatchObject({ status: 403, body: { code: 'team.self-action' } });
    await ownerOf(kit, a);
    expect((await kit.rest('GET', `${CONFIGS}/${config.id}`)).body).toMatchObject({ value: FIRST_VALUE });
  });
});
