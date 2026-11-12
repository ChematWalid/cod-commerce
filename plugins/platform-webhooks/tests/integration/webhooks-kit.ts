import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { parseKekRing, PlatformSecretsPlugin } from '@cod/plugin-platform-secrets';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { type PartitionedTableSchema, toBusinessId } from '@cod/shared';
import {
  createPluginTestEnvironment,
  ensurePartitionedSchema,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { ConfigService, type InspectableJobQueueStrategy, TransactionalConnection } from '@vendure/core';
import { INBOUND_WEBHOOK_SCHEMAS } from '../../infrastructure/webhook-schema';
import { PlatformWebhooksPlugin } from '../../platform-webhooks.plugin';
import {
  TEST_EVENT_HEADER,
  TEST_SIGNATURE_HEADER,
  signTestBody,
  TestHandlerPlugin,
  testAccounts,
} from '../fixtures/test-handler.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** A synthetic internal key: the plugin refuses to boot without one, and these tests send no internal calls. */
const INTERNAL_KEY = { kid: 'k1', secret: 'synthetic-internal-key-000000000000000000' };

/** A synthetic key ring: the gateway plugin imports the secrets plugin, which will not boot without one. */
const TEST_KEK_RING = parseKekRing(`k1:${'11'.repeat(32)}`, 'k1');

type Environment = ReturnType<typeof createPluginTestEnvironment>;

/** What a test host adds to the gateway. */
export interface WebhooksEnvironmentOptions {
  /** Registers the demo provider and consumer (D110). */
  readonly demo?: boolean;
  /** Plugins added before the outbox (a test that calls the secrets API adds the rbac plugin). */
  readonly plugins?: readonly Parameters<typeof createPluginTestEnvironment>[0]['plugins'][number][];
  /** Partitioned tables the added plugins need, created with the gateway's own. */
  readonly schemas?: readonly PartitionedTableSchema[];
}

/**
 * A Vendure test server with tenancy, the outbox, the gateway and the fixture provider `test`. The partitioned
 * tables cannot come from `synchronize`, so `server.init` also creates them and their current partitions (D106).
 */
export function createWebhooksTestEnvironment(
  snowflakeWorkerId: number,
  options: WebhooksEnvironmentOptions = {},
): Environment {
  const demo = options.demo === true;
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-platform-webhooks' }),
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      ...(options.plugins ?? []),
      PlatformOutboxPlugin,
      PlatformSecretsPlugin.init({ kekRing: TEST_KEK_RING }),
      PlatformWebhooksPlugin.init({ internalKeys: [INTERNAL_KEY], demoHandlers: demo }),
      TestHandlerPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  const { server } = environment;
  const init = server.init.bind(server);
  server.init = async (...args: Parameters<typeof init>): Promise<void> => {
    await init(...args);
    const raw = server.app.get(TransactionalConnection).rawConnection;
    await ensurePartitionedSchema(raw, [
      ...OUTBOX_SCHEMAS,
      ...INBOUND_WEBHOOK_SCHEMAS,
      ...(options.schemas ?? []),
    ]);
    await server.app.get(PartitionMaintenanceService).maintain(new Date());
  };
  return environment;
}

/** Boots the server and registers `acme-a` and `acme-b`, the fixture accounts of the two businesses. */
export async function initWithAccounts(
  environment: Environment,
  createBusinesses: () => Promise<TwoBusinesses>,
): Promise<TwoBusinesses> {
  await environment.server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  const businesses = await createBusinesses();
  testAccounts.set('acme-a', { accountId: 'acct-a', businessId: toBusinessId(businesses.a.businessId) });
  testAccounts.set('acme-b', { accountId: 'acct-b', businessId: toBusinessId(businesses.b.businessId) });
  return businesses;
}

/** What a test posts. */
export interface PostOptions {
  readonly body?: Buffer | string;
  readonly contentType?: string;
  readonly eventId?: string;
  readonly signature?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** What a post answered. */
export interface PostResult {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  readonly text: string;
}

/** The pieces of a running server the tests reach for. */
export function webhooksKit(server: Environment['server']) {
  const connection = () => server.app.get(TransactionalConnection);
  const baseUrl = (): string => {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  };
  return {
    sql: (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
      connection().rawConnection.query(statement, parameters),
    /** Posts to `/webhooks/{provider}/{accountKey}` and returns the status, the headers and the text. */
    async post(provider: string, accountKey: string, options: PostOptions = {}): Promise<PostResult> {
      const body = options.body ?? JSON.stringify({ n: Math.random() });
      const headers: Record<string, string> = {
        'content-type': options.contentType ?? 'application/json',
        [TEST_SIGNATURE_HEADER]: options.signature ?? signTestBody(body),
        ...(options.eventId === undefined ? {} : { [TEST_EVENT_HEADER]: options.eventId }),
        ...options.headers,
      };
      const response = await fetch(`${baseUrl()}/webhooks/${provider}/${accountKey}`, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : new Uint8Array(body),
      });
      return { status: response.status, headers: response.headers, text: await response.text() };
    },
    /** Every job the strategy lists on `queueName`. */
    async jobsOf(queueName: string): Promise<{ data: Record<string, unknown> }[]> {
      const strategy = server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy as InspectableJobQueueStrategy;
      const { items } = await strategy.findMany({ take: 1000 });
      return items.filter((job) => job.queueName === queueName);
    },
  };
}

/** Polls until `read` returns a value that is not undefined, or fails after `timeoutMs`. */
export async function until<T>(read: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('the condition did not hold in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
