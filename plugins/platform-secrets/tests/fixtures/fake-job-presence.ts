import type { JobPresence, JobPresencePort } from '@cod/plugin-platform-jobs';

/**
 * What BullMQ would say about jobs, for tests on the in-memory job strategy, which cannot leave a job failed the way
 * a pool does. The ids in `failed` read as failed until `remove` is called for them.
 */
export class FakeJobPresence implements JobPresencePort {
  readonly removed: string[] = [];

  constructor(private readonly failed: Set<string>) {}

  stateOf(_queue: string, jobId: string): Promise<JobPresence> {
    return Promise.resolve(this.failed.has(jobId) ? 'failed' : 'missing');
  }

  dueAtOf(): Promise<Date | null> {
    return Promise.resolve(null);
  }

  remove(_queue: string, jobId: string): Promise<void> {
    this.removed.push(jobId);
    this.failed.delete(jobId);
    return Promise.resolve();
  }
}
