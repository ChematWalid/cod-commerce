import { SUBDOMAIN_INVALID_ERROR_CODE, SUBDOMAIN_TAKEN_ERROR_CODE } from '../constants';
import { SHELL_LEAVES, SHELL_TREE } from '../model/tree';

/** The sidebar titles, built as `shell.nav.<id>` from the tree, so no literal names them (D89). */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = SHELL_TREE.flatMap((group) => [
  group.titleId,
  ...group.leaves.map((entry) => entry.titleId),
]);

/**
 * Dotted literals that are not catalogue ids: the leaf ids any dashboard passes to `registerShellPage`, and the server
 * codes for an unusable subdomain, which map to `subdomain.*` messages. They apply to every plugin, like this catalogue.
 */
export const NON_MESSAGE_LITERALS: readonly string[] = [
  ...SHELL_LEAVES.map((entry) => entry.id),
  SUBDOMAIN_TAKEN_ERROR_CODE,
  SUBDOMAIN_INVALID_ERROR_CODE,
];
