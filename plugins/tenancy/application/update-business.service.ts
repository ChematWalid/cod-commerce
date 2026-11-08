import { type BusinessId, toSnowflake } from '@cod/shared';
import type { Business } from '../domain/business';
import { BusinessNotFoundError } from '../domain/errors';
import { assertValidName } from '../domain/name';
import type { OperationContext } from '../domain/ports/operation-context';
import type { BusinessPatch } from '../domain/ports/platform-store.port';
import type { StoreAdminPorts } from './store-admin-ports';

/** Changes a business's own settings. */
export class UpdateBusinessService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /** @throws {@link NameInvalidError} or {@link BusinessNotFoundError}. */
  async update(ctx: OperationContext, tenantId: BusinessId, patch: BusinessPatch): Promise<Business> {
    const businessId = toSnowflake(tenantId);
    if (patch.name !== undefined) {
      assertValidName(patch.name);
    }
    const business = await this.ports.platform.findBusiness(ctx, businessId);
    if (business === undefined) {
      throw new BusinessNotFoundError();
    }
    await this.ports.platform.updateBusiness(ctx, businessId, patch);
    return { ...business, ...patch };
  }
}
