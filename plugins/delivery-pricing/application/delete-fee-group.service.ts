import { DeliveryFeeGroupInUseError, DeliveryFeeGroupNotFoundError } from '../domain/errors';
import { groupIdOf } from '../domain/group-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/**
 * Deletes a fee group of the active store. The group row is locked `FOR UPDATE` first, so a delete cannot race a
 * store linking it (the link check locks it `FOR SHARE`, D3111).
 */
export class DeleteFeeGroupService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /**
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed id.
   * @throws {DeliveryFeeGroupInUseError} for the store's platform default or its default group (D3108).
   */
  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    const id = groupIdOf(rawId);
    if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      const group = await this.ports.groups.lock(tx, scope, id);
      if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
      if (group.isPlatformDefault) throw new DeliveryFeeGroupInUseError();
      if ((await this.ports.storeDefaults.defaultGroupOf(tx, scope)) === id) throw new DeliveryFeeGroupInUseError();
      await this.ports.groups.delete(tx, scope, id);
    });
  }
}
