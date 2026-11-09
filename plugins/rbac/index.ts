export { RBAC_PERMISSION_DEFINITIONS } from './api/permission-definitions';
export { requirePermission } from './api/require-permission.decorator';
export { enginePermissionsFor } from './domain/engine-grants';
export { RbacPlugin } from './rbac.plugin';
export { requestOrigin, type RequestOrigin } from './api/request-origin';
export type { ActivityEntryInput } from './domain/activity';
export { ActivityRecordEvent } from './infrastructure/activity-record.event';
