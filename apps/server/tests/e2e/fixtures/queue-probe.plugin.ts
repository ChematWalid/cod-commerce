import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type JobQueue, JobQueueService, PluginCommonModule, VendurePlugin } from '@vendure/core';

/** The two probe queues: one stands for the critical pool, one for the bulk pool (ADR 0013). */
export const PROBE_QUEUES = ['probe-critical', 'probe-bulk'] as const;

/** One of the {@link PROBE_QUEUES}. */
export type ProbeQueueName = (typeof PROBE_QUEUES)[number];

/** What a probe job returns, so the test can tell which processor ran it. */
export interface ProbeResult {
  readonly processedBy: ProbeQueueName;
}

type ProbeJobData = Record<string, never>;

/** Creates the probe queues; each processor only reports its queue's name. */
@Injectable()
export class QueueProbeService implements OnModuleInit {
  private readonly queues = new Map<ProbeQueueName, JobQueue<ProbeJobData>>();

  constructor(private readonly jobQueueService: JobQueueService) {}

  async onModuleInit(): Promise<void> {
    for (const name of PROBE_QUEUES) {
      const queue = await this.jobQueueService.createQueue<ProbeJobData>({
        name,
        process: async (): Promise<ProbeResult> => Promise.resolve({ processedBy: name }),
      });
      this.queues.set(name, queue);
    }
  }

  /** Adds one job (no retries) to a probe queue and returns its BullMQ job id. */
  async enqueue(name: ProbeQueueName): Promise<string> {
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

/** Test-only plugin: two job queues to check which ones a worker with `activeQueues` processes. */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [QueueProbeService],
  compatibility: '^3.0.0',
})
// A Vendure plugin is a decorated class; its body stays empty when it only registers providers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class QueueProbePlugin {}
