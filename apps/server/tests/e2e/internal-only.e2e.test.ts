import { ProvisionBusinessService, asOperationContext, type ProvisionedBusiness } from '@cod/plugin-tenancy';
import { parseInternalKeys, type InternalSigningKey } from '@cod/shared/internal-auth';
import { CustomerService, RequestContextService } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, e2eRedis, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';
import { sendRaw, signedHeaders, type RawResponse } from './support/signed-request';

const SUITE = 'internal-only';
const PORT = E2E_PORTS.internalOnly;
/** Synthetic: the guard of this file verifies with these, whatever the shell's `INTERNAL_HMAC_KEYS` holds. */
const KEYS = 'k1:synthetic-internal-e2e-secret-000000000000';
const KEY: InternalSigningKey = parseInternalKeys(KEYS)[0] as InternalSigningKey;
const HOSTS = ['api.localhost', 'app.localhost', 'demo.localhost', 'evil.example'] as const;
const JSON_HEADERS = { 'content-type': 'application/json' } as const;
const SHOP_BODY = JSON.stringify({ query: '{ activeChannel { code } }' });
const LOGOUT_BODY = JSON.stringify({ query: 'mutation { logout { success } }' });
const RESOLVE_PATH = '/store/resolve?host=guarddemo.localhost';

const BUYER_PASSWORD = 'synthetic-buyer-password';

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

describe('the internal-only guard on the full api config (D112)', () => {
  const { server, adminClient } = createTestEnvironment(
    buildE2eConfig(
      {},
      {
        suite: SUITE,
        port: PORT,
        env: { INTERNAL_HMAC_KEYS: KEYS, INTERNAL_HMAC_ACTIVE_KID: 'k1', PLATFORM_DOMAIN: 'localhost' },
      },
    ),
  );
  let demo: ProvisionedBusiness;

  const call = (
    method: string,
    path: string,
    host: string,
    extra: { body?: string; headers?: Record<string, string> } = {},
  ): Promise<RawResponse> => sendRaw({ port: PORT, method, path, host, ...extra });

  const signedGet = (path: string): Promise<RawResponse> =>
    call('GET', path, 'api.localhost', { headers: signedHeaders(KEY, { method: 'GET', path }) });

  const signedPost = (
    path: string,
    body: string,
    extra: Record<string, string> = {},
    host = 'api.localhost',
  ): Promise<RawResponse> =>
    call('POST', path, host, {
      body,
      headers: { ...signedHeaders(KEY, { method: 'POST', path, body }), ...JSON_HEADERS, ...extra },
    });

  beforeAll(async () => {
    const redis = e2eRedis();
    await redis.del('host:guarddemo.localhost');
    redis.disconnect();
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    demo = await server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), {
      name: 'Demo SARL',
      owner: {
        emailAddress: 'demo-owner@example.test',
        firstName: 'demo',
        lastName: 'Owner',
        password: 'synthetic-owner-password',
      },
      store: { name: 'Demo store', subdomain: 'guarddemo', language: 'ar' },
    });
  });

  afterAll(async () => {
    await server.destroy();
    // The host cache lives in the shared Valkey: this file's store must not answer for a later database.
    const redis = e2eRedis();
    await redis.del('host:guarddemo.localhost');
    redis.disconnect();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  describe.each(HOSTS)('unsigned, Host %s', (host) => {
    it.each([
      ['POST', '/shop-api'],
      ['POST', '/shop-api?x=1'],
      ['GET', RESOLVE_PATH],
      ['GET', '/STORE/resolve?host=guarddemo.localhost'],
      ['GET', '/store/resolve/?host=guarddemo.localhost'],
      ['GET', '/_internal'],
      ['GET', '/_internal/revalidate'],
    ])('answers 404 with an empty body to %s %s', async (method, path) => {
      const response = await call(
        method,
        path,
        host,
        method === 'POST' ? { body: SHOP_BODY, headers: JSON_HEADERS } : {},
      );

      expect(response).toMatchObject({ status: 404, body: '' });
    });
  });

  describe('signed', () => {
    it('resolves the provisioned store through the real app (the signature covers the full path)', async () => {
      const response = await signedGet(RESOLVE_PATH);

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ storeId: demo.store.id, primaryHost: 'guarddemo.localhost' });
    });

    it('answers a Shop API query', async () => {
      const response = await signedPost('/shop-api', SHOP_BODY, {}, 'demo.localhost');

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ data: { activeChannel: { code: '__default_channel__' } } });
    });

    it('reaches the shadowed Shop API logout (D49)', async () => {
      const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
      await server.app
        .get(CustomerService)
        .create(ctx, { emailAddress: 'buyer@example.test', firstName: 'Buyer', lastName: 'Test' }, BUYER_PASSWORD);
      const login = JSON.stringify({
        query: 'mutation ($u: String!, $p: String!) { login(username: $u, password: $p) { __typename } }',
        variables: { u: 'buyer@example.test', p: BUYER_PASSWORD },
      });
      const loggedIn = await signedPost('/shop-api', login);
      const token = loggedIn.headers['vendure-auth-token'];
      expect(token).toBeTruthy();

      const response = await signedPost('/shop-api', LOGOUT_BODY, {
        authorization: `Bearer ${String(token)}`,
      });

      expect(JSON.parse(response.body)).toEqual({ data: { logout: { success: true } } });
    });

    it('answers 413 to a body over 100 KB', async () => {
      const body = JSON.stringify({ query: '{ activeChannel { code } }', padding: 'x'.repeat(101 * 1024) });

      const response = await signedPost('/shop-api', body);

      expect(response).toMatchObject({ status: 413, body: '' });
    });
  });

  describe('signed, then changed in flight', () => {
    const signed = (): Record<string, string> =>
      signedHeaders(KEY, { method: 'GET', path: RESOLVE_PATH }, { storeId: demo.store.id });

    it('answers 404 to a changed x-store-id', async () => {
      const response = await call('GET', RESOLVE_PATH, 'api.localhost', {
        headers: { ...signed(), 'x-store-id': `${demo.store.id}0` },
      });

      expect(response).toMatchObject({ status: 404, body: '' });
    });

    it('answers 404 to a changed query', async () => {
      const response = await call('GET', '/store/resolve?host=other.localhost', 'api.localhost', { headers: signed() });

      expect(response).toMatchObject({ status: 404, body: '' });
    });

    it('answers 404 to a changed method', async () => {
      const response = await call('HEAD', RESOLVE_PATH, 'api.localhost', { headers: signed() });

      expect(response).toMatchObject({ status: 404, body: '' });
    });

    it('answers 404 to a changed body', async () => {
      const headers = signedHeaders(KEY, { method: 'POST', path: '/shop-api', body: SHOP_BODY });

      const response = await call('POST', '/shop-api', 'api.localhost', {
        body: LOGOUT_BODY,
        headers: { ...headers, ...JSON_HEADERS },
      });

      expect(response).toMatchObject({ status: 404, body: '' });
    });
  });

  describe('what stays public', () => {
    it.each(HOSTS)('answers 200 to an unsigned subdomain check on Host %s', async (host) => {
      const response = await call('GET', '/stores/subdomain-availability?subdomain=free-name', host);

      expect(response.status).toBe(200);
    });

    it('leaves /admin-api and /auth/config unguarded', async () => {
      const admin = await call('POST', '/admin-api', 'api.localhost', {
        body: JSON.stringify({ query: '{ __typename }' }),
        headers: JSON_HEADERS,
      });
      const config = await call('GET', '/auth/config', 'api.localhost');

      expect(admin.status).toBe(200);
      expect(config.status).toBe(200);
    });
  });
});
