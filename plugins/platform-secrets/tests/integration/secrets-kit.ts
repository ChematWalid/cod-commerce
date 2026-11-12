import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import type { BuiltInRoleKey, PermissionKey } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  type createPluginTestEnvironment,
  type CredentialsFixture,
} from '@cod/testing';
import { Administrator, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { parseKekRing } from '../../infrastructure/kek-ring';

/** Valkey for the tenancy and rate-limit plugins these tests boot with the secrets. */
export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** The job queues the rotation's rewrap jobs run on: the test strategy, no BullMQ pools. */
export const testJobsPlugin = (): typeof PlatformJobsPlugin =>
  PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-platform-secrets' });

/** The rate limiter a test host registers beside tenancy: on the same Valkey, with clients keyed by `req.ip`. */
export const testRateLimitPlugin = (): typeof RateLimitPlugin =>
  RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' });

/** Synthetic key ring: one kid, active. It protects nothing. */
export const TEST_KEKS = `k1:${'11'.repeat(32)}`;
export const testKekRing = (activeKid = 'k1') => parseKekRing(TEST_KEKS, activeKid);

/** A secret as the Admin API returns it. */
export interface SecretResult {
  readonly id: string;
  readonly provider: string;
  readonly ref: string;
  readonly last4: string | null;
  readonly updatedAt: string;
}

const FIELDS = 'id provider ref last4 updatedAt';

export const TENANT_SECRETS = gql`
  query {
    tenantSecrets { ${FIELDS} }
  }
`;

export const SET_TENANT_SECRET = gql`
  mutation ($input: SetTenantSecretInput!) {
    setTenantSecret(input: $input) { ${FIELDS} }
  }
`;

export const DELETE_TENANT_SECRET = gql`
  mutation ($id: String!) {
    deleteTenantSecret(id: $id)
  }
`;

/** Synthetic values: long enough to carry a last4, and recognisable if one ever reaches a log. */
export const PLAINTEXT_ONE = 'synthetic-plaintext-AAAA-1111';
export const PLAINTEXT_TWO = 'synthetic-plaintext-BBBB-2222';

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

type AdminClient = ReturnType<typeof createPluginTestEnvironment>['adminClient'];

interface AppWithConnection {
  get(token: typeof TransactionalConnection): TransactionalConnection;
}

/** The business role a member is given: a built-in one, or a custom role holding exactly `grants`. */
export type MemberRole =
  { readonly builtIn: BuiltInRoleKey } | { readonly name: string; readonly grants: readonly PermissionKey[] };

/**
 * Members of one business whose permissions come from a business role alone, granted by the owner through the rbac
 * API as a merchant would. A raw Vendure role holding a plugin permission is a state production cannot reach.
 */
export class SecretMembers {
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
    const [store] = this.business.stores;
    const member = await createMember(this.app, this.client, { code, business: this.business, store, permissions: [] });
    await this.asOwner();
    await this.client.query(SET_MEMBER_ACCESS, {
      input: { administratorId: await this.idOf(member), roleIds: [await this.roleId(role)], storeAccess: 'all' },
    });
    await this.client.asUserWithCredentials(member.email, member.password);
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
