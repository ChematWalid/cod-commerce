import { EventBus, PasswordResetEvent } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const FORGOT = `mutation ($email: String!) {
  requestPasswordReset(emailAddress: $email) { ... on Success { success } ... on ErrorResult { errorCode } }
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
let events: PasswordResetEvent[] = [];
let subscription: ReturnType<ReturnType<EventBus['ofType']>['subscribe']>;

const forgot = async (email: string): Promise<{ status: number; body: string }> => {
  const response = await client.rest('/shop-api', { query: FORGOT, variables: { email } }, { ip: uniqueIp() });
  return { status: response.status, body: await response.text() };
};

const stockToken = async (email: string): Promise<string | null | undefined> => {
  const rows = await kit.sql<{ passwordResetToken: string | null }>(
    `SELECT m."passwordResetToken" FROM "authentication_method" m JOIN "user" u ON u."id" = m."userId"
     WHERE u."identifier" = $1`,
    [email],
  );
  return rows[0]?.passwordResetToken;
};

beforeAll(async () => {
  await kit.start();
  subscription = kit.server.app
    .get(EventBus)
    .ofType(PasswordResetEvent)
    .subscribe((event) => {
      events.push(event);
    });
});

beforeEach(() => {
  events = [];
});

afterAll(async () => {
  subscription.unsubscribe();
  await kit.server.destroy();
});

describe('Shop API requestPasswordReset (D21)', () => {
  it('answers an administrator email exactly as an unknown one, with no token and no event', async () => {
    // Arrange
    const { email } = await kit.owner();

    // Act
    const administrator = await forgot(`  ${email.toUpperCase()} `);
    const unknown = await forgot(uniqueEmail());

    // Assert
    expect(administrator).toEqual(unknown);
    expect(administrator.body).toContain('"success":true');
    expect(await stockToken(email)).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('keeps the stock reset for a customer', async () => {
    // Arrange
    const email = uniqueEmail();
    await kit.adminClient.asSuperAdmin();
    await kit.adminClient.query(CREATE_CUSTOMER, {
      input: { emailAddress: email, firstName: 'Amel', lastName: 'Buyer' },
      password: PASSWORD,
    });

    // Act
    const answer = await forgot(email);

    // Assert
    expect(answer.body).toContain('"success":true');
    expect(await stockToken(email)).not.toBeNull();
    expect(events).toHaveLength(1);
  });
});
