import { BUILT_IN_ROLES, MAX_CUSTOM_ROLES_PER_BUSINESS, ROLE_NAME_MAX_LENGTH } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { CREATE_ROLE, RoleApi, RoleTeam } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1021;
const ARABIC_SALES = 'مبيعات';
/** NFKC folds these Arabic presentation forms into {@link ARABIC_SALES}. */
const ARABIC_SALES_PRESENTATION = 'ﻣﺒﻴﻌﺎﺕ';

describe('role names and duplicates', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'names');
    await team.asOwner();
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('checks that the presentation forms fold to the same word', () => {
    expect(ARABIC_SALES_PRESENTATION.normalize('NFKC')).toBe(ARABIC_SALES);
  });

  it.each([
    ['Sales', ' sales '],
    ['Support  Team', 'SUPPORT TEAM'],
    [ARABIC_SALES, ARABIC_SALES_PRESENTATION],
  ])('treats %s and %s as one name', async (first, second) => {
    await api.create({ name: first });

    const failure = await failureOf(api.create({ name: second }));

    expect(failure.codes).toEqual(['rbac.name-taken']);
  });

  it('reserves the name of a built-in', async () => {
    expect((await failureOf(api.create({ name: 'OWNER' }))).codes).toEqual(['rbac.name-taken']);
  });

  it('refuses renaming onto another role, and allows re-casing its own name', async () => {
    const first = await api.create({ name: 'Rename One' });
    await api.create({ name: 'Rename Two' });

    expect((await failureOf(api.update(first.id, { name: ' rename two ' }))).codes).toEqual(['rbac.name-taken']);
    expect((await api.update(first.id, { name: 'RENAME ONE' })).name).toBe('RENAME ONE');
  });

  it.each(['', '   ', 'x'.repeat(ROLE_NAME_MAX_LENGTH + 1)])('refuses the name "%s"', async (name) => {
    expect((await failureOf(api.create({ name }))).codes).toEqual(['rbac.name-invalid']);
  });

  it('gives a duplicate the copy name and identical permissions', async () => {
    const source = await api.create({ name: 'Packers', areaLevels: [{ area: 'orders', level: 'view' }] });

    const copy = await api.duplicate(source.id);

    expect(copy.name).toBe('Packers (copy)');
    expect(copy.permissions).toEqual(source.permissions);
    expect(copy.isBuiltIn).toBe(false);
    expect(copy.memberCount).toBe(0);
  });

  it('sees a differently written copy as taken when numbering', async () => {
    const source = await api.create({ name: 'Drivers' });
    await api.create({ name: ' DRIVERS   (COPY) ' });

    expect((await api.duplicate(source.id)).name).toBe('Drivers (copy 2)');
  });

  it('sees an Arabic copy written in presentation forms as taken', async () => {
    const source = await api.create({ name: 'تغليف' });
    await api.create({ name: `تغليف (ﻧﺴﺨﺔ)` });

    expect((await api.duplicate(source.id, 'ar')).name).toBe('تغليف (نسخة 2)');
  });

  it('keeps a copy of a 60-character name within 60', async () => {
    const source = await api.create({ name: 'n'.repeat(ROLE_NAME_MAX_LENGTH) });

    const copy = await api.duplicate(source.id);

    expect(Array.from(copy.name)).toHaveLength(ROLE_NAME_MAX_LENGTH);
    expect(copy.name.endsWith(' (copy)')).toBe(true);
  });

  it('names a built-in copy in the requested language', async () => {
    const accountant = await team.rows.roleId(businesses.a.businessId, 'accountant');
    const label = BUILT_IN_ROLES.find(({ key }) => key === 'accountant')?.label;

    const arabic = await api.duplicate(accountant, 'ar');
    const english = await api.duplicate(accountant);

    expect(arabic.name).toBe(`${label?.ar ?? ''} (نسخة)`);
    expect(english.name).toBe(`${label?.en ?? ''} (copy)`);
    expect(arabic.permissions).toEqual(await team.storedPermissions(accountant));
  });

  it('numbers two concurrent duplicates', async () => {
    const source = await api.create({ name: 'Concurrent' });

    const copies = await Promise.all([api.duplicate(source.id), api.duplicate(source.id)]);

    expect(copies.map(({ name }) => name).sort()).toEqual(['Concurrent (copy 2)', 'Concurrent (copy)']);
  });

  it('answers a refusal in the language asked for', async () => {
    const rejection: unknown = await adminClient
      .query(CREATE_ROLE, { input: { name: 'OWNER' } }, { languageCode: 'ar' })
      .catch((error: unknown) => error);

    expect((rejection as Error).message).toMatch(/[\u0600-\u06FF]/);
  });

  it('stops at the limit of custom roles, for create and duplicate', async () => {
    const repository = server.app.get(TransactionalConnection).rawConnection.getRepository(BusinessRoleEntity);
    const present = await repository.countBy({ businessId: businesses.a.businessId });
    const custom = present - BUILT_IN_ROLES.length;
    const source = await api.create({ name: 'Almost full' });
    const fill = Array.from({ length: MAX_CUSTOM_ROLES_PER_BUSINESS - custom - 1 }, (_, index) => ({
      id: String(9_000_000_000 + index),
      businessId: businesses.a.businessId,
      name: `Filler ${String(index)}`,
      nameKey: `filler ${String(index)}`,
      description: null,
      builtInKey: null,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await repository.insert(fill);

    expect((await failureOf(api.create({ name: 'One too many' }))).codes).toEqual(['rbac.role-limit']);
    expect((await failureOf(api.duplicate(source.id))).codes).toEqual(['rbac.role-limit']);
  });
});
