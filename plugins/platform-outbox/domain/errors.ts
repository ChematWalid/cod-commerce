import { DomainError } from '@cod/shared';

/** `OutboxService.add` ran outside a transaction, so the event could not commit or roll back with the caller's work. */
export class OutboxTransactionRequiredError extends DomainError {
  readonly code = 'outbox.transaction-required';

  constructor() {
    super('An outbox event must be written inside the transaction of the work it announces');
  }
}

/** An event input the outbox cannot store (a malformed id or key); the payload has its own error in `@cod/shared`. */
export class OutboxInputInvalidError extends DomainError {
  readonly code = 'outbox.input-invalid';

  constructor(reason: string) {
    super(`Outbox event input rejected: ${reason}`);
  }
}

/** A consumer registered after bootstrap; consumers belong in `onModuleInit` so every process knows them. */
export class OutboxRegistryClosedError extends DomainError {
  readonly code = 'outbox.registry-closed';

  constructor(consumer: string) {
    super(`Consumer "${consumer}" was registered after bootstrap; register consumers in onModuleInit`);
  }
}

/** A consumer name used twice, or one that is not kebab-case within 40 characters. */
export class OutboxConsumerInvalidError extends DomainError {
  readonly code = 'outbox.consumer-invalid';

  constructor(consumer: string, reason: string) {
    super(`Consumer "${consumer}" cannot be registered: ${reason}`);
  }
}

/** A delivery job names a consumer this process does not know. */
export class OutboxConsumerUnknownError extends DomainError {
  readonly code = 'outbox.consumer-unknown';

  constructor(consumer: string) {
    super(`No outbox consumer named "${consumer}" is registered in this process`);
  }
}

/** A delivery job names a row that does not exist (yet); the job retries. */
export class OutboxDeliveryMissingError extends DomainError {
  readonly code = 'outbox.delivery-missing';

  constructor(outboxId: string, consumer: string) {
    super(`No delivery of event ${outboxId} to consumer "${consumer}"`);
  }
}

/** A consumer throws this to end its delivery as `parked`: it cannot succeed, and retrying would not help (D105). */
export class OutboxParkError extends DomainError {
  readonly code = 'outbox.park';
}
