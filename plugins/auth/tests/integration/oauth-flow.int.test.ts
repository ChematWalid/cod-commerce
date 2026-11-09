import { randomUUID } from 'node:crypto';
import { Administrator, TransactionalConnection, User } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { facebookProfile, googleProfile, createOAuthTestKit, type OAuthRun } from './oauth-test-kit';
import { createTestAdministrator } from './create-test-administrator';
import { codeOf, inputFor, PASSWORD, uniqueEmail } from './register-test-kit';

const LINK_REFUSED = 'auth.oauth-link-requires-verification';
const EMAIL_UNCONFIRMED = 'auth.oauth-email-unconfirmed';

const kit = createOAuthTestKit();
const { server, signInThrough, authenticate, registerWithTicket, register, methodsOfSubject } = kit;

beforeAll(kit.start);

afterAll(kit.stop);

const repository = <T extends object>(entity: new () => T) =>
  server.app.get(TransactionalConnection).rawConnection.getRepository(entity);

const administratorOf = async (email: string): Promise<Administrator> =>
  repository(Administrator).findOneOrFail({ where: { emailAddress: email }, relations: { user: true } });

const verifiedAtOf = async (email: string): Promise<Date | null> =>
  ((await administratorOf(email)).customFields as unknown as { emailVerifiedAt: Date | null }).emailVerifiedAt;

async function markVerified(email: string): Promise<void> {
  const administrator = await administratorOf(email);
  await repository(Administrator).update({ id: administrator.id }, { customFields: { emailVerifiedAt: new Date() } });
}

async function registeredAccount(verified: boolean): Promise<string> {
  const input = inputFor();
  await register(input);
  const email = input['email'] as string;
  if (verified) {
    await markVerified(email);
  }
  return email;
}

const nameOf = (answer: Awaited<ReturnType<typeof authenticate>>): unknown =>
  answer.data?.['authenticate']?.['identifier'];

/** Signs a new identity up through the wizard's call, and returns the account's email. */
async function oauthAccount(run: OAuthRun, email: string): Promise<void> {
  const answer = await registerWithTicket(
    inputFor({ email, password: undefined, oauthTicket: run.ticket }),
    run.browser,
  );
  expect(answer.errors).toEqual([]);
}

