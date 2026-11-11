import { RATE_LIMIT_POLICIES } from '@cod/plugin-rate-limit';
import { EventBus, PasswordResetEvent } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

/** Enough beyond the capacity for the bucket to stay empty while it refills. */
const LIMIT_MARGIN = 5;

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

  it('limits one address once the reset-ip bucket is empty', async () => {
    // Arrange
    const ip = uniqueIp();
    const tries = RATE_LIMIT_POLICIES['reset-ip'].capacity + LIMIT_MARGIN;
    const send = () => client.rest('/shop-api', { query: FORGOT, variables: { email: uniqueEmail() } }, { ip });

    // Act
    let last = await send();
    for (let index = 1; index < tries; index += 1) {
      last = await send();
    }
    const body = (await last.json()) as { errors?: { extensions?: { code?: string } }[] };

    // Assert
    expect(body.errors?.[0]?.extensions?.code).toBe('RATE_LIMITED');
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
    // The event reaches subscribers after the commit, which can be after the HTTP answer.
    await vi.waitFor(() => {
      expect(events).toHaveLength(1);
    });
  });
});
