import { PlatformQueues } from '@cod/plugin-platform-jobs';
import {
  DURABLE_JOB_KINDS,
  type DurableJobData,
  durableJobId,
  isSnowflake,
  type QueueName,
  STOREFRONT_CACHE_TAG_PATTERN,
  STOREFRONT_REVALIDATE_MAX_TAGS,
} from '@cod/shared';
import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { z } from 'zod';
import { StorefrontRevalidation } from '../application/storefront-revalidation.service';
import { PURGE_FLUSH_INTERVAL_MS } from '../domain/constants';
import type { RevalidationJob, RevalidationQueuePort } from '../domain/ports/revalidation-queue.port';

/** The queue of the storefront revalidations (ADR 0013: critical pool, 5 attempts). */
export const REVALIDATE_QUEUE: QueueName = 'storefront-revalidate';
const LOG_CONTEXT = 'StorefrontRevalidateWorker';

/** The job's payload: the store and the tags to expire. */
interface RevalidateJobData extends DurableJobData {
  readonly storeId: string;
  readonly tags: readonly string[];
}

const jobDataSchema = z.object({
  jobId: z.string().min(1),
  delayMs: z.number().optional(),
  storeId: z.string().refine(isSnowflake),
  tags: z.array(z.string().regex(STOREFRONT_CACHE_TAG_PATTERN)).min(1).max(STOREFRONT_REVALIDATE_MAX_TAGS),
});

/** {@link RevalidationQueuePort} on the platform's durable queues: one job per store and cause. */
@Injectable()
export class PlatformRevalidationQueue implements RevalidationQueuePort {
  constructor(private readonly queues: PlatformQueues) {}

  enqueue(job: RevalidationJob): Promise<void> {
    const data: RevalidateJobData = {
      jobId: durableJobId(DURABLE_JOB_KINDS.storefrontRevalidate, job.storeId, job.key),
      storeId: job.storeId,
      tags: job.tags,
      ...(job.delayMs === undefined ? {} : { delayMs: job.delayMs }),
    };
    return this.queues.add(REVALIDATE_QUEUE, data);
  }
}

/**
 * The processor of `storefront-revalidate`: expires the tags on the storefront, then purges the store's hostnames
 * through the coalescer (D3210, D3211). A storefront refusal fails the job, which retries; a purge a window held back
 * is sent by a timer of this process.
 */
@Injectable()
export class StorefrontRevalidateWorker implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly queues: PlatformQueues,
    private readonly revalidation: StorefrontRevalidation,
  ) {}

  onModuleInit(): void {
    this.queues.define<RevalidateJobData>(REVALIDATE_QUEUE, (data) => this.process(data));
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.flush(), PURGE_FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Runs one revalidation; a malformed payload is logged and dropped, since a retry cannot fix it. */
  async process(data: RevalidateJobData): Promise<void> {
    const parsed = jobDataSchema.safeParse(data);
    if (!parsed.success) {
      Logger.error(`Storefront revalidate job ${data.jobId} dropped: its payload is malformed`, LOG_CONTEXT);
      return;
    }
    await this.revalidation.revalidate(parsed.data.storeId, parsed.data.tags);
  }

  private async flush(): Promise<void> {
    try {
      await this.revalidation.flushPurges();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : typeof error;
      Logger.error(`Held-back CDN purges failed: ${reason}`, LOG_CONTEXT);
    }
  }
}
