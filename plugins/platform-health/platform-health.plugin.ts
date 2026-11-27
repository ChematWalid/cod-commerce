import {
  Inject,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Logger, PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import type { Redis } from 'ioredis';
import { HealthMiddleware } from './api/health.middleware';
import { DrainService } from './application/drain.service';
import { EvictionPolicyVerifier } from './application/eviction-policy.verifier';
import { LivenessService } from './application/liveness.service';
import { ReadinessService } from './application/readiness.service';
import { HEALTH_PATHS, READINESS_CACHE_TTL_MS } from './domain/constants';
import { type DrainRole, drainPlanFor } from './domain/drain';
import { EventLoopLagMonitor } from './infrastructure/event-loop-lag.monitor';
import { MigrationsProbe } from './infrastructure/migrations.probe';
import { PostgresProbe } from './infrastructure/postgres.probe';
import { ProcessShutdownWatchdog } from './infrastructure/process-watchdog';
import { RedisEvictionPolicyReader } from './infrastructure/redis-eviction.guard';
import { createProbeRedisClient, RedisProbe } from './infrastructure/redis.probe';
import { startWorkerHealthServer, type WorkerHealthServer } from './infrastructure/worker-health-server';

/** How the server configures {@link PlatformHealthPlugin}. */
export interface PlatformHealthOptions {
  readonly redisUrl: string;
  readonly workerHealthPort: number;
  /** True for the worker role only: it has no HTTP server, so the plugin serves the probes on their own port. */
  readonly serveWorkerHealth: boolean;
  /** The process role, which picks its drain plan (ADR 0013); `migrate` does not drain. */
  readonly role: DrainRole;
}

/** The probes' Valkey client, with the eviction-policy verifier bound to it (they share its verified state). */
interface ProbeRedis {
  readonly client: Redis;
  readonly evictionPolicy: EvictionPolicyVerifier;
}

const PROBE_REDIS = Symbol('PlatformHealthProbeRedis');

/** The two probe services the worker's own health server answers with. */
interface HealthServices {
  readonly readiness: ReadinessService;
  readonly liveness: LivenessService;
}

const HEALTH_SERVICES = Symbol('PlatformHealthServices');

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

const createReadiness = (
  connection: TransactionalConnection,
  redis: ProbeRedis,
  drain: DrainService,
): ReadinessService =>
  new ReadinessService(
    [
      new PostgresProbe(connection.rawConnection),
      new RedisProbe(redis.client, redis.evictionPolicy),
      new MigrationsProbe(connection.rawConnection),
    ],
    Logger,
    { drain, cacheTtlMs: READINESS_CACHE_TTL_MS },
  );

const createDrain = (): DrainService =>
  new DrainService(
    drainPlanFor(requireOptions().role),
    new ProcessShutdownWatchdog((code) => process.exit(code), Logger),
    Logger,
  );

const DRAIN_SIGNAL = 'SIGTERM';

/**
 * Readiness (`/readyz`: Postgres, Valkey, pending migrations) and liveness (`/livez`: event-loop lag) probes.
 * The api role answers them on its own port; the worker role on `workerHealthPort`. Every role refuses to
 * boot when Valkey may evict keys; an unreachable Valkey only logs a warning and keeps `/readyz` not ready.
 * On SIGTERM the api and worker drain (ADR 0013): `/readyz` answers 503 at once and the api's HTTP server stops
 * accepting connections (`trackInFlightRequests`), then the shutdown waits for the api's in-flight requests (25 s)
 * and the worker's active jobs (Vendure's queue stop, bounded at 60 s).
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    { provide: EventLoopLagMonitor, useFactory: () => new EventLoopLagMonitor() },
    { provide: PROBE_REDIS, useFactory: createProbeRedis },
    { provide: DrainService, useFactory: createDrain },
    {
      provide: ReadinessService,
      useFactory: createReadiness,
      inject: [TransactionalConnection, PROBE_REDIS, DrainService],
    },
    {
      provide: LivenessService,
      useFactory: (monitor: EventLoopLagMonitor) => new LivenessService(() => monitor.sample()),
      inject: [EventLoopLagMonitor],
    },
    {
      provide: HEALTH_SERVICES,
      useFactory: (readiness: ReadinessService, liveness: LivenessService): HealthServices => ({ readiness, liveness }),
      inject: [ReadinessService, LivenessService],
    },
  ],
  compatibility: '^3.0.0',
})
export class PlatformHealthPlugin
  implements NestModule, OnApplicationBootstrap, OnModuleDestroy, OnApplicationShutdown
{
  static options: PlatformHealthOptions | undefined;
  private workerHealthServer: WorkerHealthServer | undefined;
  private readonly onDrainSignal = (): void => {
    this.drain.onStopSignal(DRAIN_SIGNAL);
  };

  constructor(
    @Inject(PROBE_REDIS) private readonly redis: ProbeRedis,
    @Inject(HEALTH_SERVICES) private readonly health: HealthServices,
    private readonly lagMonitor: EventLoopLagMonitor,
    private readonly drain: DrainService,
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
    const { serveWorkerHealth, workerHealthPort, role } = requireOptions();
    // Registered before Vendure enables Nest's shutdown hooks (after boot), so it runs first on the signal:
    // /readyz fails before any teardown starts.
    if (role !== 'migrate') {
      process.once(DRAIN_SIGNAL, this.onDrainSignal);
    }
    if (serveWorkerHealth) {
      this.workerHealthServer = await startWorkerHealthServer({
        port: workerHealthPort,
        readiness: this.health.readiness,
        liveness: this.health.liveness,
      });
    }
  }

  /**
   * The request drain. It runs here, not in `beforeApplicationShutdown`: Nest calls every `onModuleDestroy` first,
   * shallow modules first, so this one runs before Vendure's job queue and event bus stop theirs (D3508).
   */
  async onModuleDestroy(): Promise<void> {
    this.drain.begin('shutdown');
    await this.drain.waitForRequests();
  }

  async onApplicationShutdown(): Promise<void> {
    process.off(DRAIN_SIGNAL, this.onDrainSignal);
    await this.workerHealthServer?.close();
    this.lagMonitor.stop();
    this.redis.client.disconnect();
  }
}
