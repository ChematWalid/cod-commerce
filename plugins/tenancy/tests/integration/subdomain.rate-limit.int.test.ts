import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenancyPlugin } from '../../tenancy.plugin';
import { TEST_REDIS_URL, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

/** The header the tests use to give every test its own client address, so no test sees another's bucket. */
const CLIENT_IP_HEADER = 'x-test-client-ip';
const SUBDOMAIN_IP_CAPACITY = 60;
const AVAILABILITY_QUERY =
  'query ($s: String!) { subdomainAvailability(subdomain: $s) { subdomain status reasonCode } }';

/** A random address in fd00::/8 whose /64 (the unit the limiter keys by) has 48 random bits: no two tests share a bucket. */
const freshIp = (): string =>
  `fd00:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;

interface GraphqlBody {
  readonly data?: { subdomainAvailability: { status: string } } | null;
  readonly errors?: readonly { message: string; extensions: { code: string; retryAfterSeconds?: number } }[];
}

describe('subdomain availability rate limit', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: CLIENT_IP_HEADER }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1013 }),
    ],
    db: loadPluginTestDbConfig(process.env),
  });

  const origin = (): string => {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  };

  const getAvailability = (ip: string, subdomain = 'free-name'): Promise<Response> =>
    fetch(`${origin()}/stores/subdomain-availability?subdomain=${subdomain}`, { headers: { [CLIENT_IP_HEADER]: ip } });

  const queryAvailability = (ip: string): Promise<Response> =>
    fetch(`${origin()}/admin-api`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CLIENT_IP_HEADER]: ip },
      body: JSON.stringify({ query: AVAILABILITY_QUERY, variables: { s: 'free-name' } }),
    });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('answers the 61st anonymous REST request from one address with 429 and Retry-After', async () => {
    // Arrange
    const ip = freshIp();

    // Act: a burst, so that no token has time to come back
    const responses = await Promise.all(Array.from({ length: SUBDOMAIN_IP_CAPACITY + 1 }, () => getAvailability(ip)));

    // Assert
    const limited = responses.filter((response) => response.status === 429);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(SUBDOMAIN_IP_CAPACITY);
    expect(limited).toHaveLength(1);
    expect(Number(limited[0]?.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(await limited[0]?.json()).toMatchObject({
      statusCode: 429,
      retryAfterSeconds: expect.any(Number) as number,
    });
  });

  it('keeps counting other addresses separately', async () => {
    // Arrange
    const busy = freshIp();
    await Promise.all(Array.from({ length: SUBDOMAIN_IP_CAPACITY + 1 }, () => getAvailability(busy)));

    // Act
    const other = await getAvailability(freshIp());

    // Assert
    expect(other.status).toBe(200);
  });

  it('answers the GraphQL query over the limit with code RATE_LIMITED and Retry-After on a 200', async () => {
    // Arrange
    const ip = freshIp();
    await Promise.all(Array.from({ length: SUBDOMAIN_IP_CAPACITY }, () => queryAvailability(ip)));

    // Act
    const response = await queryAvailability(ip);
    const body = (await response.json()) as GraphqlBody;

    // Assert
    expect(response.status).toBe(200);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(body.errors?.[0]?.extensions.code).toBe('RATE_LIMITED');
    expect(body.errors?.[0]?.extensions.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('shares one bucket between the REST route and the GraphQL query', async () => {
    // Arrange
    const ip = freshIp();
    await Promise.all(Array.from({ length: SUBDOMAIN_IP_CAPACITY }, () => getAvailability(ip)));

    // Act
    const response = await queryAvailability(ip);

    // Assert
    expect(((await response.json()) as GraphqlBody).errors?.[0]?.extensions.code).toBe('RATE_LIMITED');
  });

  it('serves a request under the limit as before', async () => {
    // Act
    const response = await queryAvailability(freshIp());
    const body = (await response.json()) as GraphqlBody;

    // Assert
    expect(body.errors).toBeUndefined();
    expect(body.data?.subdomainAvailability.status).toBe('available');
  });
});
