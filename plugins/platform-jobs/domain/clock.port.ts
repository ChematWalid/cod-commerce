/** The time, in epoch milliseconds, that time-dependent platform services read; tests move it by hand. */
export interface PlatformClock {
  now(): number;
}

/** Injection token of the {@link PlatformClock}. */
export const PLATFORM_CLOCK: unique symbol = Symbol('PlatformClock');

/** The production clock. */
export const SYSTEM_CLOCK: PlatformClock = { now: () => Date.now() };
