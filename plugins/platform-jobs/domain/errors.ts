import { DomainError } from '@cod/shared';

/** A job queue whose name is not in the queue registry (`QUEUES` in `@cod/shared`), so it has no pool (D97). */
export class UnregisteredQueueError extends DomainError {
  readonly code = 'platform-jobs.unregistered-queue';

  constructor(queueName: string) {
    super(`Queue "${queueName}" is not in the queue registry; add it to QUEUES in @cod/shared`);
  }
}
