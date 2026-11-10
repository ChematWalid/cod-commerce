import { DomainError } from '@cod/shared';

/** A job queue whose name is not in the queue registry (`QUEUES` in `@cod/shared`), so it has no pool (D97). */
export class UnregisteredQueueError extends DomainError {
  readonly code = 'platform-jobs.unregistered-queue';

  constructor(queueName: string) {
    super(`Queue "${queueName}" is not in the queue registry; add it to QUEUES in @cod/shared`);
  }
}

/** The business already runs as many jobs on the queue as its semaphore allows; retry after `retryAfterMs` (D100). */
export class SemaphoreBusyError extends DomainError {
  readonly code = 'jobs.semaphore-busy';

  constructor(readonly retryAfterMs: number) {
    super(`The business is at its concurrency limit on this queue; retry in ${String(retryAfterMs)} ms`);
  }
}

/** The provider account's breaker is open; nothing was called. Retry after `retryAfterMs` (D100). */
export class CircuitOpenError extends DomainError {
  readonly code = 'jobs.circuit-open';

  constructor(readonly retryAfterMs: number) {
    super(`The provider account's circuit is open; retry in ${String(retryAfterMs)} ms`);
  }
}
