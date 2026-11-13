import type { JobPresence, JobPresencePort } from '@cod/plugin-platform-jobs';
import type { QueueName } from '@cod/shared';

/** A call the reconciler made: what, on which queue, for which job. */
export type PresenceCall = readonly [string, QueueName, string];

/** What BullMQ would say about jobs; removals are appended to the `calls` the test shares with its fake queue. */
export class FakePresence implements JobPresencePort {
  readonly states = new Map<string, JobPresence>();
  readonly dueAt = new Map<string, Date>();

  constructor(private readonly calls: PresenceCall[]) {}

  stateOf(_queue: QueueName, jobId: string): Promise<JobPresence> {
    return Promise.resolve(this.states.get(jobId) ?? 'missing');
  }

  dueAtOf(_queue: QueueName, jobId: string): Promise<Date | null> {
    return Promise.resolve(this.dueAt.get(jobId) ?? null);
  }

  remove(queue: QueueName, jobId: string): Promise<void> {
    this.calls.push(['remove', queue, jobId]);
    return Promise.resolve();
  }
}
