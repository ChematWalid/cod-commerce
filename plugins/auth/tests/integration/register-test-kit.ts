import { randomUUID } from 'node:crypto';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { Administrator, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import type { AuthOAuthOptions } from '../../auth.plugin';
import { createAuthTestEnvironment } from './auth-test-environment';
import { type GraphqlAnswer, LoginTestClient } from './login-test-client';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const REGISTER = `mutation ($input: RegisterMerchantInput!) {
  registerMerchant(input: $input) { businessId storeId verificationEmailSent }
}`;
const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;
const COUNTED_TABLES = [
  'user',
  'administrator',
  'business',
  'store',
  'channel',
  'seller',
  'role',
  'authentication_method',
  'account_token',
];

export const PASSWORD = 'synthetic-owner-password';

const unique = (): string => randomUUID().replaceAll('-', '').slice(0, 12);

/** A fresh synthetic address, or the limiter's count from an earlier run would carry over. */
export const uniqueIp = (): string =>
  [0, 2, 4, 6]
    .map((start) =>
      parseInt(
        randomUUID()
          .replaceAll('-', '')
          .slice(start, start + 2),
        16,
      ),
    )
    .join('.');

/** A valid registration with names of its own. */
export function inputFor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const slug = `s${unique()}`;
  return {
    email: `${slug}@example.test`,
    password: PASSWORD,
    firstName: 'Sara',
    lastName: 'Owner',
    businessName: `${slug} SARL`,
    storeName: `${slug} store`,
    subdomain: slug,
    storeLanguage: 'ar',
    emailLocale: 'ar',
    ...overrides,
  };
}

export const uniqueEmail = (): string => `s${unique()}@example.test`;
export const uniqueSubdomain = (): string => `s${unique()}`;

export const codeOf = (answer: GraphqlAnswer): string | undefined => answer.errors[0]?.extensions?.code;

/** One test server and what the registration tests do with it. */
export interface RegisterTestKit {
  readonly server: ReturnType<typeof createAuthTestEnvironment>['server'];
  readonly adminClient: ReturnType<typeof createAuthTestEnvironment>['adminClient'];
  readonly client: LoginTestClient;
  readonly register: (input: Record<string, unknown>, ip?: string) => Promise<GraphqlAnswer>;
  readonly counts: () => Promise<Record<string, number>>;
  readonly administratorsNamed: (email: string) => Promise<Administrator[]>;
  readonly start: () => Promise<void>;
}

/** Builds the {@link RegisterTestKit} of a test file. */
export function createRegisterTestKit(
  environment: { readonly assets?: boolean; readonly oauth?: AuthOAuthOptions } = {},
): RegisterTestKit {
  const { server, adminClient } = createAuthTestEnvironment(TOKEN_SECRET, environment);
  const client = new LoginTestClient(() => server.app);

  const register = (input: Record<string, unknown>, ip = uniqueIp()): Promise<GraphqlAnswer> =>
    client.graphql(REGISTER, { input }, { ip });

  async function counts(): Promise<Record<string, number>> {
    const connection = server.app.get(TransactionalConnection).rawConnection;
    const rows = await Promise.all(
      COUNTED_TABLES.map(async (table) => {
        const [row] = await connection.query<{ count: string }[]>(`SELECT count(*) AS count FROM "${table}"`);
        return [table, Number(row?.count)] as const;
      }),
    );
    return Object.fromEntries(rows);
  }

  const administratorsNamed = (email: string): Promise<Administrator[]> =>
    server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(Administrator)
      .find({ where: { emailAddress: email }, relations: { user: { roles: { channels: true } } } });

  async function start(): Promise<void> {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
  }

  return { server, adminClient, client, register, counts, administratorsNamed, start };
}
