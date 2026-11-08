import type { Snowflake } from '@cod/shared';

/** The statuses a business can have. */
export const BUSINESS_STATUSES = ['active', 'suspended'] as const;

/** One of the {@link BUSINESS_STATUSES}. */
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/** The tenant root: one merchant, one Vendure seller, any number of stores. */
export interface Business {
  readonly id: Snowflake;
  readonly name: string;
  readonly logoAssetId: number | null;
  readonly onboardingState: Readonly<Record<string, unknown>>;
  readonly ownerAdministratorId: number | null;
  readonly sellerId: number;
  readonly ownerRoleId: number | null;
  readonly planId: Snowflake | null;
  readonly status: BusinessStatus;
  readonly createdAt: Date;
}

/** What it takes to start a business. */
export interface NewBusiness {
  readonly id: Snowflake;
  readonly name: string;
  readonly sellerId: number;
  readonly now: Date;
}

/** A new active business with no owner yet. */
export function newBusiness({ id, name, sellerId, now }: NewBusiness): Business {
  return {
    id,
    name,
    logoAssetId: null,
    onboardingState: {},
    ownerAdministratorId: null,
    sellerId,
    ownerRoleId: null,
    planId: null,
    status: 'active',
    createdAt: now,
  };
}
