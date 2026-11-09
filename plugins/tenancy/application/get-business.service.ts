import { type BusinessId, toSnowflake } from '@cod/shared';
import type { Business } from '../domain/business';
import { BusinessNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreAdminPorts } from './store-admin-ports';

/** Reads the caller's business. */
export class GetBusinessService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /** @throws {@link BusinessNotFoundError} when the row is gone. */
  async get(ctx: OperationContext, businessId: BusinessId): Promise<Business> {
    const business = await this.ports.platform.findBusiness(ctx, toSnowflake(businessId));
    if (business === undefined) {
      throw new BusinessNotFoundError();
    }
    return business;
  }
}
