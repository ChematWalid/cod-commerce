/** The routes of the roles pages, below the dashboard base (`/dashboard`). */
export const ROLES_PATH = '/team/roles';
export const ACTIVITY_LOG_PATH = '/team/activity-log';

/** The nav section both pages sit in; P1.S5 takes over the navigation. */
export const TEAM_NAV_SECTION_ID = 'team';
export const TEAM_NAV_SECTION_ORDER = 350;
export const TEAM_NAV_SECTION_TITLE = 'rbac.nav-team';
export const ROLES_NAV_TITLE = 'rbac.nav-roles';
export const ACTIVITY_LOG_NAV_TITLE = 'rbac.nav-activity-log';

/** Vendure names of the two page permissions (D52); `dashboard/` may not import `api/`, where they are defined. */
export const ROLES_VIEW_VENDURE_PERMISSION = 'CodTeamRolesView';
export const ACTIVITY_LOG_VIEW_VENDURE_PERMISSION = 'CodSettingsActivityLogView';

/** The catalog keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const CREATE_ROLE_KEY = 'team.roles.create';
export const EDIT_ROLE_KEY = 'team.roles.edit';
export const DELETE_ROLE_KEY = 'team.roles.delete';
export const VIEW_STORES_KEY = 'store.stores.view';

export const ROLES_QUERY_KEY = ['rbac', 'roles'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['rbac', 'effective-permissions'] as const;
export const ACTIVITY_LOG_QUERY_KEY = ['rbac', 'activity-log'] as const;
export const STORES_QUERY_KEY = ['rbac', 'stores'] as const;

/** The value of the "Start from" option that names no role; a `Select` item needs a value. */
export const NO_START_ROLE = 'none';

export const ARCHIVED_STORE_STATUS = 'archived';

/** Catalogue ids of the messages used from more than one file. */
export const GENERIC_ERROR_MESSAGE_ID = 'rbac.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'rbac.error-forbidden';
export const LOADING_MESSAGE_ID = 'rbac.loading';
export const CANCEL_MESSAGE_ID = 'rbac.cancel';
