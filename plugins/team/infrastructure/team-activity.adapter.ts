import { ActivityRecordEvent } from '@cod/plugin-rbac/member-access';
import { ACTIVITY_ENTITY_TYPES, teamCommissionActivityDiffSchema, teamMemberActivityDiffSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActivityPort, TeamCommissionActivity, TeamMemberActivity } from '../domain/ports/team-activity.port';
import { toRequestContext } from './request-scope';

/**
 * {@link TeamActivityPort} on rbac's activity log, through its blocking event: the row joins the caller's
 * transaction (D66). Each diff is parsed by D216's strict schema first, so no salary, commission value, email or token
 * can be logged.
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
        { ...entry, entityType: ACTIVITY_ENTITY_TYPES.TEAM_MEMBER, entityId: checked.memberId, diff: checked },
        scope,
      ),
    );
  }

  async recordCommission(ctx: OperationContext, activity: TeamCommissionActivity): Promise<void> {
    const { scope, diff, ...entry } = activity;
    const checked = teamCommissionActivityDiffSchema.parse(diff);
    await this.events.publish(
      new ActivityRecordEvent(
        toRequestContext(ctx),
        {
          ...entry,
          entityType: ACTIVITY_ENTITY_TYPES.COMMISSION_CONFIG,
          entityId: checked.commissionConfigId,
          diff: checked,
        },
        scope,
      ),
    );
  }
}
