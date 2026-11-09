import type { Snowflake } from '@cod/shared';

/** Hands out new, time-ordered ids (ADR 0003). */
export interface IdGeneratorPort {
  next(): Snowflake;
}
