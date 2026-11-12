import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type JobQueue, JobQueueService, PluginCommonModule, VendurePlugin } from '@vendure/core';

/** The two probe queues of the stock strategy: one stands for the critical pool, one for the bulk pool (ADR 0013). */
export const PROBE_QUEUES = ['probe-critical', 'probe-bulk'] as const;

/** One of the {@link PROBE_QUEUES}. */
export type ProbeQueueName = (typeof PROBE_QUEUES)[number];

/** Registry queues the pool probes use: `order-effects` is critical, `analytics` is bulk (D100, D101). */
export const POOL_PROBE_QUEUES = ['order-effects', 'analytics'] as const;

/** One of the {@link POOL_PROBE_QUEUES}. */
export type PoolProbeQueueName = (typeof POOL_PROBE_QUEUES)[number];

/** What a probe job returns, so the test can tell which processor ran it. */
export interface ProbeResult {
  readonly processedBy: string;
}

type ProbeJobData = Record<string, never>;

/** Creates probe queues; each processor only reports its queue's name. */
@Injectable()
export abstract class ProbeService<Name extends string> implements OnModuleInit {
  private readonly queues = new Map<Name, JobQueue<ProbeJobData>>();

  protected abstract readonly names: readonly Name[];

  constructor(private readonly jobQueueService: JobQueueService) {}

  async onModuleInit(): Promise<void> {
    for (const name of this.names) {
      const queue = await this.jobQueueService.createQueue<ProbeJobData>({
        name,
        process: async (): Promise<ProbeResult> => Promise.resolve({ processedBy: name }),
      });
      this.queues.set(name, queue);
    }
  }

  /** Adds one job (no retries) to a probe queue and returns the id the job queue strategy gave it. */
  async enqueue(name: Name): Promise<string> {
    const queue = this.queues.get(name);
    if (queue === undefined) {
      throw new Error(`Probe queue ${name} was not created`);
    }
    const job = await queue.add({}, { retries: 0 });
    if (job.id === null) {
      throw new Error(`The ${name} job has no id`);
    }
    return String(job.id);
  }
}

/** The stock-strategy probes. */
@Injectable()
export class QueueProbeService extends ProbeService<ProbeQueueName> {
  protected readonly names = PROBE_QUEUES;
}

/** The pool probes on registry queues. */
@Injectable()
export class PoolProbeService extends ProbeService<PoolProbeQueueName> {
  protected readonly names = POOL_PROBE_QUEUES;
}

/** Test-only plugin: two job queues to check which ones a worker with `activeQueues` processes. */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [QueueProbeService],
  compatibility: '^3.0.0',
})
// A Vendure plugin is a decorated class; its body stays empty when it only registers providers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class QueueProbePlugin {}

/** Test-only plugin: one critical and one bulk registry queue, to check that pools keep their jobs apart. */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [PoolProbeService],
  compatibility: '^3.0.0',
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PoolProbePlugin {}
