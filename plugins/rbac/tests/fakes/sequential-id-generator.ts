import { type Snowflake, toSnowflake } from '@cod/shared';
import type { IdGeneratorPort } from '../../domain/ports/id-generator.port';

/** Ids 1, 2, 3 …, so a test knows each row's id. */
export class SequentialIdGenerator implements IdGeneratorPort {
  private last = 0;

  next(): Snowflake {
    this.last += 1;
    return toSnowflake(String(this.last));
  }
}
