import { DomainError } from '@cod/shared';

/** A job queue whose name is not in the queue registry (`QUEUES` in `@cod/shared`), so it has no pool (D100). */
export class UnregisteredQueueError extends DomainError {
  readonly code = 'platform-jobs.unregistered-queue';

  constructor(queueName: string) {
    super(`Queue "${queueName}" is not in the queue registry; add it to QUEUES in @cod/shared`);
  }
}

/** The business already runs as many jobs on the queue as its semaphore allows; retry after `retryAfterMs` (D103). */
export class SemaphoreBusyError extends DomainError {
  readonly code = 'jobs.semaphore-busy';

  constructor(readonly retryAfterMs: number) {
    super(`The business is at its concurrency limit on this queue; retry in ${String(retryAfterMs)} ms`);
  }
}

/** The provider account's breaker is open; nothing was called. Retry after `retryAfterMs` (D103). */
export class CircuitOpenError extends DomainError {
  readonly code = 'jobs.circuit-open';

  constructor(readonly retryAfterMs: number) {
    super(`The provider account's circuit is open; retry in ${String(retryAfterMs)} ms`);
  }
}

/** A queue name was defined twice; every queue has one processor (D99). */
export class QueueAlreadyDefinedError extends DomainError {
  readonly code = 'platform-jobs.queue-already-defined';

  constructor(queueName: string) {
    super(`Queue "${queueName}" already has a processor`);
  }
}

/** A queue was defined after bootstrap; definitions belong in `onModuleInit` so every process creates the queue. */
export class QueueRegistryClosedError extends DomainError {
  readonly code = 'platform-jobs.queue-registry-closed';

  constructor(queueName: string) {
    super(`Queue "${queueName}" was defined after bootstrap; define queues in onModuleInit`);
  }
}

/** A job was added to a registered queue that no plugin of this process defined. */
export class QueueNotDefinedError extends DomainError {
  readonly code = 'platform-jobs.queue-not-defined';

  constructor(queueName: string) {
    super(`Queue "${queueName}" has no processor defined in this process`);
  }
}

/** A scheduled task id the heartbeat table cannot store. */
export class InvalidTaskIdError extends DomainError {
  readonly code = 'platform-jobs.invalid-task-id';

  constructor(taskId: string) {
    super(`Task id "${taskId}" must be 1 to 100 characters`);
  }
}
