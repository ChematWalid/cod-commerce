import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { isQueueName, QUEUES, type DurableJobData, type QueueName } from '@cod/shared';
import { ConfigService, type JobQueue, JobQueueService, Logger } from '@vendure/core';
import { PlatformQueues, type QueueProcessor } from '../application/platform-queues';
import {
  QueueAlreadyDefinedError,
  QueueNotDefinedError,
  QueueRegistryClosedError,
  UnregisteredQueueError,
} from '../domain/errors';
import { jobAttemptOf } from './job-attempt';

const LOG_CONTEXT = 'PlatformQueues';

/** {@link PlatformQueues} on Vendure's job queue service: one Vendure queue per registry name. */
@Injectable()
export class VendurePlatformQueues extends PlatformQueues implements OnApplicationBootstrap {
  private readonly queues = new Map<QueueName, Promise<JobQueue<DurableJobData>>>();
  private closed = false;

  constructor(
    private readonly jobQueues: JobQueueService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  /** Every `onModuleInit` has run by now, so no further definition is accepted. */
  async onApplicationBootstrap(): Promise<void> {
    this.closed = true;
    await Promise.all(this.queues.values());
  }

  define<Data extends DurableJobData>(name: QueueName, process: QueueProcessor<Data>): void {
    if (!isQueueName(name)) throw new UnregisteredQueueError(name);
    if (this.closed) throw new QueueRegistryClosedError(name);
    if (this.queues.has(name)) throw new QueueAlreadyDefinedError(name);
    const created = this.jobQueues.createQueue<DurableJobData>({
      name,
      process: (job) => process(job.data as Data, jobAttemptOf(job, this.config)),
    });
    // The failure reaches bootstrap and every `add`; this only makes sure it is logged once and never unhandled.
    created.then(undefined, (error: unknown) => {
      Logger.error(`Queue ${name} could not be created: ${String(error)}`, LOG_CONTEXT);
    });
    this.queues.set(name, created);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see PlatformQueues.add
  async add<Data extends DurableJobData>(name: QueueName, data: Data): Promise<void> {
    const created = this.queues.get(name);
    if (created === undefined) throw new QueueNotDefinedError(name);
    const queue = await created;
    await queue.add(data, { retries: QUEUES[name].attempts - 1 });
  }
}
