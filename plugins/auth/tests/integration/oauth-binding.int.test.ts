import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOAuthTestKit, googleProfile, type OAuthRun } from './oauth-test-kit';
import { codeOf, inputFor, uniqueEmail, uniqueIp } from './register-test-kit';

const OAUTH_FAILED = 'auth.oauth-failed';
const INVALID_TOKEN = 'auth.invalid-token';

const kit = createOAuthTestKit();
const { client, mock, startFlow, callback, signInThrough, authenticate, registerWithTicket, register } = kit;

beforeAll(kit.start);

afterAll(kit.stop);

/** One character of the sealed body changed: appending would only add bits the decoder drops. */
function tampered(state: string): string {
  const middle = Math.floor(state.length / 2);
  return `${state.slice(0, middle)}${state[middle] === 'A' ? 'B' : 'A'}${state.slice(middle + 1)}`;
}

const stranger = (): string => `cod_oauth_binding=${randomUUID()}`;

/** A callback for a new identity: its ticket belongs to the browser in `browser`. */
const newIdentityRun = (): Promise<OAuthRun> => signInThrough('google', googleProfile(uniqueEmail()));

/** A callback for a known account: the provider confirmed the email at sign-up, so the second visit finds it. */
async function existingAccountRun(): Promise<{ run: OAuthRun; email: string }> {
  const email = uniqueEmail();
  const subject = randomUUID();
  const first = await signInThrough('google', googleProfile(email, true, subject));
  await registerWithTicket(inputFor({ email, password: undefined, oauthTicket: first.ticket }), first.browser);
  return { run: await signInThrough('google', googleProfile(email, true, subject)), email };
}

describe('the start of the flow', () => {
  it('sends the browser to the provider with PKCE and an HttpOnly Lax cookie', async () => {
    // Act
    const flow = await startFlow('google');

    // Assert
    expect(flow.status).toBe(302);
    expect(flow.authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(flow.authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(flow.setCookie).toMatch(/HttpOnly/i);
    expect(flow.setCookie).toMatch(/SameSite=Lax/i);
    expect(flow.state).toBeTruthy();
  });

  it('ignores any return address the caller passes', async () => {
    // Arrange
    const flow = await startFlow('google', '?redirect=https://evil.example.test&returnTo=https://evil.example.test');
    const browser = { cookie: flow.cookie, ip: flow.ip };
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));

    // Act
    const outcome = await callback(
      'google',
      { state: flow.state, code, returnTo: 'https://evil.example.test' },
      browser,
    );

    // Assert
    expect(outcome.location.origin).toBe('https://dash.example.test');
    expect(outcome.page).toBe('/dashboard/register');
  });

  it('answers 404 for a provider that does not exist', async () => {
    // Act
    const response = await fetch(client.url('/auth/oauth/myspace/start'), { redirect: 'manual' });

    // Assert
    expect(response.status).toBe(404);
  });
});

describe('login CSRF', () => {
  it.each([
    ['altered', (state: string): Promise<string> => Promise.resolve(tampered(state))],
    ['from another browser', async (): Promise<string> => (await startFlow('google')).state],
    ['not ours at all', (): Promise<string> => Promise.resolve('v1.not-a-sealed-state')],
  ])('rejects a state that is %s and exchanges nothing', async (_name, wrongState) => {
    // Arrange
    const flow = await startFlow('google');
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));
    const state = await wrongState(flow.state);
    const before = mock.tokenRequests;

    // Act
    const outcome = await callback('google', { state, code }, { cookie: flow.cookie, ip: flow.ip });

    // Assert
    expect(outcome.error).toBe(OAUTH_FAILED);
    expect(outcome.ticket).toBeNull();
    expect(mock.tokenRequests).toBe(before);
  });

  it('rejects a state issued for the other provider', async () => {
    // Arrange
    const flow = await startFlow('google');
    const code = mock.approve('facebook', flow.authorizeUrl, { id: randomUUID() });

    // Act
    const outcome = await callback('facebook', { state: flow.state, code }, { cookie: flow.cookie, ip: flow.ip });

    // Assert
    expect(outcome.error).toBe(OAUTH_FAILED);
  });

  it.each([
    ['no cookie', (): string | undefined => undefined],
    ["another browser's cookie", (): string | undefined => stranger()],
  ])('rejects a callback with %s', async (_name, cookie) => {
    // Arrange
    const flow = await startFlow('google');
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));
    const before = mock.tokenRequests;
    const value = cookie();

    // Act
    const outcome = await callback(
      'google',
      { state: flow.state, code },
      { ip: flow.ip, ...(value === undefined ? {} : { cookie: value }) },
    );

    // Assert
    expect(outcome.error).toBe(OAUTH_FAILED);
    expect(outcome.ticket).toBeNull();
    expect(mock.tokenRequests).toBe(before);
  });

  it('rejects a provider error and a replayed authorization code', async () => {
    // Arrange
    const flow = await startFlow('google');
    const browser = { cookie: flow.cookie, ip: flow.ip };
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));
    await callback('google', { state: flow.state, code }, browser);

    // Act
    const denied = await callback('google', { state: flow.state, error: 'access_denied' }, browser);
    const replayed = await callback('google', { state: flow.state, code }, browser);

    // Assert
    expect(denied.error).toBe(OAUTH_FAILED);
    expect(replayed.error).toBe(OAUTH_FAILED);
  });
});

