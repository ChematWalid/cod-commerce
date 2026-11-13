import { newestFirst } from '../domain/member-listing';
import { isOrderManager, type OrderManagerView, toOrderManagerView } from '../domain/order-manager';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import { MemberDetailsReader } from './member-details-reader';
import type { MemberReadPorts } from './member-read-ports';

/** The members orders can be handed to (D209). */
export class ListOrderManagersService {
  constructor(private readonly ports: MemberReadPorts) {}

  /** The active members receiving orders that the actor reaches (D211), newest first. */
  async list(ctx: OperationContext, actor: TeamActor): Promise<OrderManagerView[]> {
    const live = newestFirst(await this.ports.members.listLive(ctx, actor.scope));
    const candidates = live.filter(isOrderManager);
    const details = await new MemberDetailsReader(this.ports).inReach(ctx, actor, candidates, {});
    return details.map(toOrderManagerView);
  }
}
