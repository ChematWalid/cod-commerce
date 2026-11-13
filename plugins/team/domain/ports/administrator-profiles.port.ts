import type { TenantScope } from '@cod/shared';
import type { AdministratorProfile } from '../administrator-profile';
import type { OperationContext } from './operation-context';

/** Names and addresses of administrator accounts, kept by tenancy (D202). */
export interface AdministratorProfilesPort {
  /** The live administrators of the business among `administratorIds`; any other id is left out. */
  profilesOf(
    ctx: OperationContext,
    scope: TenantScope,
    administratorIds: readonly number[],
  ): Promise<readonly AdministratorProfile[]>;
}
