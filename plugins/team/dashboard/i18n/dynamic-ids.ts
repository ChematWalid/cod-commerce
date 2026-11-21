import { TEAM_ERROR_CODES } from '@cod/shared';

/** The commands a confirmation dialog asks about; their wording ids are built at run time. */
const CONFIRMED_COMMANDS = ['revoke', 'deactivate', 'reactivate', 'remove'] as const;

/**
 * Ids the scan cannot see (D89): the server's Team codes, shown as messages of the same id, and the confirmation
 * wording `confirmCopyOf` builds (title, body and the confirming action's label).
 */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...Object.values(TEAM_ERROR_CODES),
  ...CONFIRMED_COMMANDS.flatMap((command) => [
    `team.confirm-${command}-title`,
    `team.confirm-${command}-body`,
    `team.action-${command}`,
  ]),
];
