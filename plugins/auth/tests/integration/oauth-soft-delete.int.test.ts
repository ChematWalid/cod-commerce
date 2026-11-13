import { randomUUID } from 'node:crypto';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_TOKEN_HEADER, type Caller } from './login-test-client';
import { createOAuthTestKit, facebookProfile, googleProfile } from './oauth-test-kit';
import { inputFor, uniqueEmail, uniqueIp } from './register-test-kit';
import type { ProviderProfile } from './fixtures/mock-oauth-server';

const DELETE_ADMINISTRATOR = gql`
  mutation ($id: ID!) {
    deleteAdministrator(id: $id) {
      result
    }
  }
`;

const kit = createOAuthTestKit();
const { adminClient, client, signInThrough, authenticate, registerWithTicket, methodsOfSubject, administratorsNamed } =
  kit;

beforeAll(kit.start);

afterAll(kit.stop);

/** Signs up through a provider with `email` in the form, and returns the session that opens. */
async function signUp(profile: ProviderProfile, provider: string, email: string): Promise<Caller> {
  const run = await signInThrough(provider, profile);
  const answer = await registerWithTicket(
    inputFor({ email, password: undefined, oauthTicket: run.ticket }),
    run.browser,
  );
  const signedIn = await authenticate(answer.data?.['registerMerchant']?.['signInTicket'] as string, run.browser);
  return { token: signedIn.headers.get(AUTH_TOKEN_HEADER) ?? '', ip: uniqueIp() };
}

/** Deletes the account the way platform staff do: the stock mutation, which soft-deletes administrator and user. */
async function softDeleteAccount(email: string): Promise<void> {
  const [administrator] = await administratorsNamed(email);
  await adminClient.asSuperAdmin();
  await adminClient.query(DELETE_ADMINISTRATOR, { id: administrator?.id });
}

describe('a provider sign-in after the account was soft-deleted', () => {
  it('is refused, opens no session and links nothing more to the deleted account', async () => {
    // Arrange
    const email = uniqueEmail();
    const subject = randomUUID();
    const session = await signUp(googleProfile(email, true, subject), 'google', email);
    await softDeleteAccount(email);

    // Act
    const comeback = await signInThrough('google', googleProfile(email, true, subject));
    const answer = await authenticate(comeback.ticket ?? '', comeback.browser);

    // Assert
    expect(comeback.page).toBe('/dashboard/register');
    expect(answer.data?.['authenticate']?.['authenticationError']).toBe('auth.invalid-token');
    expect(answer.headers.get(AUTH_TOKEN_HEADER)).toBeNull();
    expect(await client.me(session)).not.toBe(email);
    expect(await methodsOfSubject('google', subject)).toHaveLength(1);
  });

  it('signs in to the account registered again with the same provider login', async () => {
    // Arrange
    const subject = randomUUID();
    const deleted = uniqueEmail();
    const current = uniqueEmail();
    await signUp(facebookProfile(undefined, subject), 'facebook', deleted);
    await softDeleteAccount(deleted);
    await signUp(facebookProfile(undefined, subject), 'facebook', current);

    // Act
    const run = await signInThrough('facebook', facebookProfile(undefined, subject));
    const answer = await authenticate(run.ticket ?? '', run.browser);

    // Assert
    expect(run.page).toBe('/dashboard/oauth-complete');
    expect(answer.data?.['authenticate']?.['identifier']).toBe(current);
  });
});
