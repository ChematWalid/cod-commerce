import { INVITATION_TTL_MS, type Snowflake, type TenantScope, toBusinessId, toSnowflake } from '@cod/shared';
import type { CommissionConfig } from '../../domain/commission-config';
import type { IssuedInvitation } from '../../domain/invitation';
import type { SalaryPayment } from '../../domain/salary-payment';
import type { TeamMember } from '../../domain/team-member';

/** Business A and B of the tests. */
export const scopeA: TenantScope = { businessId: toBusinessId('101') };
export const scopeB: TenantScope = { businessId: toBusinessId('202') };

/** A fixed instant the builders date their rows from. */
export const T0 = new Date(Date.UTC(2026, 10, 12, 9, 0, 0));

let nextId = 1_100_000_000_000_000_001n;

/** A fresh id, unique for the whole run, so adapters that keep rows never collide. */
export function newId(): Snowflake {
  const id = toSnowflake(String(nextId));
  nextId += 1n;
  return id;
}

/** An invited member of `scope` (no account yet), with any field overridden. */
export function invitedMember(scope: TenantScope, overrides: Partial<TeamMember> = {}): TeamMember {
  const email = overrides.email ?? `member-${newId()}@example.test`;
  return {
    id: newId(),
    businessId: scope.businessId,
    administratorId: null,
    email,
    emailKey: email.trim().toLowerCase(),
    firstName: null,
    lastName: null,
    status: 'invited',
    suspendedAccess: null,
    commissionConfigIds: [],
    baseSalary: 30_000,
    maxOpenOrders: null,
    receivingOrders: true,
    invitedByAdministratorId: 1,
    invitedAt: T0,
    joinedAt: null,
    removedAt: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** An open invitation of `member`, sent at {@link T0}, with any field overridden. */
export function openInvitation(member: TeamMember, overrides: Partial<IssuedInvitation> = {}): IssuedInvitation {
  return {
    id: newId(),
    businessId: member.businessId,
    memberId: member.id,
    grant: { roleIds: [toSnowflake('900')], storeAccess: 'all', storeIds: [] },
    locale: 'ar',
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(T0.getTime() + INVITATION_TTL_MS),
    lastSentAt: T0,
    resendCount: 0,
    invitedByAdministratorId: 1,
    revokedAt: null,
    acceptedAt: null,
    createdAt: T0,
    ...overrides,
  };
}

/** A percent commission config of `scope`, with any field overridden. */
export function commissionConfig(scope: TenantScope, overrides: Partial<CommissionConfig> = {}): CommissionConfig {
  const name = overrides.name ?? `Bonus ${newId()}`;
  return {
    id: newId(),
    businessId: scope.businessId,
    name,
    nameKey: name.toLowerCase(),
    basis: 'per-confirmed-order',
    valueKind: 'percent',
    value: 250,
    scope: 'selected',
    storeIds: [toSnowflake('11'), toSnowflake('12')],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** A salary payment of `memberId` in `scope`, with any field overridden. */
export function salaryPayment(
  scope: TenantScope,
  memberId: Snowflake,
  overrides: Partial<SalaryPayment> = {},
): SalaryPayment {
  return {
    id: newId(),
    businessId: scope.businessId,
    memberId,
    amount: 30_000,
    idempotencyKey: `key-${newId()}`,
    paidByAdministratorId: 1,
    paidAt: T0,
    ...overrides,
  };
}
