import type { ClockPort } from '../../domain/ports/clock.port';

/** A clock a test moves by hand. */
export class ManualClock implements ClockPort {
  private current = new Date('2026-11-09T10:00:00.000Z').getTime();

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
