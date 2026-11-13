import type { CommissionValueKind, MemberStatus, MemberTab, StoreAccessKind } from '@cod/shared';

/**
 * The Team Admin API as the dashboard reads it. Documents are untyped and typed here, as `plugins/rbac/dashboard`
 * does, because the generated `@/gql` types only exist after `build:dashboard`. Framework-free, so the view models
 * that read these types are unit-tested in node.
 */
export interface TeamMemberRoleDto {
  readonly id: string;
  readonly name: string;
}

/** A row of the members list (`teamMembers`). `baseSalary` is null for a caller without `team.members.edit` (D207). */
export interface TeamMemberDto {
  readonly id: string;
  readonly administratorId: string | null;
  readonly email: string;
  readonly name: string | null;
  readonly status: MemberStatus;
  readonly tab: MemberTab;
  readonly invitationExpired: boolean;
  readonly roles: readonly TeamMemberRoleDto[];
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly string[];
  readonly storeNames: readonly string[];
  readonly commissionConfigIds: readonly string[];
  readonly baseSalary: number | null;
  readonly ordersCount: number;
  readonly maxOpenOrders: number | null;
  readonly receivingOrders: boolean;
  readonly invitedAt: string | null;
  readonly joinedAt: string | null;
}

export type TeamMemberCountsDto = Readonly<Record<MemberTab, number>>;

export interface TeamMemberPageDto {
  readonly items: readonly TeamMemberDto[];
  readonly counts: TeamMemberCountsDto;
  readonly total: number;
}

/** A Business Role the invite and edit dialogs offer. */
export interface RoleOptionDto {
  readonly id: string;
  readonly name: string;
  readonly builtInKey: string | null;
}

/** A store the caller can grant: one it holds a role on (D211). */
export interface StoreOptionDto {
  readonly id: string;
  readonly name: string;
}

export interface CommissionConfigDto {
  readonly id: string;
  readonly name: string;
  readonly basis: string;
  readonly valueKind: CommissionValueKind;
  /** Whole DZD for `fixed`, basis points for `percent`. */
  readonly value: number;
}

export interface CommissionBasisDto {
  readonly basis: string;
  readonly labels: { readonly ar: string; readonly en: string };
}

/** What the public preview shows the invitee (D213: nothing for a link that opens nothing). */
export interface InvitationPreviewDto {
  readonly email: string;
  readonly businessName: string;
  readonly inviterName: string | null;
  readonly expiresAt: string;
}
