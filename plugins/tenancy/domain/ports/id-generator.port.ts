import type { Snowflake } from '@cod/shared';

/** Hands out new ids; ids are made by the application before insert, never by the database (ADR 0003). */
export interface IdGeneratorPort {
  next(): Snowflake;
}