describe('the single-use ticket', () => {
  it.each([
    ['no cookie', (): string | undefined => undefined],
    ["another browser's cookie", (): string | undefined => stranger()],
  ])('refuses a sign-in ticket with %s and leaves it usable by its browser', async (_name, cookie) => {
    // Arrange
    const { run } = await existingAccountRun();
    const value = cookie();

    // Act
    const refused = await authenticate(run.ticket ?? '', {
      ip: uniqueIp(),
      ...(value === undefined ? {} : { cookie: value }),
    });
    const accepted = await authenticate(run.ticket ?? '', run.browser);

    // Assert
    expect(refused.data?.['authenticate']?.['authenticationError']).toBe(INVALID_TOKEN);
    expect(accepted.data?.['authenticate']?.['__typename']).toBe('CurrentUser');
  });

  it('refuses a replayed sign-in ticket', async () => {
    // Arrange
    const { run } = await existingAccountRun();
    await authenticate(run.ticket ?? '', run.browser);

    // Act
    const replay = await authenticate(run.ticket ?? '', run.browser);

    // Assert
    expect(replay.data?.['authenticate']?.['authenticationError']).toBe(INVALID_TOKEN);
  });

  it('will not sign in with the ticket of an identity that has no account yet', async () => {
    // Arrange
    const run = await newIdentityRun();

    // Act
    const answer = await authenticate(run.ticket ?? '', run.browser);

    // Assert
    expect(answer.data?.['authenticate']?.['authenticationError']).toBe(INVALID_TOKEN);
  });

  it('refuses a registration ticket from another browser and keeps it usable', async () => {
    // Arrange
    const run = await newIdentityRun();
    const input = inputFor({ password: undefined, oauthTicket: run.ticket });

    // Act
    const refused = await registerWithTicket(input, { ip: uniqueIp(), cookie: stranger() });
    const accepted = await registerWithTicket(input, run.browser);

    // Assert
    expect(codeOf(refused)).toBe(INVALID_TOKEN);
    expect(accepted.errors).toEqual([]);
  });

  it('refuses a replayed registration ticket', async () => {
    // Arrange
    const run = await newIdentityRun();
    await registerWithTicket(inputFor({ password: undefined, oauthTicket: run.ticket }), run.browser);

    // Act
    const replay = await registerWithTicket(inputFor({ password: undefined, oauthTicket: run.ticket }), run.browser);

    // Assert
    expect(codeOf(replay)).toBe(INVALID_TOKEN);
  });

  it('does not spend the ticket when the registration fails', async () => {
    // Arrange
    const run = await newIdentityRun();
    const taken = inputFor();
    await register(taken);

    // Act
    const failed = await registerWithTicket(
      inputFor({ password: undefined, oauthTicket: run.ticket, subdomain: taken['subdomain'] }),
      run.browser,
    );
    const retried = await registerWithTicket(inputFor({ password: undefined, oauthTicket: run.ticket }), run.browser);

    // Assert
    expect(failed.errors).not.toEqual([]);
    expect(retried.errors).toEqual([]);
  });

  it('previews a ticket only for its own browser', async () => {
    // Arrange
    const email = uniqueEmail();
    const run = await signInThrough('google', googleProfile(email));

    // Act
    const own = await client.json('POST', '/auth/oauth/ticket', run.browser, { ticket: run.ticket });
    const other = await client.json(
      'POST',
      '/auth/oauth/ticket',
      { ip: uniqueIp(), cookie: stranger() },
      { ticket: run.ticket },
    );

    // Assert
    expect(own.body).toEqual({ email, emailVerified: true, firstName: 'Sara', lastName: 'Owner', provider: 'google' });
    expect(other.status).toBe(400);
  });
});
