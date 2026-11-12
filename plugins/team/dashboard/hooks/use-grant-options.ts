import { SET_COMMISSIONS_KEY, VIEW_COMMISSIONS_KEY } from '../constants';
import type { GrantOptions } from '../components/grant-fields';
import { useCommissionBases, useCommissionConfigs, useRoleOptions, useStoreOptions } from '../queries';

/** The choices of the invite and edit dialogs, asked for only while one is open; `error` is the first refusal. */
export interface GrantOptionsState {
  readonly options: GrantOptions;
  readonly loading: boolean;
  readonly error: unknown;
}

/**
 * Roles of the business, the stores the caller may grant, and, for a holder of `team.commissions.view`, the
 * commission configs. A caller without that key sees no commission and can give none.
 */
export function useGrantOptions(open: boolean, held: ReadonlySet<string>): GrantOptionsState {
  const seesCommissions = open && held.has(VIEW_COMMISSIONS_KEY);
  const roles = useRoleOptions(open);
  const stores = useStoreOptions(open);
  const commissions = useCommissionConfigs(seesCommissions);
  const bases = useCommissionBases(seesCommissions);
  const queries = [roles, stores, ...(seesCommissions ? [commissions, bases] : [])];
  return {
    options: {
      roles: roles.data ?? [],
      stores: stores.data ?? [],
      commissions: commissions.data ?? [],
      bases: bases.data ?? [],
      canCreateCommission: seesCommissions && held.has(SET_COMMISSIONS_KEY),
    },
    loading: queries.some((query) => query.isPending),
    error: queries.find((query) => query.isError)?.error ?? null,
  };
}
