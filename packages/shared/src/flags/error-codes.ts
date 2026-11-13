/** Stable error codes of the flags Admin API; the staff screen maps them to translated messages. */
export const FLAG_ERROR_CODES = {
  UNKNOWN_KEY: 'flags.unknown-key',
  INVALID_ROLLOUT: 'flags.invalid-rollout',
  INVALID_DESCRIPTION: 'flags.invalid-description',
  UNKNOWN_SCOPE_TARGET: 'flags.unknown-scope-target',
  INVALID_PLAN_KEY: 'flags.invalid-plan-key',
} as const;

/** One of the {@link FLAG_ERROR_CODES} values. */
export type FlagErrorCode = (typeof FLAG_ERROR_CODES)[keyof typeof FLAG_ERROR_CODES];
