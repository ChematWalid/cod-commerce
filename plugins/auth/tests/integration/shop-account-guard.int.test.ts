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
const REQUEST_EMAIL_CHANGE = `mutation ($password: String!, $email: String!) {
  requestUpdateCustomerEmailAddress(password: $password, newEmailAddress: $email) {
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

/** A customer with `PASSWORD`, signed in on the Shop API. */
async function customer(): Promise<{ email: string; session: Caller }> {
  const email = uniqueEmail();
  await kit.adminClient.asSuperAdmin();
  await kit.adminClient.query(CREATE_CUSTOMER, {
    input: { emailAddress: email, firstName: 'Amel', lastName: 'Buyer' },
    password: PASSWORD,
  });
  const { token } = await shop(SHOP_LOGIN, { email, password: PASSWORD }, { ip: uniqueIp() });
  return { email, session: { token: token ?? '' } };
}

const shopLoginAnswer = async (email: string, password: string): Promise<unknown> =>
  (await shop(SHOP_LOGIN, { email, password }, { ip: uniqueIp() })).body.data?.['login'];

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

  it('changes only the caller of a pair of customers', async () => {
    // Arrange
    const first = await customer();
    const second = await customer();

    // Act
    const { body } = await shop(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, first.session);

    // Assert
    expect(body.data?.['updateCustomerPassword']).toEqual({ success: true });
    expect(await shopLoginAnswer(first.email, NEW_PASSWORD)).toEqual({ identifier: first.email });
    expect(await shopLoginAnswer(first.email, PASSWORD)).toMatchObject({ errorCode: expect.any(String) as string });
    expect(await shopLoginAnswer(second.email, PASSWORD)).toEqual({ identifier: second.email });
    expect(await shopLoginAnswer(second.email, NEW_PASSWORD)).toMatchObject({
      errorCode: expect.any(String) as string,
    });
  });
});

describe('Shop API requestUpdateCustomerEmailAddress', () => {
  it.each([
    ['the right', PASSWORD],
    ['a wrong', 'synthetic-wrong-password'],
  ])('refuses an administrator with %s password in the same way', async (_label, password) => {
    // Arrange
    const { email, session } = await kit.owner();

    // Act
    const { body } = await shop(REQUEST_EMAIL_CHANGE, { password, email: uniqueEmail() }, session);

    // Assert
    expect(body.errors?.[0]?.extensions?.code).toBe(AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY);
    expect((await client.login(email, PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it('keeps the stock answers for a customer', async () => {
    // Arrange
    const { session } = await customer();

    // Act
    const wrong = await shop(
      REQUEST_EMAIL_CHANGE,
      { password: 'synthetic-wrong-password', email: uniqueEmail() },
      session,
    );
    const right = await shop(REQUEST_EMAIL_CHANGE, { password: PASSWORD, email: uniqueEmail() }, session);

    // Assert
    expect(wrong.body.data?.['requestUpdateCustomerEmailAddress']).toEqual({ errorCode: 'INVALID_CREDENTIALS_ERROR' });
    expect(right.body.data?.['requestUpdateCustomerEmailAddress']).toEqual({ success: true });
  });

  it('refuses an anonymous caller', async () => {
    // Act
    const { body } = await shop(REQUEST_EMAIL_CHANGE, { password: PASSWORD, email: uniqueEmail() }, {});

    // Assert
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
