import type { BuiltInRoleKey, PermissionKey } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  type createPluginTestEnvironment,
  type CredentialsFixture,
} from '@cod/testing';
import { Administrator, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';

const BUSINESS_ROLES = gql`
  query {
    businessRoles {
      id
      builtInKey
    }
  }
`;

const CREATE_BUSINESS_ROLE = gql`
  mutation ($input: CreateBusinessRoleInput!) {
    createBusinessRole(input: $input) {
      id
    }
  }
`;

const SET_MEMBER_ACCESS = gql`
  mutation ($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      administratorId
    }
  }
`;

/** The Admin API client of a plugin test server. */
type AdminClient = ReturnType<typeof createPluginTestEnvironment>['adminClient'];

/** The part of the Nest application these helpers use. */
interface AppWithConnection {
  get(token: typeof TransactionalConnection): TransactionalConnection;
}

/** The business role a member is given: one of the seven built-ins, or a custom role holding exactly `grants`. */
export type MemberRole =
  { readonly builtIn: BuiltInRoleKey } | { readonly name: string; readonly grants: readonly PermissionKey[] };

/**
 * Members of one business whose permissions come from a business role alone, granted by the owner through the
 * rbac API as a merchant would. A raw Vendure role holding a plugin permission is a state production cannot reach.
 */
export class NoteMembers {
  constructor(
    private readonly app: AppWithConnection,
    private readonly client: AdminClient,
    private readonly business: BusinessFixture,
  ) {}

  async asOwner(): Promise<void> {
    this.client.setChannelToken(this.business.stores[0].channelToken);
    await this.client.asUserWithCredentials(this.business.owner.email, this.business.owner.password);
  }

  /** Signs in as a new member holding `role` on every store of the business. */
  async signInWith(code: string, role: MemberRole): Promise<void> {
    const member = await this.newMember(code);
    await this.asOwner();
    await this.client.query(SET_MEMBER_ACCESS, {
      input: { administratorId: await this.idOf(member), roleIds: [await this.roleId(role)], storeAccess: 'all' },
    });
    await this.client.asUserWithCredentials(member.email, member.password);
  }

  /**
   * No API creates a member before the invitations session (P1.S4), so the administrator row comes from the
   * fixture, with a role that grants nothing. `setMemberAccess` then replaces that role with the business role's.
   */
  private newMember(code: string): Promise<CredentialsFixture> {
    const [store] = this.business.stores;
    return createMember(this.app, this.client, { code, business: this.business, store, permissions: [] });
  }

  private async idOf(member: CredentialsFixture): Promise<string> {
    const administrators = this.app.get(TransactionalConnection).rawConnection.getRepository(Administrator);
    return String((await administrators.findOneByOrFail({ emailAddress: member.email })).id);
  }

  /** Called as the owner. */
  private async roleId(role: MemberRole): Promise<string> {
    if ('builtIn' in role) {
      const { businessRoles } = await this.client.query<{
        businessRoles: readonly { readonly id: string; readonly builtInKey: string | null }[];
      }>(BUSINESS_ROLES);
      const found = businessRoles.find((candidate) => candidate.builtInKey === role.builtIn);
      if (found === undefined) throw new Error(`The business has no built-in role ${role.builtIn}`);
      return found.id;
    }
    const { createBusinessRole } = await this.client.query<{ createBusinessRole: { readonly id: string } }>(
      CREATE_BUSINESS_ROLE,
      { input: { name: role.name, grants: role.grants } },
    );
    return createBusinessRole.id;
  }
}
