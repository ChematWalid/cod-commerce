import { DeliveryFeeGroupNotFoundError } from '../domain/errors';
import type { FeeGroupRecord } from '../domain/fee-group';
import { groupIdOf } from '../domain/group-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** The work of a bulk write on the store's group, given the transactional context and the group as read under lock. */
export type LockedGroupWork = (tx: OperationContext, group: FeeGroupRecord) => Promise<void>;

/**
 * Runs `work` on the store's group `rawId` in one transaction, the group row locked `FOR UPDATE` first, then answers
 * the group as written.
 *
 * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed id, checked first.
 */
export async function withLockedGroup(
  ports: FeeGroupPorts,
  ctx: OperationContext,
  scope: StoreScope,
  rawId: string,
  work: LockedGroupWork,
): Promise<FeeGroupRecord> {
  const id = groupIdOf(rawId);
  if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
  return ports.transaction.run(ctx, scope, async (tx) => {
    if ((await ports.groups.lock(tx, scope, id)) === undefined) throw new DeliveryFeeGroupNotFoundError();
    const group = await ports.groups.find(tx, scope, id);
    if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
    await work(tx, group);
    const written = await ports.groups.find(tx, scope, id);
    if (written === undefined) throw new DeliveryFeeGroupNotFoundError();
    return written;
  });
}
