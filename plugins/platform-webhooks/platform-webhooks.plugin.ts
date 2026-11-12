import { JobReconciler, PLATFORM_CLOCK, PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import type { InternalSigningKey } from '@cod/shared/internal-auth';
import { Inject } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { internalOnlyMiddleware } from './api/internal-only.middleware';
import { WebhookController } from './api/webhook.controller';
import { InboundWebhookHandlerRegistry } from './application/handler-registry';
import { InboundProcessor } from './application/inbound-processor';
import { InboundReconcileSource } from './application/inbound-reconcile-source';
import { InboundKeyPurge } from './application/key-purge.service';
import type {
  InboundClock,
  InboundDueScanPort,
  InboundEnvironment,
  InboundIdSource,
  InboundLogger,
  InboundPorts,
  InboundQueuePort,
  InboundScopesPort,
  InboundStorePort,
  KeyPurgePort,
  KillSwitchPort,
} from './application/ports';
import {
  INBOUND_DUE_SCAN,
  INBOUND_ENVIRONMENT,
  INBOUND_IDS,
  INBOUND_PORTS,
  INBOUND_QUEUE,
  INBOUND_SCOPES,
  INBOUND_STORE,
  KEY_PURGE_STORE,
  KILL_SWITCH,
} from './application/tokens';
import { WebhookGatewayService } from './application/webhook-gateway.service';
import {
  INTERNAL_BODY_LIMIT_BYTES,
  INTERNAL_GUARD_LOG_CONTEXT,
  KEY_PURGE_TASK_ID,
  WEBHOOK_BODY_LIMIT_BYTES,
  WEBHOOK_ROUTE_PREFIX,
  WEBHOOKS_LOG_CONTEXT,
} from './domain/constants';
import { internalOnlyPrefixes } from './domain/internal-prefixes';
import { ConfigurableKillSwitch } from './infrastructure/configurable-kill-switch';
import { PostgresInboundScan } from './infrastructure/inbound-due-scan';
import { InboundWebhookEntity } from './infrastructure/inbound-webhook.entity';
import { InboundWebhookKeyEntity } from './infrastructure/inbound-webhook-key.entity';
import { inboundKeyPurgeTask } from './infrastructure/key-purge.task';
import { PlatformInboundQueue } from './infrastructure/platform-inbound-queue';
import { rawBodyMiddleware } from './infrastructure/raw-body.middleware';
import { VendureInboundScopes } from './infrastructure/vendure-inbound-scopes';
import { WebhookStore } from './infrastructure/webhook-store';
import { WebhooksBootstrap } from './infrastructure/webhooks-bootstrap';

/** How the server configures {@link PlatformWebhooksPlugin}. */
export interface PlatformWebhooksOptions {
  readonly internalKeys: readonly InternalSigningKey[];
}

const inboundLogger: InboundLogger = {
  error: (message) => {
    Logger.error(message, WEBHOOKS_LOG_CONTEXT);
  },
  warn: (message) => {
    Logger.warn(message, WEBHOOKS_LOG_CONTEXT);
  },
};

/**
 * Two doors for signed traffic. The internal-only guard (D112) sits in front of the Shop API, `/store` and `/_internal`
 * on every host. The inbound gateway (D109) takes `POST /webhooks/:provider/:accountKey`: a raw-body middleware keeps
 * the exact bytes, the provider's adapter checks the signature, and one transaction stores the webhook before the
 * answer. Feature plugins add providers with `InboundWebhookHandlerRegistry.register` in `onModuleInit`.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, PlatformJobsPlugin, PlatformPartitionsPlugin],
  entities: [InboundWebhookEntity, InboundWebhookKeyEntity],
  controllers: [WebhookController],
  providers: [
    InboundWebhookHandlerRegistry,
    ConfigurableKillSwitch,
    { provide: KILL_SWITCH, useExisting: ConfigurableKillSwitch },
    PostgresInboundScan,
    { provide: INBOUND_DUE_SCAN, useExisting: PostgresInboundScan },
    { provide: KEY_PURGE_STORE, useExisting: PostgresInboundScan },
    WebhookStore,
    { provide: INBOUND_STORE, useExisting: WebhookStore },
    { provide: INBOUND_SCOPES, useClass: VendureInboundScopes },
    PlatformInboundQueue,
    { provide: INBOUND_QUEUE, useExisting: PlatformInboundQueue },
    { provide: INBOUND_IDS, useExisting: SNOWFLAKE_ID_GENERATOR },
    {
      provide: INBOUND_ENVIRONMENT,
      useFactory: (clock: InboundClock, ids: InboundIdSource): InboundEnvironment => ({
        logger: inboundLogger,
        clock,
        ids,
      }),
      inject: [PLATFORM_CLOCK, INBOUND_IDS],
    },
    {
      provide: INBOUND_PORTS,
      useFactory: (store: InboundStorePort, scopes: InboundScopesPort, queue: InboundQueuePort): InboundPorts => ({
        store,
        scopes,
        queue,
      }),
      inject: [INBOUND_STORE, INBOUND_SCOPES, INBOUND_QUEUE],
    },
    {
      provide: WebhookGatewayService,
      useFactory: (
        ports: InboundPorts,
        registry: InboundWebhookHandlerRegistry,
        killSwitch: KillSwitchPort,
        environment: InboundEnvironment,
      ) => new WebhookGatewayService({ ports, registry, killSwitch, environment }),
      inject: [INBOUND_PORTS, InboundWebhookHandlerRegistry, KILL_SWITCH, INBOUND_ENVIRONMENT],
    },
    {
      provide: InboundProcessor,
      useFactory: (ports: InboundPorts, registry: InboundWebhookHandlerRegistry, environment: InboundEnvironment) =>
        new InboundProcessor(ports, registry, environment),
      inject: [INBOUND_PORTS, InboundWebhookHandlerRegistry, INBOUND_ENVIRONMENT],
    },
    {
      provide: InboundReconcileSource,
      useFactory: (scan: InboundDueScanPort, ports: InboundPorts, environment: InboundEnvironment) =>
        new InboundReconcileSource(scan, ports, environment),
      inject: [INBOUND_DUE_SCAN, INBOUND_PORTS, INBOUND_ENVIRONMENT],
    },
    {
      provide: InboundKeyPurge,
      useFactory: (store: KeyPurgePort, clock: InboundClock) => new InboundKeyPurge(store, clock),
      inject: [KEY_PURGE_STORE, PLATFORM_CLOCK],
    },
    WebhooksBootstrap,
  ],
  exports: [InboundWebhookHandlerRegistry, WebhookGatewayService, KILL_SWITCH],
  configuration: (config) => {
    const { options } = PlatformWebhooksPlugin;
    if (options === undefined || options.internalKeys.length === 0) {
      throw new Error('PlatformWebhooksPlugin needs at least one internal key: use PlatformWebhooksPlugin.init(...)');
    }
    const handler = internalOnlyMiddleware({
      keys: options.internalKeys,
      maxBodyBytes: INTERNAL_BODY_LIMIT_BYTES,
      log: (message) => {
        Logger.warn(message, INTERNAL_GUARD_LOG_CONTEXT);
      },
    });
    for (const route of internalOnlyPrefixes(config.apiOptions.shopApiPath)) {
      config.apiOptions.middleware.push({ route, handler, beforeListen: true });
    }
    config.apiOptions.middleware.push({
      route: WEBHOOK_ROUTE_PREFIX,
      handler: rawBodyMiddleware({
        limit: WEBHOOK_BODY_LIMIT_BYTES,
        log: (message) => {
          Logger.warn(message, WEBHOOKS_LOG_CONTEXT);
        },
      }),
      beforeListen: true,
    });
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== KEY_PURGE_TASK_ID),
      inboundKeyPurgeTask,
    ];
    return config;
  },
  compatibility: '^3.8.0',
})
export class PlatformWebhooksPlugin {
  static options: PlatformWebhooksOptions | undefined;

  constructor(
    @Inject(InboundWebhookHandlerRegistry) private readonly registry: InboundWebhookHandlerRegistry,
    @Inject(JobReconciler) private readonly reconciler: JobReconciler,
    @Inject(InboundReconcileSource) private readonly reconcileSource: InboundReconcileSource,
  ) {}

  /** The reconciler checks the gateway's stored webhooks too (D105). */
  onModuleInit(): void {
    this.reconciler.registerSource(this.reconcileSource);
  }

  /** Every `onModuleInit` has run: providers can no longer register. */
  onApplicationBootstrap(): void {
    this.registry.close();
  }

  /** Registers the plugin with the keys that verify internal requests. */
  static init(options: PlatformWebhooksOptions): typeof PlatformWebhooksPlugin {
    PlatformWebhooksPlugin.options = options;
    return PlatformWebhooksPlugin;
  }
}
