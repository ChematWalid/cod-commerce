/** The current time, replaceable in tests. */
export interface ClockPort {
  now(): Date;
}
