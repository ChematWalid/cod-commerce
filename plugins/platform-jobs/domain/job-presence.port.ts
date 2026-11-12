import type { QueueName } from '@cod/shared';

/**
 * What BullMQ keeps of a job: nothing (`missing`, e.g. lost with Valkey), a job still to run (`live`: waiting,
 * active, prioritized), a job waiting out its own backoff (`delayed`), or a settled job it still holds (`failed`, `completed`). Read by the reconciler (D105).
 */
export type JobPresence = 'missing' | 'live' | 'delayed' | 'failed' | 'completed';

/** Looks a durable job up by its BullMQ id (e.g. `od-7301-demo-log`) in its queue's pool. */
export interface JobPresencePort {
  /** The job's presence in BullMQ. */
  stateOf(queue: QueueName, jobId: string): Promise<JobPresence>;
  /** When a `delayed` job comes due (BullMQ's delayed set score); null when the job is not delayed. */
  dueAtOf(queue: QueueName, jobId: string): Promise<Date | null>;
  /** Removes the job so that an add with the same id is no longer ignored; nothing happens when it is missing. */
  remove(queue: QueueName, jobId: string): Promise<void>;
}

const SETTLED: Readonly<Record<string, JobPresence>> = {
  delayed: 'delayed',
  failed: 'failed',
  completed: 'completed',
  unknown: 'missing',
};

/** Reads a BullMQ job state (`Job.getState()`) as a {@link JobPresence}; every other state is still to run (a `delayed` job is waiting out its backoff). */
export function presenceOf(state: string): JobPresence {
  return SETTLED[state] ?? 'live';
}
