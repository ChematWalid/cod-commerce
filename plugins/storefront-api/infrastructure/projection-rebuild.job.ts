import { PlatformQueues } from '@cod/plugin-platform-jobs';
import {
  DURABLE_JOB_KINDS,
  type DurableJobData,
  durableJobId,
  isSnowflake,
  type QueueName,
  storeTag,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { z } from 'zod';
import type { ProjectionSkip } from '../application/projection.service';
import { PROJECTION_REBUILDER, REVALIDATION_QUEUE_PORT } from '../application/tokens';
import type { ProjectionRebuildQueuePort } from '../domain/ports/projection-rebuild-queue.port';
import type { RevalidationQueuePort } from '../domain/ports/revalidation-queue.port';
import type { StoreScope } from '../domain/store-scope';

/** The queue of the projection rebuilds (D3222): a whole-store walk on the bulk pool. */
export const PROJECTION_REBUILD_QUEUE: QueueName = 'storefront-projection';
const LOG_CONTEXT = 'StorefrontProjectionRebuildJob';

/** Rebuilds the whole projection of a store in its own transaction (the backfill's path). */
export interface ProjectionRebuilder {
  rebuild(scope: StoreScope): Promise<number | ProjectionSkip>;
}

/** The job's payload: ids only. */
interface ProjectionRebuildJobData extends DurableJobData {
  readonly businessId: string;
  readonly storeId: string;
}

const jobDataSchema = z.object({
  jobId: z.string().min(1),
  delayMs: z.number().optional(),
  businessId: z.string().refine(isSnowflake),
  storeId: z.string().refine(isSnowflake),
});

/** {@link ProjectionRebuildQueuePort} on the platform's durable queues: one rebuild per store and cause. */
@Injectable()
export class PlatformProjectionRebuildQueue implements ProjectionRebuildQueuePort {
  constructor(private readonly queues: PlatformQueues) {}

  enqueue(scope: StoreScope, key: string): Promise<void> {
    const data: ProjectionRebuildJobData = {
      jobId: durableJobId(DURABLE_JOB_KINDS.storefrontProjectionRebuild, scope.storeId, key),
      businessId: scope.businessId,
      storeId: scope.storeId,
    };
    return this.queues.add(PROJECTION_REBUILD_QUEUE, data);
  }
}

/**
 * The processor of `storefront-projection`: rebuilds a store's rows after a settings change (product names are read
 * in the store language), then queues a revalidation of the store so its list pages re-render from the new rows.
 */
@Injectable()
export class ProjectionRebuildJob implements OnModuleInit {
  constructor(
    private readonly queues: PlatformQueues,
    @Inject(PROJECTION_REBUILDER) private readonly rebuilder: ProjectionRebuilder,
    @Inject(REVALIDATION_QUEUE_PORT) private readonly revalidations: RevalidationQueuePort,
  ) {}

  onModuleInit(): void {
    this.queues.define<ProjectionRebuildJobData>(PROJECTION_REBUILD_QUEUE, (data) => this.process(data));
  }

  /** Runs one rebuild; a malformed payload is logged and dropped, since a retry cannot fix it. */
  async process(data: ProjectionRebuildJobData): Promise<void> {
    const parsed = jobDataSchema.safeParse(data);
    if (!parsed.success) {
      Logger.error(`Projection rebuild job ${data.jobId} dropped: its payload is malformed`, LOG_CONTEXT);
      return;
    }
    const scope: StoreScope = {
      businessId: toBusinessId(parsed.data.businessId),
      storeId: toStoreId(parsed.data.storeId),
    };
    const outcome = await this.rebuilder.rebuild(scope);
    if (typeof outcome !== 'number') {
      Logger.info(`Projection rebuild of store ${scope.storeId} skipped: the store is unavailable`, LOG_CONTEXT);
      return;
    }
    await this.revalidations.enqueue({ key: data.jobId, storeId: scope.storeId, tags: [storeTag(scope.storeId)] });
  }
}
