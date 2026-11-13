import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';

/** The flags screen's route, below the dashboard base (`/dashboard`). */
export const FLAGS_PATH = '/platform/flags';

/** The sidebar section for platform staff. It sits at the bottom, with the stock administration entries. */
export const PLATFORM_SECTION_ID = 'platform';
export const PLATFORM_SECTION_TITLE = 'flags.nav-platform';
export const FLAGS_NAV_TITLE = 'flags.nav-flags';
export const FLAGS_NAV_ITEM_ID = 'platform-flags';
export const FLAGS_NAV_REQUIRED_PERMISSION = PLATFORM_STAFF_PERMISSION;

/** Query keys of the screen's one list. */
export const FLAGS_QUERY_KEY = ['platform', 'flags'] as const;

/** The rollout bounds the server enforces; `dashboard/` may not import `domain/` (D92). */
export const ROLLOUT_MIN_PERCENT = 0;
export const ROLLOUT_MAX_PERCENT = 100;

/** The scopes an override can have, as the Admin API names them. */
export const OVERRIDE_SCOPES = ['BUSINESS', 'STORE', 'PLAN'] as const;
export type OverrideScope = (typeof OVERRIDE_SCOPES)[number];
export const SCOPE_MESSAGE_IDS: Readonly<Record<OverrideScope, string>> = {
  BUSINESS: 'flags.scope-business',
  STORE: 'flags.scope-store',
  PLAN: 'flags.scope-plan',
};
export const DEFAULT_OVERRIDE_SCOPE: OverrideScope = 'BUSINESS';

/** Longest target id the server accepts. */
export const TARGET_ID_MAX_LENGTH = 64;

/** Catalogue ids used from more than one file. */
export const FLAGS_GENERIC_ERROR_MESSAGE_ID = 'flags.error-generic';
export const FLAGS_FORBIDDEN_MESSAGE_ID = 'flags.error-forbidden';
export const FLAGS_LOADING_MESSAGE_ID = 'flags.loading';
export const FLAGS_CANCEL_MESSAGE_ID = 'flags.cancel';
export const FLAGS_SAVED_MESSAGE_ID = 'flags.saved';
