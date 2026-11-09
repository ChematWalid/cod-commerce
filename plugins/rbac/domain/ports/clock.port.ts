/** The current time, so use cases do not read the system clock. */
export interface ClockPort {
  now(): Date;
}
