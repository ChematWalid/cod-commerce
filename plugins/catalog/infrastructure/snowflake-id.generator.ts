import type { SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import { type Snowflake, toSnowflake } from '@cod/shared';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';

/** Catalog ids from the platform's ADR 0003 snowflake generator. */
export class SnowflakeCatalogIdGenerator implements IdGeneratorPort {
  constructor(private readonly ids: SnowflakeIdGeneratorPort) {}

  next(): Snowflake {
    return toSnowflake(this.ids.next());
  }
}
