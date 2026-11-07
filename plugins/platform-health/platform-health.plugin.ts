import {
  Inject,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Logger, PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import type { Redis } from 'ioredis';
import { HealthMiddleware } from './api/health.middleware';
import { EvictionPolicyVerifier } from './application/eviction-policy.verifier';
import { LivenessService } from './application/liveness.service';
import { ReadinessService } from './application/readiness.service';
import { HEALTH_PATHS } from './domain/constants';
import { EventLoopLagMonitor } from './infrastructure/event-loop-lag.monitor';
import { MigrationsProbe } from './infrastructure/migrations.probe';
import { PostgresProbe } from './infrastructure/postgres.probe';
import { RedisEvictionPolicyReader } from './infrastructure/redis-eviction.guard';
import { createProbeRedisClient, RedisProbe } from './infrastructure/redis.probe';
import { startWorkerHealthServer, type WorkerHealthServer } from './infrastructure/worker-health-server';

/** How the server configures {@link PlatformHealthPlugin}. */
export interface PlatformHealthOptions {
  readonly redisUrl: string;
  readonly workerHealthPort: number;
  /** True for the worker role only: it has no HTTP server, so the plugin serves the probes on their own port. */
  readonly serveWorkerHealth: boolean;
}

/** The probes' Valkey client, with the eviction-policy verifier bound to it (they share its verified state). */
interface ProbeRedis {
  readonly client: Redis;
  readonly evictionPolicy: EvictionPolicyVerifier;
}

const PROBE_REDIS = Symbol('PlatformHealthProbeRedis');

function createProbeRedis(): ProbeRedis {
  const client = createProbeRedisClient(requireOptions().redisUrl);
  return { client, evictionPolicy: new EvictionPolicyVerifier(new RedisEvictionPolicyReader(client), Logger) };
}

/** Nest route paths have no leading slash. */
const HEALTH_ROUTES = [HEALTH_PATHS.live, HEALTH_PATHS.ready].map((path) => path.slice(1));

function requireOptions(): PlatformHealthOptions {
  const { options } = PlatformHealthPlugin;
  if (options === undefined) {
    throw new Error('PlatformHealthPlugin is registered without options: use PlatformHealthPlugin.init(...)');
  }
  return options;
}

const createReadiness = (connection: TransactionalConnection, redis: ProbeRedis): ReadinessService =>
  new ReadinessService([
    new PostgresProbe(connection.rawConnection),
    new RedisProbe(redis.client, redis.evictionPolicy),
    new MigrationsProbe(connection.rawConnection),
  ]);

/**
 * Readiness (`/readyz`: Postgres, Valkey, pending migrations) and liveness (`/livez`: event-loop lag) probes.
 * The api role answers them on its own port; the worker role on `workerHealthPort`. Every role refuses to
 * boot when Valkey may evict keys; an unreachable Valkey only logs a warning and keeps `/readyz` not ready.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    EventLoopLagMonitor,
    { provide: PROBE_REDIS, useFactory: createProbeRedis },
    { provide: ReadinessService, useFactory: createReadiness, inject: [TransactionalConnection, PROBE_REDIS] },
    {
      provide: LivenessService,
      useFactory: (monitor: EventLoopLagMonitor) => new LivenessService(() => monitor.sample()),
      inject: [EventLoopLagMonitor],
    },
  ],
  compatibility: '^3.0.0',
})
export class PlatformHealthPlugin implements NestModule, OnApplicationBootstrap, OnApplicationShutdown {
  static options: PlatformHealthOptions | undefined;
  private workerHealthServer: WorkerHealthServer | undefined;

  constructor(
    @Inject(PROBE_REDIS) private readonly redis: ProbeRedis,
    private readonly readiness: ReadinessService,
    private readonly liveness: LivenessService,
    private readonly lagMonitor: EventLoopLagMonitor,
  ) {}

  /** Registers the plugin with its options; the server passes `serveWorkerHealth: role === 'worker'`. */
  static init(options: PlatformHealthOptions): typeof PlatformHealthPlugin {
    PlatformHealthPlugin.options = options;
    return PlatformHealthPlugin;
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HealthMiddleware).forRoutes(...HEALTH_ROUTES);
  }

  /** @throws {RedisEvictionPolicyError} or {RedisConfigUnavailableError} when Valkey may evict keys, which fails boot. */
  async onApplicationBootstrap(): Promise<void> {
    await this.redis.evictionPolicy.verifyAtBoot();
    this.lagMonitor.start();
    const { serveWorkerHealth, workerHealthPort } = requireOptions();
    if (serveWorkerHealth) {
      this.workerHealthServer = await startWorkerHealthServer({
        port: workerHealthPort,
        readiness: this.readiness,
        liveness: this.liveness,
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.workerHealthServer?.close();
    this.lagMonitor.stop();
    this.redis.client.disconnect();
  }
}
