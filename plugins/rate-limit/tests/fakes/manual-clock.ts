/** A clock a test moves by hand, in milliseconds. */
export class ManualClock {
  constructor(private current = 1_700_000_000_000) {}

  now = (): number => this.current;

  advanceSeconds(seconds: number): void {
    this.current += seconds * 1000;
  }
}
