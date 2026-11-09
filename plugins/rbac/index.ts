export { RBAC_PERMISSION_DEFINITIONS } from './api/permission-definitions';
export { requirePermission } from './api/require-permission.decorator';
export { enginePermissionsFor } from './domain/engine-grants';
export { RbacPlugin } from './rbac.plugin';
export { requestOrigin, type RequestOrigin } from './api/request-origin';
export type { ActivityEntryInput } from './domain/activity';
export { ActivityRecordEvent } from './infrastructure/activity-record.event';
export { RbacConvergeService, type ConvergeReport } from './application/rbac-converge.service';
export { SESSION_FLUSH_SETTLE_MS } from './domain/constants';
export { RbacConvergeFailedError } from './domain/errors';
export {
  MemberAccessService,
  type MemberAccessActor,
  type MemberAccessView,
  type SetMemberAccessCommand,
} from './application/member-access.service';
export { asOperationContext } from './domain/ports/operation-context';
