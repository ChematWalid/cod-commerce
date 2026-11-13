import { randomBytes } from 'node:crypto';
import type { SimpleGraphQLClient } from '@vendure/testing';

/** The header tests name the client address with, so one process can act as many addresses. */
export const TEST_CLIENT_IP_HEADER = 'x-test-client-ip';

/** A random /64 of the IPv6 documentation prefix (RFC 3849), never routed; the limiter keys IPv6 by /64. */
const freshTestAddress = (): string =>
  `2001:db8:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;

/**
 * Makes every sign-in of `client`, `asSuperAdmin` included, come from a fresh client address. All Team test files
 * share one Valkey, and auth's `login-ip` policy (60 attempts a minute per address) counts every login, correct or
 * not: the suite signs in far more often than that, so from one loopback address it gets `auth-login-rate-limited`
 * once the bucket runs dry. The limiter is auth's and is tested there; Team's tests only need to sign in. The
 * address stays on the client's later requests, which no Team limit keys by (`publicRest` names its own).
 */
export function signInFromFreshAddresses(client: SimpleGraphQLClient): void {
  const signIn = client.asUserWithCredentials.bind(client);
  client.asUserWithCredentials = async (username: string, password: string): Promise<unknown> => {
    client.setHeader(TEST_CLIENT_IP_HEADER, freshTestAddress());
    return signIn(username, password);
  };
}
