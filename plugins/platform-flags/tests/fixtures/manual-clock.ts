import type { PlatformClock } from '@cod/plugin-platform-jobs';

/** A clock a test moves by hand, in milliseconds. */
export class ManualClock implements PlatformClock {
  constructor(private current = Date.now()) {}

  now = (): number => this.current;

  set(ms: number): void {
    this.current = ms;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
