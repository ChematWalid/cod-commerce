/** Makes a change to what a user can do effective on their next request (D55). */
export interface SessionFlusherPort {
  /**
   * Evicts the cached sessions of these administrators, now and once more after a delay. Call it after commit. It
   * never rejects: on failure the bound is the session cache TTL, and the failure is logged.
   */
  flushAdministrators(administratorIds: readonly number[]): Promise<void>;
}
