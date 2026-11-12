/** The public page an invitation link opens (D205), below the dashboard base (`/dashboard`). */
export const ACCEPT_INVITATION_PATH = '/accept-invitation';
/** Where the invitee signs in once the account exists. */
export const SIGN_IN_PATH = '/login';
/** The "Roles & Permissions" tab: the shell's `team.roles` leaf (P1.S3). */
export const ROLES_TAB_PATH = '/team/roles';

/** The catalog keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const VIEW_MEMBERS_KEY = 'team.members.view';
export const INVITE_MEMBERS_KEY = 'team.members.invite';
export const EDIT_MEMBERS_KEY = 'team.members.edit';
export const REMOVE_MEMBERS_KEY = 'team.members.remove';
export const VIEW_COMMISSIONS_KEY = 'team.commissions.view';
export const SET_COMMISSIONS_KEY = 'team.commissions.set';
export const VIEW_ROLES_KEY = 'team.roles.view';

export const MEMBERS_QUERY_KEY = ['team', 'members'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['team', 'effective-permissions'] as const;
export const ROLE_OPTIONS_QUERY_KEY = ['team', 'role-options'] as const;
export const STORE_OPTIONS_QUERY_KEY = ['team', 'store-options'] as const;
export const COMMISSIONS_QUERY_KEY = ['team', 'commission-configs'] as const;
export const COMMISSION_BASES_QUERY_KEY = ['team', 'commission-bases'] as const;
export const INVITATION_PREVIEW_QUERY_KEY = ['team', 'invitation-preview'] as const;

/** The public REST routes of an invitation (D205: the accept surface is REST only). */
export const INVITATION_PREVIEW_ENDPOINT = '/team/invitations/preview';
export const INVITATION_ACCEPT_ENDPOINT = '/team/invitations/accept';

/** `data-testid`s the browser spec and the evidence script look for. */
export const TEAM_PAGE_TEST_ID = 'team-members-page';
export const ACCEPT_PAGE_TEST_ID = 'accept-invitation-page';

/** Catalogue ids of the messages used from more than one file. */
export const GENERIC_ERROR_MESSAGE_ID = 'team.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'team.error-forbidden';
export const RATE_LIMITED_MESSAGE_ID = 'team.error-rate-limited';
export const PRIVILEGE_MESSAGE_ID = 'team.error-privilege';
export const LOADING_MESSAGE_ID = 'team.loading';
export const CANCEL_MESSAGE_ID = 'team.cancel';
export const SAVE_MESSAGE_ID = 'team.save';

/** The languages the public accept page offers, by their own names. */
export const PUBLIC_PAGE_LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
] as const;
