import { randomUUID } from 'node:crypto';
import { RESET_TOKEN_TTL_MS } from '@cod/shared';
import { Administrator, RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AUTH_TOKEN_HEADER, type Caller } from './login-test-client';
import { createOAuthTestKit, facebookProfile, googleProfile } from './oauth-test-kit';
import { inputFor, uniqueEmail, uniqueIp } from './register-test-kit';

const RESET = `mutation ($t: String!, $p: String!) {
  resetPassword(token: $t, password: $p) { __typename ... on CurrentUser { identifier } }
}`;
const NEW_PASSWORD = 'synthetic-victim-password';

const kit = createOAuthTestKit();
const { client, server, signInThrough, authenticate, registerWithTicket, methodsOfSubject } = kit;

beforeAll(kit.start);

afterAll(kit.stop);

/** Signs up through a provider with `email` in the form, and returns the session that opens. */
async function signUp(profile: ReturnType<typeof googleProfile>, provider: string, email: string): Promise<Caller> {
  const run = await signInThrough(provider, profile);
  const answer = await registerWithTicket(
    inputFor({ email, password: undefined, oauthTicket: run.ticket }),
    run.browser,
  );
  const signedIn = await authenticate(answer.data?.['registerMerchant']?.['signInTicket'] as string, run.browser);
  return { token: signedIn.headers.get(AUTH_TOKEN_HEADER) ?? '', ip: uniqueIp() };
}

/** What the emailed reset link holds; the mail itself is not what is under test. */
async function resetPasswordOf(email: string): Promise<void> {
  const administrator = await server.app
    .get(TransactionalConnection)
    .rawConnection.getRepository(Administrator)
    .findOneOrFail({ where: { emailAddress: email }, relations: { user: true } });
  const { token } = await server.app
    .get(AccountTokenService)
    .issue(RequestContext.empty() as unknown as OperationContext, {
      userId: administrator.user.id as number,
      purpose: 'password-reset',
      ttlMs: RESET_TOKEN_TTL_MS,
    });
  await client.graphql(RESET, { t: token, p: NEW_PASSWORD }, { ip: uniqueIp() });
}

describe('an account pre-registered through a provider with someone else`s email', () => {
  it('loses the attacker`s link, sessions and pending tickets when the owner resets', async () => {
    // Arrange
    const victim = uniqueEmail();
    const subject = randomUUID();
    const attackerSession = await signUp(facebookProfile(undefined, subject), 'facebook', victim);
    const pending = await signInThrough('facebook', facebookProfile(undefined, subject));

    // Act
    await resetPasswordOf(victim);
    const pendingAnswer = await authenticate(pending.ticket ?? '', pending.browser);
    const comeback = await signInThrough('facebook', facebookProfile(undefined, subject));

    // Assert
    expect(await methodsOfSubject('facebook', subject)).toHaveLength(0);
    expect(await client.me(attackerSession)).not.toBe(victim);
    expect(pendingAnswer.data?.['authenticate']?.['authenticationError']).toBe('auth.invalid-token');
    expect(comeback.page).toBe('/dashboard/register');
    expect((await client.login(victim, NEW_PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it('keeps the link of an account whose email was already proven', async () => {
    // Arrange
    const email = uniqueEmail();
    const subject = randomUUID();
    await signUp(googleProfile(email, true, subject), 'google', email);

    // Act
    await resetPasswordOf(email);
    const run = await signInThrough('google', googleProfile(email, true, subject));

    // Assert
    expect(await methodsOfSubject('google', subject)).toHaveLength(1);
    expect(run.page).toBe('/dashboard/oauth-complete');
  });
});
