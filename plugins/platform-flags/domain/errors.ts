import { DomainError, FLAG_ERROR_CODES } from '@cod/shared';
import { FLAG_DESCRIPTION_MAX_LENGTH, ROLLOUT_MAX_PERCENT, ROLLOUT_MIN_PERCENT } from './constants';

/** No flag has that key: flags exist only as seeds (D116). The message does not repeat the key, which the caller chose. */
export class UnknownFlagKeyError extends DomainError {
  readonly code = FLAG_ERROR_CODES.UNKNOWN_KEY;

  constructor() {
    super('No feature flag has that key');
  }
}

/** A rollout percent that is not an integer from 0 to 100. */
export class InvalidRolloutError extends DomainError {
  readonly code = FLAG_ERROR_CODES.INVALID_ROLLOUT;

  constructor() {
    super(`A rollout percent is an integer from ${String(ROLLOUT_MIN_PERCENT)} to ${String(ROLLOUT_MAX_PERCENT)}`);
  }
}

/** A description that is empty or too long. */
export class InvalidDescriptionError extends DomainError {
  readonly code = FLAG_ERROR_CODES.INVALID_DESCRIPTION;

  constructor() {
    super(`A flag description has 1 to ${String(FLAG_DESCRIPTION_MAX_LENGTH)} characters`);
  }
}

/** An override aimed at a business or an active store that does not exist, or at an id that is not one (D116). */
export class UnknownScopeTargetError extends DomainError {
  readonly code = FLAG_ERROR_CODES.UNKNOWN_SCOPE_TARGET;

  constructor() {
    super('The business or store the override names does not exist');
  }
}

/** A plan key that is empty or too long. */
export class InvalidPlanKeyError extends DomainError {
  readonly code = FLAG_ERROR_CODES.INVALID_PLAN_KEY;

  constructor() {
    super('A plan key is 1 to 64 characters');
  }
}
