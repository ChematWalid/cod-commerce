/**
 * Entry point for other plugins that manage members on top of rbac (D206): Team's adapters and its Nest module file
 * import it (architecture rule `rbac-member-access-entry-infra-only`); their `application/`, `domain/` and `api/`
 * reach it through their own ports. rbac stays the one source of truth for roles and store access (D204).
 */
export { RbacPlugin } from './rbac.plugin';
export {
  MemberAccessService,
  type MemberAccessActor,
  type MemberAccessView,
  type SetMemberAccessCommand,
  type WithdrawMemberAccessCommand,
} from './application/member-access.service';
export { GrantPreviewService, type ActorReach, type PreviewGrantCommand } from './application/grant-preview.service';
export type { MemberSuspensionRegistry } from './application/member-suspension-registry';
export { MEMBER_SUSPENSION_CHECK } from './application/tokens';
export type { MemberSuspensionCheck } from './domain/ports/member-suspension.port';
export type { ActivityEntryInput } from './domain/activity';
export { ActivityRecordEvent } from './infrastructure/activity-record.event';
export { asOperationContext, type OperationContext } from './domain/ports/operation-context';
