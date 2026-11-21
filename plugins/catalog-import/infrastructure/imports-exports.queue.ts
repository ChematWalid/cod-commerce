import { PlatformQueues } from '@cod/plugin-platform-jobs';
import { Injectable } from '@nestjs/common';
import { IMPORTS_EXPORTS_QUEUE } from '../domain/constants';
import type { ImportsExportsJobData } from '../domain/imports-exports-job';
import { jobDataOf, type JobRowRef } from '../domain/job-kinds';
import type { ImportsExportsJobRegistry } from './job-registry';

/**
 * Creates the `imports-exports` queue with the registry as its processor. catalog-import is its one definer (D2212);
 * call it from `onModuleInit` only.
 */
export function defineImportsExportsQueue(queues: PlatformQueues, registry: ImportsExportsJobRegistry): void {
  queues.define<ImportsExportsJobData>(IMPORTS_EXPORTS_QUEUE, (data, job) => registry.run(data, job));
}

/** Hands a stored job row to the queue; the export and confirm use cases call it after their row commits. */
@Injectable()
export class ImportsExportsQueue {
  constructor(private readonly queues: PlatformQueues) {}

  async enqueue(row: JobRowRef): Promise<void> {
    await this.queues.add(IMPORTS_EXPORTS_QUEUE, jobDataOf(row));
  }
}
