import type { ClockPort } from '../../domain/ports/clock.port';

/** A clock that always reads `at`. */
export class FixedClock implements ClockPort {
  constructor(private readonly at: Date) {}

  now(): Date {
    return this.at;
  }
}
