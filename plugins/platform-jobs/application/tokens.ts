/** Injection token of the `JobPresencePort` adapter. */
export const JOB_PRESENCE: unique symbol = Symbol('PlatformJobPresence');

/** Injection token of the {@link TaskHeartbeatWriter} adapter; a scheduled task reads it from its injector. */
export const TASK_HEARTBEAT_WRITER: unique symbol = Symbol('PlatformTaskHeartbeatWriter');
