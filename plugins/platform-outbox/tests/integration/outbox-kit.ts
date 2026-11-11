import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { RequestTenantScope, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import { createPluginTestEnvironment, ensurePartitionedSchema, loadPluginTestDbConfig } from '@cod/testing';
import {
  ConfigService,
  type InspectableJobQueueStrategy,
  type RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import { OutboxService } from '../../application/outbox.service';
import type { OutboxEventInput, OutboxEventRef } from '../../domain/outbox-event';
import { OUTBOX_SCHEMAS } from '../../infrastructure/outbox-schema';
import { PlatformOutboxPlugin } from '../../platform-outbox.plugin';
import { CountingConsumerPlugin } from '../fixtures/counting-consumer.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

type Environment = ReturnType<typeof createPluginTestEnvironment>;

/**
 * A Vendure test server with tenancy, the outbox and the counting consumers. `synchronize` cannot make the
 * partitioned tables, so `server.init` also creates them and their current partitions (D106).
 */
export function createOutboxTestEnvironment(snowflakeWorkerId: number): Environment {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-platform-outbox' }),
      PlatformPartitionsPlugin,
      // Tenancy keys its limiter by `req.ip`: these tests send no client address header.
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      PlatformOutboxPlugin,
      CountingConsumerPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  const { server } = environment;
  const init = server.init.bind(server);
  server.init = async (...args: Parameters<typeof init>): Promise<void> => {
    await init(...args);
    await ensurePartitionedSchema(server.app.get(TransactionalConnection).rawConnection, OUTBOX_SCHEMAS);
    await server.app.get(PartitionMaintenanceService).maintain(new Date());
  };
  return environment;
}

/** The pieces of a running server the tests reach for. */
export function outboxKit(server: Environment['server']) {
  const connection = () => server.app.get(TransactionalConnection);
  const newContext = (): Promise<RequestContext> => server.app.get(RequestContextService).create({ apiType: 'admin' });
  return {
    connection,
    newContext,
    sql: (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
      connection().rawConnection.query(statement, parameters),
    scopeOf: (ctx: RequestContext, businessId: string): RequestTenantScope =>
      new RequestTenantScope(ctx, toBusinessId(businessId)),
    /** Writes an event in a transaction that commits. */
    async commitEvent(businessId: string, input: OutboxEventInput): Promise<OutboxEventRef> {
      const ctx = await newContext();
      return connection().withTransaction(ctx, (txCtx) =>
        server.app.get(OutboxService).add(new RequestTenantScope(txCtx, toBusinessId(businessId)), input),
      );
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
