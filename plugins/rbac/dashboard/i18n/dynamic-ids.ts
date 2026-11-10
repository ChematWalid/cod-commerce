import { ACTIVITY_ACTIONS, RBAC_ERROR_CODES } from '@cod/shared';

/** The server's role error codes and the activity log's actions, both shown as messages of the same id (D89). */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...Object.values(RBAC_ERROR_CODES),
  ...Object.values(ACTIVITY_ACTIONS),
];
