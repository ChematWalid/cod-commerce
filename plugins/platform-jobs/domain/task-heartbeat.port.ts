/** Reads when each scheduled task last finished a run without error (D120). */
export abstract class TaskHeartbeatReader {
  /** The last success of every task that has one, by task id. */
  abstract lastSuccess(): Promise<ReadonlyMap<string, Date>>;
}

/** Records that a scheduled task finished a run without error (D120). */
export interface TaskHeartbeatWriter {
  recordSuccess(taskId: string, at: Date): Promise<void>;
}
