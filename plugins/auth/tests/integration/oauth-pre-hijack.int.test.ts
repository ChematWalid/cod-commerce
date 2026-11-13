import { randomUUID } from 'node:crypto';
import { RESET_TOKEN_TTL_MS } from '@cod/shared';
import { Administrator, RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AUTH_TOKEN_HEADER, type Caller } from './login-test-client';
import { waitForMessages } from './mailpit';
import { createOAuthTestKit, facebookProfile, googleProfile } from './oauth-test-kit';
import { inputFor, PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const RESET = `mutation ($t: String!, $p: String!) {
  resetPassword(token: $t, password: $p) { __typename ... on CurrentUser { identifier } }
}`;
const VERIFY = `mutation ($t: String!) { verifyEmail(token: $t) { success } }`;
const NEW_PASSWORD = 'synthetic-victim-password';
const PROVIDER_LINKED_KIND = 'provider-linked';
/** The verification mail and the provider-linked notice. */
const MAILS_AFTER_FIRST_LINK = 2;

const kit = createOAuthTestKit();
const { client, server, register, signInThrough, authenticate, registerWithTicket, methodsOfSubject } = kit;

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

/** Clicks the link of the verification mail, as the owner of the mailbox does. */
async function verifyByLink(email: string): Promise<void> {
  const [verification] = await waitForMessages(email, 1);
  const token = /token=([\w-]+)/.exec(verification?.Text ?? '')?.[1] ?? '';
  await client.graphql(VERIFY, { t: token }, { ip: uniqueIp() });
}

/** Signs in through Google with the account's address and returns the session that opens. */
async function signInWithGoogle(email: string, subject: string): Promise<Caller> {
  const run = await signInThrough('google', googleProfile(email, true, subject));
  const signedIn = await authenticate(run.ticket ?? '', run.browser);
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

  it('loses the attacker`s link on a reset made after the owner verified the email', async () => {
    // Arrange
    const victim = uniqueEmail();
    const subject = randomUUID();
    await signUp(facebookProfile(undefined, subject), 'facebook', victim);
    await verifyByLink(victim);

    // Act
    await resetPasswordOf(victim);
    const comeback = await signInThrough('facebook', facebookProfile(undefined, subject));

    // Assert
    expect(await methodsOfSubject('facebook', subject)).toHaveLength(0);
    expect(comeback.page).toBe('/dashboard/register');
    expect((await client.login(victim, NEW_PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it('drops the attacker`s Facebook link and password when the owner signs in with Google after verifying', async () => {
    // Arrange
    const victim = uniqueEmail();
    const attackerSubject = randomUUID();
    const attackerSession = await signUp(facebookProfile(undefined, attackerSubject), 'facebook', victim);
    await verifyByLink(victim);

    // Act
    const run = await signInThrough('google', googleProfile(victim, true));
    const signedIn = await authenticate(run.ticket ?? '', run.browser);
    const attackerComeback = await signInThrough('facebook', facebookProfile(undefined, attackerSubject));

    // Assert
    expect(signedIn.data?.['authenticate']?.['identifier']).toBe(victim);
    expect(await methodsOfSubject('facebook', attackerSubject)).toHaveLength(0);
    expect(await client.me(attackerSession)).not.toBe(victim);
    expect(attackerComeback.page).toBe('/dashboard/register');
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

describe('an account pre-registered with a password by someone else', () => {
  it('voids that password and its sessions on the owner`s first Google sign-in, and mails one notice', async () => {
    // Arrange
    const victim = uniqueEmail();
    await register(inputFor({ email: victim }));
    await verifyByLink(victim);
    const attacker = await client.login(victim, PASSWORD, { ip: uniqueIp() });
    const attackerSession: Caller = { token: attacker.token ?? '', ip: uniqueIp() };

    // Act
    const ownerSession = await signInWithGoogle(victim, randomUUID());
    const messages = await waitForMessages(victim, MAILS_AFTER_FIRST_LINK);

    // Assert
    expect(attacker.code).toBe('OK');
    expect(await client.me(ownerSession)).toBe(victim);
    expect(await client.me(attackerSession)).not.toBe(victim);
    expect((await client.login(victim, PASSWORD, { ip: uniqueIp() })).code).not.toBe('OK');
    expect(messages.filter((message) => message.Subject.includes(PROVIDER_LINKED_KIND))).toHaveLength(1);
  });

  it('voids nothing again on the owner`s next Google sign-in', async () => {
    // Arrange
    const victim = uniqueEmail();
    const subject = randomUUID();
    await register(inputFor({ email: victim }));
    await verifyByLink(victim);
    const firstSession = await signInWithGoogle(victim, subject);

    // Act
    const secondSession = await signInWithGoogle(victim, subject);
    const messages = await waitForMessages(victim, MAILS_AFTER_FIRST_LINK);

    // Assert
    expect(await client.me(firstSession)).toBe(victim);
    expect(await client.me(secondSession)).toBe(victim);
    expect(messages.filter((message) => message.Subject.includes(PROVIDER_LINKED_KIND))).toHaveLength(1);
  });

  it('can set a password again through a reset after the link', async () => {
    // Arrange
    const victim = uniqueEmail();
    await register(inputFor({ email: victim }));
    await verifyByLink(victim);
    await signInWithGoogle(victim, randomUUID());

    // Act
    await resetPasswordOf(victim);

    // Assert
    expect((await client.login(victim, NEW_PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });
});
