/** The largest request body the guard reads (D112); a bigger one is answered with 413. */
export const INTERNAL_BODY_LIMIT_BYTES = 102_400;

/** The logger context of the guard. */
export const INTERNAL_GUARD_LOG_CONTEXT = 'InternalOnlyGuard';
