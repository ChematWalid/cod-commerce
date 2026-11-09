import { AUTH_ERROR_CODES } from '@cod/shared';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import type { Caller } from './login-test-client';
import { PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const NEW_PASSWORD = 'synthetic-replacement-password';
const CHANGE = `mutation ($current: String!, $next: String!) {
  updateCustomerPassword(currentPassword: $current, newPassword: $next) {
    ... on Success { success }
    ... on ErrorResult { errorCode }
  }
}`;
const SHOP_LOGIN = `mutation ($email: String!, $password: String!) {
  login(username: $email, password: $password) { ... on CurrentUser { identifier } ... on ErrorResult { errorCode } }
}`;
const CREATE_CUSTOMER = gql`
  mutation ($input: CreateCustomerInput!, $password: String!) {
    createCustomer(input: $input, password: $password) {
      ... on Customer {
        id
      }
    }
  }
`;

const kit = createAccountFlowKit();
const { client } = kit;

interface ShopAnswer {
  readonly data: Record<string, Record<string, unknown> | null> | null;
  readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[];
}

async function shop(
  query: string,
  variables: object,
  caller: Caller,
): Promise<{ body: ShopAnswer; token: string | null }> {
  const response = await client.rest('/shop-api', { query, variables }, caller);
  return { body: (await response.json()) as ShopAnswer, token: response.headers.get('vendure-auth-token') };
}

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('Shop API updateCustomerPassword (D21)', () => {
  it('refuses an administrator and changes nothing', async () => {
    // Arrange
    const { email, session } = await kit.owner();

    // Act
    const { body } = await shop(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, session);

    // Assert
    expect(body.errors?.[0]?.extensions?.code).toBe(AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY);
    expect((await client.login(email, PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it("still changes a customer's password", async () => {
    // Arrange
    const email = uniqueEmail();
    await kit.adminClient.asSuperAdmin();
    await kit.adminClient.query(CREATE_CUSTOMER, {
      input: { emailAddress: email, firstName: 'Amel', lastName: 'Buyer' },
      password: PASSWORD,
    });
    const { token } = await shop(SHOP_LOGIN, { email, password: PASSWORD }, { ip: uniqueIp() });

    // Act
    const { body } = await shop(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, { token: token ?? '' });
    const relogin = await shop(SHOP_LOGIN, { email, password: NEW_PASSWORD }, { ip: uniqueIp() });

    // Assert
    expect(body.data?.['updateCustomerPassword']).toEqual({ success: true });
    expect(relogin.body.data?.['login']).toEqual({ identifier: email });
  });

  it('refuses an anonymous caller', async () => {
    // Act
    const { body } = await shop(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, {});

    // Assert
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
