/** The activity log's route, below the dashboard base (`/dashboard`). Roles is the shell's `team.roles` leaf (D83). */
export const ACTIVITY_LOG_PATH = '/team/activity-log';

export const ROLES_NAV_TITLE = 'rbac.nav-roles';
export const ACTIVITY_LOG_NAV_TITLE = 'rbac.nav-activity-log';

/** The catalog keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const CREATE_ROLE_KEY = 'team.roles.create';
export const EDIT_ROLE_KEY = 'team.roles.edit';
export const DELETE_ROLE_KEY = 'team.roles.delete';
export const VIEW_ACTIVITY_LOG_KEY = 'settings.activity-log.view';

export const ROLES_QUERY_KEY = ['rbac', 'roles'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['rbac', 'effective-permissions'] as const;
export const ACTIVITY_LOG_QUERY_KEY = ['rbac', 'activity-log'] as const;

/** The value of the "Start from" option that names no role; a `Select` item needs a value. */
export const NO_START_ROLE = 'none';

/** Catalogue ids of the messages used from more than one file. */
export const GENERIC_ERROR_MESSAGE_ID = 'rbac.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'rbac.error-forbidden';
export const LOADING_MESSAGE_ID = 'rbac.loading';
export const CANCEL_MESSAGE_ID = 'rbac.cancel';
