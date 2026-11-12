import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The names an invitation shows: the business and the administrator who invited. */
export interface BusinessNamesPort {
  /** The business's name. */
  businessName(ctx: OperationContext, scope: TenantScope): Promise<string>;

  /** The administrator's full name, its address when it has none, or `null` when it is no live administrator here. */
  administratorName(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<string | null>;
}
