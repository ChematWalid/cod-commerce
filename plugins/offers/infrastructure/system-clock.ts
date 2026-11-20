import type { Clock } from '../domain/ports/clock.port';

/** The server's clock: offers, codes and quote tokens are dated from it. */
export const SYSTEM_CLOCK: Clock = { now: () => new Date() };
