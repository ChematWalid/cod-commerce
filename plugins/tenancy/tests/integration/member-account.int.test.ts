import { toSnowflake } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type CreateMemberAccountCommand, MemberAccountService } from '../../application/member-account.service';
import { BusinessOwnerProtectedError, MemberEmailTakenError, MemberNotInBusinessError } from '../../domain/errors';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { tenancyTestPlugins } from './tenant-fixtures';

const SNOWFLAKE_WORKER_ID = 1007;
/** Synthetic; every member this file creates signs in with it. */
const MEMBER_PASSWORD = 'synthetic-member-password';

const LOGIN = gql`
  mutation ($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      __typename
    }
  }
`;

interface AdministratorRow {
  readonly businessId: string | null;
  readonly deletedAt: Date | null;
  readonly roleCount: number;
}

describe('MemberAccountService', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(SNOWFLAKE_WORKER_ID),
    db: loadPluginTestDbConfig(process.env),
  });
  let businesses: TwoBusinesses;
  let counter = 0;

  const service = (): MemberAccountService => server.app.get(MemberAccountService);
  const anonymous = async (): Promise<OperationContext> =>
    asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));

  const commandFor = (business: BusinessFixture, emailAddress?: string): CreateMemberAccountCommand => {
    counter += 1;
    return {
      businessId: toSnowflake(business.businessId),
      emailAddress: emailAddress ?? `member-${String(counter)}@example.test`,
      firstName: 'Synthetic',
      lastName: `Member ${String(counter)}`,
      password: MEMBER_PASSWORD,
    };
  };

  const rowOf = async (administratorId: number): Promise<AdministratorRow> => {
    const rows = await server.app.get(TransactionalConnection).rawConnection.query<AdministratorRow[]>(
      `SELECT a."customFieldsBusinessid" AS "businessId", a."deletedAt" AS "deletedAt",
              (SELECT count(*)::int FROM user_roles_role r WHERE r."userId" = a."userId") AS "roleCount"
         FROM administrator a WHERE a.id = $1`,
      [administratorId],
    );
    const [row] = rows;
    if (row === undefined) throw new Error(`administrator ${String(administratorId)} not found`);
    return row;
  };

  const ownerIdOf = async (business: BusinessFixture): Promise<number> => {
    const rows = await server.app
      .get(TransactionalConnection)
      .rawConnection.query<{ id: number }[]>('SELECT id FROM administrator WHERE "emailAddress" = $1', [
        business.owner.email,
      ]);
    const [row] = rows;
    if (row === undefined) throw new Error(`owner of ${business.businessId} not found`);
    return row.id;
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates an administrator of the business with no role', async () => {
    // Arrange
    const command = commandFor(businesses.a);

    // Act
    const account = await service().create(await anonymous(), command);

    // Assert
    expect(await rowOf(account.administratorId)).toEqual({
      businessId: businesses.a.businessId,
      deletedAt: null,
      roleCount: 0,
    });
    expect(account.userId).toBeGreaterThan(0);
  });

  it('lets the new administrator sign in with the password', async () => {
    // Arrange
    const command = commandFor(businesses.a);
    await service().create(await anonymous(), command);

    // Act
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    const { login } = await adminClient.query<{ login: { __typename: string } }>(LOGIN, {
      username: command.emailAddress,
      password: MEMBER_PASSWORD,
    });

    // Assert
    expect(login.__typename).toBe('CurrentUser');
    await adminClient.asSuperAdmin();
  });

  it('refuses an email address another administrator holds, in any business', async () => {
    // Arrange
    const taken = businesses.b.owner.email;

    // Act
    const creating = service().create(await anonymous(), commandFor(businesses.a, taken));

    // Assert
    await expect(creating).rejects.toBeInstanceOf(MemberEmailTakenError);
  });

  it('soft-deletes a member of the business', async () => {
    // Arrange
    const { administratorId } = await service().create(await anonymous(), commandFor(businesses.a));

    // Act
    await service().softDelete(await anonymous(), toSnowflake(businesses.a.businessId), administratorId);

    // Assert
    expect((await rowOf(administratorId)).deletedAt).not.toBeNull();
  });

  it("refuses to soft-delete another business's administrator and leaves it intact", async () => {
    // Arrange
    const { administratorId } = await service().create(await anonymous(), commandFor(businesses.b));

    // Act
    const deleting = service().softDelete(await anonymous(), toSnowflake(businesses.a.businessId), administratorId);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(MemberNotInBusinessError);
    expect((await rowOf(administratorId)).deletedAt).toBeNull();
  });

  it('refuses to soft-delete the business owner', async () => {
    // Arrange
    const ownerId = await ownerIdOf(businesses.a);

    // Act
    const deleting = service().softDelete(await anonymous(), toSnowflake(businesses.a.businessId), ownerId);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(BusinessOwnerProtectedError);
    expect((await rowOf(ownerId)).deletedAt).toBeNull();
  });

  it('reads the profiles of live administrators of the business only', async () => {
    // Arrange
    const ownerOfA = await ownerIdOf(businesses.a);
    const ownerOfB = await ownerIdOf(businesses.b);
    const deleted = await service().create(await anonymous(), commandFor(businesses.a));
    await service().softDelete(await anonymous(), toSnowflake(businesses.a.businessId), deleted.administratorId);

    // Act
    const profiles = await service().profilesOf(await anonymous(), toSnowflake(businesses.a.businessId), [
      ownerOfA,
      ownerOfB,
      deleted.administratorId,
    ]);

    // Assert
    expect(profiles).toEqual([
      {
        administratorId: ownerOfA,
        businessId: businesses.a.businessId,
        emailAddress: businesses.a.owner.email,
        firstName: 'a',
        lastName: 'Owner',
      },
    ]);
  });
});
