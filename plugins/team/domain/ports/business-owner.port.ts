import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Who owns a business, as tenancy keeps it: the one member Team never deactivates, removes or re-scopes (D204). */
export interface BusinessOwnerPort {
  /** The owner's administrator id, or `null` while the business has none. */
  ownerAdministratorId(ctx: OperationContext, scope: TenantScope): Promise<number | null>;
}
