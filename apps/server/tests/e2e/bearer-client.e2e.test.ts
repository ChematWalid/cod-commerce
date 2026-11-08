import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, e2eEnv, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'bearer-client';
const PORT = E2E_PORTS.bearerClient;
const ADMIN_API_URL = `http://localhost:${String(PORT)}/admin-api`;
/** Vendure's default `authTokenHeaderKey`. */
const AUTH_TOKEN_HEADER = 'vendure-auth-token';

const LOGIN = `mutation ($username: String!, $password: String!) {
  login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } }
}`;
const ME = 'query { me { identifier } }';

interface GraphqlBody {
  readonly data?: { readonly me?: { readonly identifier: string } | null };
}

/** A native client's request: no cookie jar and no browser `Origin`, only the headers given here. */
function post(query: string, variables: object, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
}

describe('a bearer-only Admin API client (ADR 0017)', () => {
  const env = e2eEnv();
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT }));

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('logs in and makes an authenticated call with only the bearer token', async () => {
    // Arrange
    const credentials = { username: env.SUPERADMIN_USERNAME, password: env.SUPERADMIN_PASSWORD };
    const login = await post(LOGIN, credentials);
    const token = login.headers.get(AUTH_TOKEN_HEADER);
    expect(token).toBeTruthy();

    // Act
    const me = await post(ME, {}, { authorization: `Bearer ${String(token)}` });

    // Assert
    expect(me.status).toBe(200);
    expect(((await me.json()) as GraphqlBody).data?.me?.identifier).toBe(env.SUPERADMIN_USERNAME);
  });

  it('treats the same call without the token as anonymous', async () => {
    const me = await post(ME, {});

    expect(((await me.json()) as GraphqlBody).data?.me ?? null).toBeNull();
  });
});
