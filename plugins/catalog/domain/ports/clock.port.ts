/** The current time, injected so use cases stay testable. */
export interface ClockPort {
  now(): Date;
}
