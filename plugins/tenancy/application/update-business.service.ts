import { type BusinessId, toSnowflake } from '@cod/shared';
import type { Business } from '../domain/business';
import { BusinessNotFoundError } from '../domain/errors';
import { assertValidName } from '../domain/name';
import type { OperationContext } from '../domain/ports/operation-context';
import type { BusinessPatch } from '../domain/ports/platform-store.port';
import { assertAssetInChannels, channelsOf } from './asset-rules';
import type { StoreAdminPorts } from './store-admin-ports';

/** Changes a business's own settings. */
export class UpdateBusinessService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /** @throws {@link NameInvalidError}, {@link BusinessNotFoundError} or {@link AssetNotAvailableError}. */
  async update(ctx: OperationContext, tenantId: BusinessId, patch: BusinessPatch): Promise<Business> {
    const businessId = toSnowflake(tenantId);
    if (patch.name !== undefined) {
      assertValidName(patch.name);
    }
    const business = await this.ports.platform.findBusiness(ctx, businessId);
    if (business === undefined) {
      throw new BusinessNotFoundError();
    }
    await this.assertLogoAllowed(ctx, tenantId, business, patch);
    await this.ports.platform.updateBusiness(ctx, businessId, patch);
    return { ...business, ...patch };
  }

  private async assertLogoAllowed(
    ctx: OperationContext,
    tenantId: BusinessId,
    business: Business,
    { logoAssetId }: BusinessPatch,
  ): Promise<void> {
    if (logoAssetId === undefined || logoAssetId === null || logoAssetId === business.logoAssetId) return;
    const stores = await this.ports.platform.findStoreAccess(ctx, tenantId);
    await assertAssetInChannels(this.ports.assets, ctx, logoAssetId, channelsOf(stores));
  }
}
