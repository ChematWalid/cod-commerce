import type { PlatformClock } from '../../domain/clock.port';

/** A clock a test moves by hand, in milliseconds. */
export class ManualClock implements PlatformClock {
  constructor(private current = 1_700_000_000_000) {}

  now = (): number => this.current;

  set(ms: number): void {
    this.current = ms;
  }

  advanceMs(ms: number): void {
    this.current += ms;
  }
}
