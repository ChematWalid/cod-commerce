import type { Snowflake, TenantScope } from '@cod/shared';
import type { TeamMember } from '../team-member';
import type { OperationContext } from './operation-context';

/** The fields of a member a use case may change; identity, business and creation time never change. */
export type TeamMemberPatch = Partial<Omit<TeamMember, 'id' | 'businessId' | 'createdAt'>>;

/**
 * Where team members are kept. Every method is confined to `scope.businessId`: a member of another business is never
 * found, counted or changed.
 */
export interface MemberRepositoryPort {
  /** Stores a new member; rejects when a live member of the business has the same email key or administrator. */
  insert(ctx: OperationContext, scope: TenantScope, member: TeamMember): Promise<void>;

  /** The member `id`, removed ones included, or `undefined`. */
  findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<TeamMember | undefined>;

  /**
   * The member `id`, removed ones included, or `undefined`, with its row locked until the transaction in `ctx` ends:
   * a salary is read under this lock, so a parallel edit cannot change the amount being paid (D212).
   */
  findForUpdate(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<TeamMember | undefined>;

  /** Every live (not removed) member of the business, in no particular order. */
  listLive(ctx: OperationContext, scope: TenantScope): Promise<readonly TeamMember[]>;

  /** The live (not removed) member with that email key, or `undefined`. */
  findLiveByEmailKey(ctx: OperationContext, scope: TenantScope, emailKey: string): Promise<TeamMember | undefined>;

  /** The member holding that administrator account, or `undefined`. */
  findByAdministratorId(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<TeamMember | undefined>;

  /** Applies `patch` to the member `id`; `false` when the business has no such member. */
  update(ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: TeamMemberPatch): Promise<boolean>;
}
