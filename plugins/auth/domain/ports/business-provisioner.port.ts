import type { RegisterMerchantCommand } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** What registration asks of tenancy's provisioning: a business, its first store and its owner. */
export interface ProvisionRequest {
  readonly name: string;
  readonly owner: {
    readonly emailAddress: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly password: string;
  };
  readonly store: {
    readonly name: string;
    readonly subdomain: string;
    readonly language: RegisterMerchantCommand['storeLanguage'];
  };
}

/** What registration reads back: the ids it returns and the administrator it finishes. */
export interface ProvisionOutcome {
  readonly business: { readonly id: string };
  readonly store: { readonly id: string };
  readonly administratorId: number;
}

/** Starts a business for the new owner; tenancy's one provisioning path (D5) sits behind it. */
export interface BusinessProvisionerPort {
  provision(ctx: OperationContext, command: ProvisionRequest): Promise<ProvisionOutcome>;
}
