import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codeOf, createRegisterTestKit, inputFor, uniqueIp } from './register-test-kit';

const AUTH_INPUT_FIELDS = 'query { __type(name: "AuthenticationInput") { inputFields { name } } }';
const PUBLIC_CONFIG = 'query { authPublicConfig { oauthEnabled oauthProviders } }';

const { server, client, register, start } = createRegisterTestKit();

beforeAll(start);

afterAll(async () => {
  await server.destroy();
});

describe('OAuth with the flag off', () => {
  it.each(['/auth/oauth/google/start', '/auth/oauth/google/callback?state=x&code=y', '/auth/oauth/facebook/start'])(
    'answers 404 at %s',
    async (path) => {
      // Act
      const response = await fetch(client.url(path), { redirect: 'manual' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.headers.getSetCookie()).toEqual([]);
    },
  );

  it('answers 404 to the ticket preview', async () => {
    // Act
    const { status } = await client.json('POST', '/auth/oauth/ticket', { ip: uniqueIp() }, { ticket: 'x' });

    // Assert
    expect(status).toBe(404);
  });

  it('has no oauth login in the schema', async () => {
    // Act
    const answer = await client.graphql(AUTH_INPUT_FIELDS);

    // Assert
    const type = answer.data?.['__type'] as { inputFields: { name: string }[] };
    expect(type.inputFields.map(({ name }) => name)).not.toContain('oauth');
  });

  it('tells clients no provider is on offer', async () => {
    // Act
    const answer = await client.graphql(PUBLIC_CONFIG);

    // Assert
    expect(answer.data?.['authPublicConfig']).toEqual({ oauthEnabled: false, oauthProviders: [] });
  });

  it('still requires a password without a ticket', async () => {
    // Act
    const answer = await register(inputFor({ password: undefined }));

    // Assert
    expect(codeOf(answer)).toBe('auth.registration-invalid');
  });

  it('refuses a registration carrying a ticket', async () => {
    // Act
    const answer = await register(inputFor({ oauthTicket: 'any-ticket' }));

    // Assert
    expect(codeOf(answer)).toBe('auth.registration-invalid');
  });
});
