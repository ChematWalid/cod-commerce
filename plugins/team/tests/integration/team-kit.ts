import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { BuiltInRoleKey } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  createPluginTestEnvironment,
  type CredentialsFixture,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  type StoreFixture,
} from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection, type VendureConfig } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { TeamPlugin } from '../../index';
import { EchoTemplates } from '../fakes/echo-templates';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const DEFAULT_MAILPIT_SMTP_PORT = 1026;
/** The header tests name the client address with, so one process can act as many addresses. */
export const TEST_CLIENT_IP_HEADER = 'x-test-client-ip';
/** The dashboard invitation links point at. */
export const TEST_DASHBOARD_URL = 'http://localhost:3100/dashboard';
/** Synthetic: every member a test creates signs in with it, and invitees choose it. */
export const MEMBER_PASSWORD = 'synthetic-member-password';
const CREATE_ROLE = gql`
  mutation ($input: CreateBusinessRoleInput!) {
    createBusinessRole(input: $input) {
      id
    }
  }
`;
const SET_ACCESS = gql`
  mutation ($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      administratorId
    }
  }
`;

/** The options auth runs with in these tests: mail to the compose Mailpit, rendered by {@link EchoTemplates}. */
export function authTestOptions() {
  return {
    // A placeholder test key, as auth's own integration tests use; it signs nothing real.
    tokenSecret: 'integration-test-only-secret-0000000000',
    email: {
      smtp: {
        host: 'localhost',
        port: Number(process.env['MAILPIT_SMTP_HOST_PORT'] ?? DEFAULT_MAILPIT_SMTP_PORT),
        from: 'no-reply@localhost',
        tls: 'none' as const,
      },
      templates: new EchoTemplates(),
    },
    dashboardUrl: TEST_DASHBOARD_URL,
    platformDomain: 'shops.example.test',
  };
}

/**
 * A Vendure test server with Team and what it depends on. `foreign` holds rbac's and auth's modules: only a test file
 * may import another plugin's entry point (architecture rule `no-cross-plugin-internals`), so the test file passes them.
 */
export function createTeamTestEnvironment(
  snowflakeWorkerId: number,
  foreign: NonNullable<VendureConfig['plugins']>,
): ReturnType<typeof createPluginTestEnvironment> {
  return createPluginTestEnvironment({
    plugins: [
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: TEST_CLIENT_IP_HEADER }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      ...foreign,
      TeamPlugin.init({ dashboardUrl: TEST_DASHBOARD_URL }),
    ],
    db: loadPluginTestDbConfig(process.env),
  });
}

/** A fresh address no other test or run uses, so its Mailpit mailbox starts empty. */
export const freshEmail = (label: string): string => `${label}-${randomBytes(4).toString('hex')}@example.test`;

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
}

/** A public REST call: no session, a client address of the test's choosing, a language. */
export interface PublicCall {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: unknown;
  readonly ip?: string;
  readonly language?: 'ar' | 'en';
}

const parsed = async (response: Response): Promise<RestAnswer> => {
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text === '' ? null : (JSON.parse(text) as unknown),
  };
};

/** The server, its Admin API client and the reads and writes the Team tests arrange with. */
export class TeamKit {
  constructor(
    private readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  private get connection() {
    return this.app.get(TransactionalConnection).rawConnection;
  }

  private baseUrl(): string {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  }

  /** Test-only direct SQL (the test files are outside the data access gate). */
  query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    return this.connection.query<T[]>(sql, [...parameters]);
  }

  async administratorIdOf(email: string): Promise<number> {
    const [row] = await this.query<{ id: number }>('SELECT id FROM administrator WHERE "emailAddress" = $1', [email]);
    if (row === undefined) throw new Error(`no administrator ${email}`);
    return row.id;
  }

  async builtInRoleId(business: BusinessFixture, key: BuiltInRoleKey): Promise<string> {
    const [row] = await this.query<{ id: string }>(
      'SELECT id FROM business_role WHERE "businessId" = $1 AND "builtInKey" = $2',
      [business.businessId, key],
    );
    if (row === undefined) throw new Error(`no ${key} role in ${business.businessId}`);
    return row.id;
  }

  /** A custom role of the business holding `grants` on every store, made by its owner through rbac's API. */
  async customRole(business: BusinessFixture, grants: readonly string[]): Promise<string> {
    await this.signIn(business.owner, business.stores[0]);
    const { createBusinessRole } = await this.client.query<{ createBusinessRole: { id: string } }>(CREATE_ROLE, {
      input: { name: `Role ${randomBytes(3).toString('hex')}`, grants },
    });
    return createBusinessRole.id;
  }

  /**
   * A member of the business holding `roleId` on `stores` (every store when omitted), granted by its owner through
   * rbac's API. Leaves the client signed in as that owner.
   */
  async memberWith(
    business: BusinessFixture,
    roleId: string,
    stores?: readonly StoreFixture[],
  ): Promise<CredentialsFixture & { administratorId: number }> {
    const code = `m-${randomBytes(4).toString('hex')}`;
    const credentials = await createMember(this.app, this.client, {
      code,
      business,
      store: business.stores[0],
      permissions: [],
    });
    const administratorId = await this.administratorIdOf(credentials.email);
    await this.signIn(business.owner, business.stores[0]);
    await this.client.query(SET_ACCESS, {
      input: {
        administratorId: String(administratorId),
        roleIds: [roleId],
        storeAccess: stores === undefined ? 'all' : 'selected',
        storeIds: stores?.map((store) => store.id) ?? [],
      },
    });
    return { ...credentials, administratorId };
  }

  /** Signs in as `credentials` and makes `store` the channel of the following calls. */
  async signIn(credentials: CredentialsFixture, store: StoreFixture): Promise<void> {
    this.client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await this.client.asUserWithCredentials(credentials.email, credentials.password);
    this.client.setChannelToken(store.channelToken);
  }

  /** A REST call with the client's session and channel; a body goes as JSON. */
  async rest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<RestAnswer> {
    const init = { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    return parsed(await this.client.fetch(`${this.baseUrl()}${path}`, init));
  }

  /** A REST call with no session, as the invitee's browser makes it. */
  async publicRest({ method, path, body, ip = '203.0.113.10', language = 'en' }: PublicCall): Promise<RestAnswer> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'accept-language': language, [TEST_CLIENT_IP_HEADER]: ip },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return parsed(response);
  }
}
