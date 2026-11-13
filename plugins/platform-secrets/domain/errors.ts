import { DomainError } from '@cod/shared';
import { SECRET_VALUE_MAX_BYTES } from './constants';

/** No provider with that name registered itself. The message never repeats the name: it comes from the caller. */
export class UnknownProviderError extends DomainError {
  readonly code = 'tenant-secret.unknown-provider';

  constructor() {
    super('No secret provider with that name is registered');
  }
}

/** A value or ref the secret store cannot take. `reason` names the rule, never the input. */
export class InvalidSecretValueError extends DomainError {
  readonly code = 'tenant-secret.invalid-value';

  constructor(reason: string) {
    super(`Secret input rejected: ${reason}`);
  }
}

/** The value is empty, over {@link SECRET_VALUE_MAX_BYTES} bytes, or not well-formed text. */
export function invalidValueSize(): InvalidSecretValueError {
  return new InvalidSecretValueError(`a value has 1 to ${String(SECRET_VALUE_MAX_BYTES)} bytes of well-formed text`);
}

/** The business has no secret with that provider and ref, or no secret with that id (another business's counts as none). */
export class SecretNotFoundError extends DomainError {
  readonly code = 'tenant-secret.not-found';

  constructor() {
    super('No such secret');
  }
}

/**
 * A stored secret or data key does not open: a different key, owner, provider or ref than it was sealed with, or
 * altered bytes. The message carries nothing of the row.
 */
export class SecretUnreadableError extends DomainError {
  readonly code = 'tenant-secret.unreadable';

  constructor() {
    super('The stored secret cannot be read');
  }
}

/** A provider registered with a bad name, or twice. */
export class ProviderRegistrationError extends DomainError {
  readonly code = 'tenant-secret.provider-invalid';

  constructor(reason: string) {
    super(`Secret provider cannot be registered: ${reason}`);
  }
}
