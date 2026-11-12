import { ActivityRecordEvent } from '@cod/plugin-rbac/member-access';
import { teamMemberActivityDiffSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActivityPort, TeamMemberActivity } from '../domain/ports/team-activity.port';
import { toRequestContext } from './request-scope';

/**
 * {@link TeamActivityPort} on rbac's activity log, through its blocking event: the row joins the caller's
 * transaction (D66). Each diff is parsed by D216's strict schema first, so no salary, email or token can be logged.
 */
@Injectable()
export class TeamActivityAdapter implements TeamActivityPort {
  constructor(private readonly events: EventBus) {}

  async recordMember(ctx: OperationContext, activity: TeamMemberActivity): Promise<void> {
    const { scope, diff, ...entry } = activity;
    const checked = teamMemberActivityDiffSchema.parse(diff);
    await this.events.publish(
      new ActivityRecordEvent(
        toRequestContext(ctx),
        { ...entry, entityType: 'member', entityId: checked.memberId, diff: checked },
        scope,
      ),
    );
  }
}
