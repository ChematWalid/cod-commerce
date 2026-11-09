import { RESET_TOKEN_TTL_MS } from '@cod/shared';
import { Administrator, NativeAuthenticationMethod, RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { createOAuthTestKit, googleProfile } from './oauth-test-kit';
import { codeOf, inputFor, uniqueEmail, uniqueIp } from './register-test-kit';

const CHANGE_PASSWORD = `mutation ($c: String!, $n: String!) {
  changeAccountPassword(currentPassword: $c, newPassword: $n) { success }
}`;
const RESET = `mutation ($t: String!, $p: String!) {
  resetPassword(token: $t, password: $p) { __typename ... on CurrentUser { identifier } }
}`;
const NEW_PASSWORD = 'synthetic-new-password';

const kit = createOAuthTestKit();
const { client, server, signInThrough, authenticate, registerWithTicket, register } = kit;

beforeAll(kit.start);

afterAll(kit.stop);

const repository = <T extends object>(entity: new () => T) =>
  server.app.get(TransactionalConnection).rawConnection.getRepository(entity);

const administratorOf = async (email: string): Promise<Administrator> =>
  repository(Administrator).findOneOrFail({ where: { emailAddress: email }, relations: { user: true } });

describe('an account that signs in only through a provider', () => {
  async function oauthOnlyAccount(): Promise<{ email: string; bearer: { token: string; ip: string } }> {
    const email = uniqueEmail();
    const run = await signInThrough('google', googleProfile(email));
    const answer = await registerWithTicket(
      inputFor({ email, password: undefined, oauthTicket: run.ticket }),
      run.browser,
    );
    const signedIn = await authenticate(answer.data?.['registerMerchant']?.['signInTicket'] as string, run.browser);
    return { email, bearer: { token: signedIn.headers.get(AUTH_TOKEN_HEADER) ?? '', ip: uniqueIp() } };
  }

  async function issueResetToken(email: string): Promise<string> {
    const userId = (await administratorOf(email)).user.id as number;
    const ctx = RequestContext.empty() as unknown as OperationContext;
    const { token } = await server.app
      .get(AccountTokenService)
      .issue(ctx, { userId, purpose: 'password-reset', ttlMs: RESET_TOKEN_TTL_MS });
    return token;
  }

  const removeNativeLogin = async (email: string): Promise<void> => {
    const { user } = await administratorOf(email);
    await repository(NativeAuthenticationMethod).delete({ user: { id: user.id } });
  };

  it('cannot log in with a password it never chose', async () => {
    // Arrange
    const { email } = await oauthOnlyAccount();

    // Act
    const outcome = await client.login(email, 'synthetic-guess', { ip: uniqueIp() });

    // Assert
    expect(outcome.code).toBe('INVALID_CREDENTIALS_ERROR');
  });

  it.each([
    ['with the unusable password', async (): Promise<void> => {}],
    ['with no native login', removeNativeLogin],
  ])('answers a defined refusal to change password %s', async (_name, prepare) => {
    // Arrange
    const { email, bearer } = await oauthOnlyAccount();
    await prepare(email);

    // Act
    const answer = await client.graphql(CHANGE_PASSWORD, { c: 'synthetic-guess', n: NEW_PASSWORD }, bearer);

    // Assert
    expect(codeOf(answer)).toBe('auth.current-password-wrong');
  });

  it.each([
    ['with the unusable password', async (): Promise<void> => {}],
    ['with no native login', removeNativeLogin],
  ])('gains a password through reset %s', async (_name, prepare) => {
    // Arrange
    const { email } = await oauthOnlyAccount();
    await prepare(email);
    const token = await issueResetToken(email);

    // Act
    const answer = await client.graphql(RESET, { t: token, p: NEW_PASSWORD }, { ip: uniqueIp() });
    const login = await client.login(email, NEW_PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(answer.data?.['resetPassword']?.['identifier']).toBe(email);
    expect(login.code).toBe('OK');
  });

  it('holds its email against a password registration (D27)', async () => {
    // Arrange
    const { email } = await oauthOnlyAccount();

    // Act
    const answer = await register(inputFor({ email }));

    // Assert
    expect(codeOf(answer)).toBe('auth.email-taken');
  });
});
