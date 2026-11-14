import type { Snowflake } from '@cod/shared';

/** Hands out new, time-ordered ids, made before insert (ADR 0003). */
export interface IdGeneratorPort {
  next(): Snowflake;
}
