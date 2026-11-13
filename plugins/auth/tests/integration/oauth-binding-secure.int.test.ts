import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOAuthTestKit, googleProfile } from './oauth-test-kit';
import { uniqueEmail } from './register-test-kit';

const OAUTH_FAILED = 'auth.oauth-failed';
const PLAIN_NAME = 'cod_oauth_binding';
const HOST_ONLY_NAME = `__Host-${PLAIN_NAME}`;

const kit = createOAuthTestKit({ secureCookie: true });
const { mock, startFlow, callback } = kit;

beforeAll(kit.start);

afterAll(kit.stop);

/** The value of the binding, as a sibling subdomain could set it under the unprefixed name. */
const plantedUnprefixed = (cookie: string): string => `${PLAIN_NAME}=${cookie.slice(cookie.indexOf('=') + 1)}`;

describe('the browser binding cookie in a secure environment', () => {
  it('is set host-only: __Host- name, Secure, Path=/ and no Domain', async () => {
    // Act
    const flow = await startFlow('google');

    // Assert
    expect(flow.setCookie.startsWith(`${HOST_ONLY_NAME}=`)).toBe(true);
    expect(flow.setCookie).toMatch(/;\s*Secure/i);
    expect(flow.setCookie).toMatch(/;\s*Path=\/(;|$)/i);
    expect(flow.setCookie).not.toMatch(/Domain=/i);
  });

  it('completes the flow for the browser that holds the host-only cookie', async () => {
    // Arrange
    const flow = await startFlow('google');
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));

    // Act
    const outcome = await callback('google', { state: flow.state, code }, { cookie: flow.cookie, ip: flow.ip });

    // Assert
    expect(outcome.error).toBeNull();
    expect(outcome.ticket).toBeTruthy();
  });

  it('rejects a callback whose binding came under the unprefixed name a sibling subdomain can plant', async () => {
    // Arrange
    const flow = await startFlow('google');
    const code = mock.approve('google', flow.authorizeUrl, googleProfile(uniqueEmail()));
    const before = mock.tokenRequests;

    // Act
    const outcome = await callback(
      'google',
      { state: flow.state, code },
      { cookie: plantedUnprefixed(flow.cookie), ip: flow.ip },
    );

    // Assert
    expect(outcome.error).toBe(OAUTH_FAILED);
    expect(outcome.ticket).toBeNull();
    expect(mock.tokenRequests).toBe(before);
  });
});
