import type { ActivityAction, TeamCommissionActivityDiff, TeamMemberActivityDiff, TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** One `team.*` activity row about a member; its diff is D216's, never a salary, email or token. */
export interface TeamMemberActivity {
  readonly scope: TenantScope;
  readonly actorAdministratorId: number | null;
  readonly action: ActivityAction;
  readonly summary: string;
  readonly diff: TeamMemberActivityDiff;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** One `team.commission.*` activity row; its diff is D216's, never the commission's value. */
export interface TeamCommissionActivity extends Omit<TeamMemberActivity, 'diff'> {
  readonly diff: TeamCommissionActivityDiff;
}

/** The business activity log, written in the caller's transaction: the row commits or rolls back with the work. */
export interface TeamActivityPort {
  recordMember(ctx: OperationContext, activity: TeamMemberActivity): Promise<void>;
  recordCommission(ctx: OperationContext, activity: TeamCommissionActivity): Promise<void>;
}