describe('a new identity', () => {
  it.each([
    ['google', (email: string) => googleProfile(email)],
    ['facebook', (email: string) => facebookProfile(email)],
  ] as const)('gets a ticket from %s and finishes registration with no password', async (provider, profile) => {
    // Arrange
    const email = uniqueEmail();
    const run = await signInThrough(provider, profile(email));

    // Act
    const answer = await registerWithTicket(
      inputFor({ email, password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );
    const result = answer.data?.['registerMerchant'];
    const signedIn = await authenticate(result?.['signInTicket'] as string, run.browser);

    // Assert
    expect(run.page).toBe('/dashboard/register');
    expect(answer.errors).toEqual([]);
    expect(nameOf(signedIn)).toBe(email);
    expect(signedIn.headers.get(AUTH_TOKEN_HEADER)).toBeTruthy();
  });

  it('marks the email verified when the provider confirmed it, and sends no mail', async () => {
    // Arrange
    const email = uniqueEmail();
    const run = await signInThrough('google', googleProfile(email));

    // Act
    const answer = await registerWithTicket(
      inputFor({ email: uniqueEmail(), password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );

    // Assert
    expect(answer.data?.['registerMerchant']?.['verificationEmailSent']).toBe(false);
    expect(await verifiedAtOf(email)).not.toBeNull();
  });

  it('leaves the email unverified when the provider did not confirm it', async () => {
    // Arrange
    const email = uniqueEmail();
    const run = await signInThrough('google', googleProfile(email, false));

    // Act
    const answer = await registerWithTicket(
      inputFor({ email, password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );

    // Assert
    expect(answer.data?.['registerMerchant']?.['verificationEmailSent']).toBe(true);
    expect(await verifiedAtOf(email)).toBeNull();
  });

  it('stores the subject as an external authentication method', async () => {
    // Arrange
    const email = uniqueEmail();
    const subject = randomUUID();
    const run = await signInThrough('google', googleProfile(email, true, subject));

    // Act
    await oauthAccount(run, email);

    // Assert
    expect(await methodsOfSubject('google', subject)).toHaveLength(1);
  });

  it('asks for a typed email when the provider has none', async () => {
    // Arrange
    const email = uniqueEmail();
    const run = await signInThrough('facebook', facebookProfile(undefined));

    // Act
    const answer = await registerWithTicket(
      inputFor({ email, password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );

    // Assert
    expect(answer.errors).toEqual([]);
    expect(await verifiedAtOf(email)).toBeNull();
  });

  it('does not take a provider`s confirmation without an address for the typed email', async () => {
    // Arrange
    const email = uniqueEmail();
    const profile = { sub: randomUUID(), email_verified: true, given_name: 'Sara', family_name: 'Owner' };
    const run = await signInThrough('google', profile);

    // Act
    const answer = await registerWithTicket(
      inputFor({ email, password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );

    // Assert
    expect(answer.errors).toEqual([]);
    expect(answer.data?.['registerMerchant']?.['verificationEmailSent']).toBe(true);
    expect(await verifiedAtOf(email)).toBeNull();
  });

  it('refuses a ticket registration whose subject was linked meanwhile', async () => {
    // Arrange
    const subject = randomUUID();
    const first = await signInThrough('facebook', facebookProfile(undefined, subject));
    const second = await signInThrough('facebook', facebookProfile(undefined, subject));
    await oauthAccount(first, uniqueEmail());

    // Act
    const answer = await registerWithTicket(
      inputFor({ password: undefined, oauthTicket: second.ticket }),
      second.browser,
    );

    // Assert
    expect(codeOf(answer)).toBe('auth.invalid-token');
    expect(await methodsOfSubject('facebook', subject)).toHaveLength(1);
  });
});

describe('an existing account', () => {
  it('links to a verified account and signs in', async () => {
    // Arrange
    const email = await registeredAccount(true);
    const subject = randomUUID();

    // Act
    const run = await signInThrough('google', googleProfile(email, true, subject));
    const signedIn = await authenticate(run.ticket ?? '', run.browser);

    // Assert
    expect(run.page).toBe('/dashboard/oauth-complete');
    expect(nameOf(signedIn)).toBe(email);
    expect(await methodsOfSubject('google', subject)).toHaveLength(1);
  });

  it('refuses to link an unverified account', async () => {
    // Arrange
    const email = await registeredAccount(false);
    const subject = randomUUID();

    // Act
    const run = await signInThrough('google', googleProfile(email, true, subject));

    // Assert
    expect(run.error).toBe(LINK_REFUSED);
    expect(run.ticket).toBeNull();
    expect(await methodsOfSubject('google', subject)).toHaveLength(0);
  });

  it('refuses to link when the provider did not confirm the email', async () => {
    // Arrange
    const email = await registeredAccount(true);
    const subject = randomUUID();

    // Act
    const run = await signInThrough('google', googleProfile(email, false, subject));

    // Assert
    expect(run.error).toBe(EMAIL_UNCONFIRMED);
    expect(await methodsOfSubject('google', subject)).toHaveLength(0);
  });

  it('never links through Facebook, whose API does not confirm an email', async () => {
    // Arrange
    const email = await registeredAccount(true);
    const subject = randomUUID();

    // Act
    const run = await signInThrough('facebook', facebookProfile(email, subject));

    // Assert
    expect(run.error).toBe(EMAIL_UNCONFIRMED);
    expect(await methodsOfSubject('facebook', subject)).toHaveLength(0);
  });

  it('never links a platform administrator', async () => {
    // Arrange
    const email = uniqueEmail();
    await createTestAdministrator(kit.adminClient, email, PASSWORD);
    await markVerified(email);

    // Act
    const run = await signInThrough('google', googleProfile(email));

    // Assert
    expect(run.error).toBe(LINK_REFUSED);
  });

  it.each([
    ['google', (email: string, subject: string) => googleProfile(email, true, subject)],
    ['facebook', (email: string, subject: string) => facebookProfile(email, subject)],
  ] as const)(
    'finds the same %s account on a second sign-in, even after the email changed',
    async (provider, profile) => {
      // Arrange
      const email = uniqueEmail();
      const changed = uniqueEmail();
      const subject = randomUUID();
      await oauthAccount(await signInThrough(provider, profile(email, subject)), email);
      const administrator = await administratorOf(email);
      await repository(Administrator).update({ id: administrator.id }, { emailAddress: changed });
      await repository(User).update({ id: administrator.user.id }, { identifier: changed });

      // Act
      const run = await signInThrough(provider, profile(uniqueEmail(), subject));
      const signedIn = await authenticate(run.ticket ?? '', run.browser);

      // Assert
      expect(run.page).toBe('/dashboard/oauth-complete');
      expect(nameOf(signedIn)).toBe(changed);
    },
  );
});
