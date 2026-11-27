import { PlatformStoreLookup } from '@cod/plugin-tenancy';
import { InvalidSnowflakeError, type Snowflake, type StoreId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { ServedStores } from '../domain/ports/served-stores.port';

/** A query parameter as a snowflake: a missing, repeated or malformed one is `null`. */
function snowflakeOf(raw: unknown): Snowflake | null {
  if (typeof raw !== 'string') return null;
  try {
    return toSnowflake(raw);
  } catch (error) {
    if (error instanceof InvalidSnowflakeError) return null;
    throw error;
  }
}

/**
 * {@link ServedStores} over tenancy's {@link PlatformStoreLookup}: the same store-by-id read as `GET /store/by-id`, so
 * the signed provinces route serves exactly the stores the storefront resolves (active, of an active business).
 */
@Injectable()
export class TenancyServedStores implements ServedStores {
  constructor(private readonly lookup: PlatformStoreLookup) {}

  async servedStore(raw: unknown): Promise<StoreId | null> {
    const id = snowflakeOf(raw);
    if (id === null) return null;
    const row = await this.lookup.findById(id);
    return row === null ? null : toStoreId(id);
  }
}
