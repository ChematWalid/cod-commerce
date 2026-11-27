import { isSnowflake, type Snowflake } from '@cod/shared';

/** A fee-group id as sent, or `undefined` for text that names no row (which answers "not found", like a foreign id). */
export const groupIdOf = (raw: string): Snowflake | undefined => (isSnowflake(raw) ? raw : undefined);
