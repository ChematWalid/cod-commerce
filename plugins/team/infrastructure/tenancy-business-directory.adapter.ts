import { asOperationContext as asTenancyContext, BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { type BusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** {@link BusinessDirectoryPort} on tenancy's platform-wide directory, which returns ids and links only. */
@Injectable()
export class TenancyBusinessDirectoryAdapter implements BusinessDirectoryPort {
  constructor(private readonly directory: BusinessStoreDirectory) {}

  async page(ctx: OperationContext, afterId: BusinessId | undefined, limit: number): Promise<readonly BusinessId[]> {
    const after = afterId === undefined ? undefined : toSnowflake(afterId);
    const businesses = await this.directory.allBusinessIds(asTenancyContext(toRequestContext(ctx)), after, limit);
    return businesses.map((business) => business.id);
  }
}
