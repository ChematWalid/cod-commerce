import {
  BusinessSemaphore,
  PLATFORM_CLOCK,
  type PlatformClock,
  PlatformQueues,
  SemaphoreBusyError,
  semaphoreRetryDelayMs,
} from '@cod/plugin-platform-jobs';
import {
  DURABLE_JOB_KINDS,
  type DurableJobData,
  durableJobId,
  isSnowflake,
  NORMAL_FORM_VERSION,
  type QueueName,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { z } from 'zod';
import { RecomputeStoreService } from '../application/recompute-store.service';
import { ID_GENERATOR } from '../application/tokens';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import { asOperationContext } from '../domain/ports/operation-context';
import type { ReconcileReason, StoreReconcileQueuePort } from '../domain/ports/store-reconcile.port';
import type { StoreScope } from '../domain/store-scope';
import { utcDayKey, utcHourKey } from '../domain/utc-time-keys';
import { StoreChannelContexts } from './store-channel-context';

/** The queue of the store reconcile job `collections.recompute-store` (D2336, ADR 0013 amendment). */
export const RECONCILE_QUEUE: QueueName = 'catalog-reconcile';
const LOG_CONTEXT = 'CollectionsRecomputeStoreJob';
/** At most one whole-store walk per business at a time (ADR 0013 amendment, fairness rule a). */
const RECONCILES_PER_BUSINESS = 1;

/** The job's payload: ids only (ADR 0013 amendment, rule d). */
interface RecomputeStoreJobData extends DurableJobData {
  readonly businessId: string;
  readonly storeId: string;
}

const jobDataSchema = z.object({
  jobId: z.string().min(1),
  delayMs: z.number().optional(),
  businessId: z.string().refine(isSnowflake),
  storeId: z.string().refine(isSnowflake),
});

/**
 * {@link StoreReconcileQueuePort} on the platform's durable queues. A bootstrap or nightly reconcile has one id per
 * store and version or UTC day, so a repeat is ignored. Failed deliveries of one store share one id per UTC hour: a
 * systemic failure during an import would otherwise queue one whole-store walk per product, and one run reads the
 * latest rules and facts once it holds the store lock. A save always queues a new run, since the store may have
 * changed after a started one read it.
 */
@Injectable()
export class PlatformStoreReconcileQueue implements StoreReconcileQueuePort {
  constructor(
    private readonly queues: PlatformQueues,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(PLATFORM_CLOCK) private readonly clock: PlatformClock,
  ) {}

  enqueue(scope: StoreScope, reason: ReconcileReason): Promise<void> {
    const data: RecomputeStoreJobData = {
      jobId: durableJobId(DURABLE_JOB_KINDS.collectionsReconcile, scope.storeId, this.runKeyOf(reason)),
      businessId: scope.businessId,
      storeId: scope.storeId,
    };
    return this.queues.add(RECONCILE_QUEUE, data);
  }

  private runKeyOf(reason: ReconcileReason): string {
    if (reason === 'version') return `v${String(NORMAL_FORM_VERSION)}`;
    if (reason === 'nightly') return `n${utcDayKey(this.clock.now())}`;
    if (reason === 'delivery') return `d${utcHourKey(this.clock.now())}`;
    return this.ids.next();
  }
}

/** The processor of `collections.recompute-store`: rebuilds one store's automatic collections on its channel. */
@Injectable()
export class RecomputeStoreJob implements OnModuleInit {
  constructor(
    private readonly queues: PlatformQueues,
    private readonly semaphore: BusinessSemaphore,
    private readonly storeContexts: StoreChannelContexts,
    private readonly stores: RecomputeStoreService,
  ) {}

  onModuleInit(): void {
    this.queues.define<RecomputeStoreJobData>(RECONCILE_QUEUE, (data) => this.process(data));
  }

  /** A busy business re-queues the job with jitter instead of holding a worker (D103). */
  private async process(data: RecomputeStoreJobData): Promise<void> {
    const parsed = jobDataSchema.safeParse(data);
    if (!parsed.success) {
      Logger.error(`Store reconcile job ${data.jobId} dropped: its payload is malformed`, LOG_CONTEXT);
      return;
    }
    const scope: StoreScope = {
      businessId: toBusinessId(parsed.data.businessId),
      storeId: toStoreId(parsed.data.storeId),
    };
    const key = { queue: RECONCILE_QUEUE, businessId: scope.businessId };
    try {
      await this.semaphore.withBusinessSemaphore(key, RECONCILES_PER_BUSINESS, () => this.rebuild(scope));
    } catch (error) {
      if (!(error instanceof SemaphoreBusyError)) throw error;
      await this.queues.requeueWithDelay(RECONCILE_QUEUE, data, semaphoreRetryDelayMs(Math.random));
    }
  }

  private async rebuild(scope: StoreScope): Promise<void> {
    const onStore = await this.storeContexts.forJob(scope.businessId, scope.storeId);
    if (onStore === undefined) {
      Logger.info(
        `Store ${scope.storeId} of business ${scope.businessId} is missing or archived: no reconcile`,
        LOG_CONTEXT,
      );
      return;
    }
    const rebuilt = await this.stores.run(asOperationContext(onStore), scope);
    Logger.verbose(`Store ${scope.storeId} reconciled: ${String(rebuilt)} automatic collections rebuilt`, LOG_CONTEXT);
  }
}
