import { groupIdOf } from '../domain/group-id';
import type { FeeGroupListQuery, FeeGroupPage, FeeGroupRecord } from '../domain/fee-group';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** Reads the active store's fee groups: the list page and one group with its wilaya and commune rows. */
export class FeeGroupReadService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /** A page of the store's fee groups, newest first, filtered by name when the query searches. */
  list(ctx: OperationContext, scope: StoreScope, query: FeeGroupListQuery): Promise<FeeGroupPage> {
    return this.ports.groups.list(ctx, scope, query);
  }

  /** The store's group `rawId`, or `undefined` for an unknown, foreign, other-store or malformed id. */
  async get(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<FeeGroupRecord | undefined> {
    const id = groupIdOf(rawId);
    return id === undefined ? undefined : this.ports.groups.find(ctx, scope, id);
  }
}
