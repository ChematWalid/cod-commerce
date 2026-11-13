import type { BusinessId, TenantScope } from '@cod/shared';
import { adoptedMember } from '../domain/adopted-member';
import type { AdministratorProfile } from '../domain/administrator-profile';
import { MEMBER_CONVERGE_PAGE_SIZE } from '../domain/constants';
import { type MemberConvergeFailure, TeamConvergeFailedError } from '../domain/converge-failure';
import type { AccessHoldersPort } from '../domain/ports/access-holders.port';
import type { AdministratorProfilesPort } from '../domain/ports/administrator-profiles.port';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { emailKeyOf } from '../domain/team-member';

/** What the converge reads and writes through. */
export interface TeamConvergePorts {
  readonly directory: BusinessDirectoryPort;
  readonly holders: AccessHoldersPort;
  readonly profiles: AdministratorProfilesPort;
  readonly members: Pick<MemberRepositoryPort, 'insert' | 'findByAdministratorId' | 'findLiveByEmailKey'>;
  readonly transaction: TransactionPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}

/**
 * What adopting administrators did in one business. `skipped` counts an administrator whose address a live member
 * (an open invitation) already holds: the unique address rule wins, and the invitation decides.
 */
export interface AdoptionResult {
  readonly created: number;
  readonly skipped: number;
}

/** The outcome of one converge run over every business. */
export interface MemberConvergeReport extends AdoptionResult {
  readonly businesses: number;
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * Makes every live administrator holding an rbac role a member of its business (D215): the owner at provisioning,
 * and on each migrate any administrator given access outside Team (the demo seed, `setMemberAccess`). Idempotent.
 */
export class TeamConvergeService {
  constructor(private readonly ports: TeamConvergePorts) {}

  /** One transaction per business: a failure undoes that business only, and is thrown once all have been tried. */
  async convergeMembers(ctx: OperationContext): Promise<MemberConvergeReport> {
    const report = { businesses: 0, created: 0, skipped: 0 };
    const failures: MemberConvergeFailure[] = [];
    let afterId: BusinessId | undefined;
    for (;;) {
      const page = await this.ports.directory.page(ctx, afterId, MEMBER_CONVERGE_PAGE_SIZE);
      report.businesses += page.length;
      for (const businessId of page) {
        await this.convergeOne(ctx, businessId, report, failures);
      }
      afterId = page.at(-1);
      if (page.length < MEMBER_CONVERGE_PAGE_SIZE || afterId === undefined) break;
    }
    if (failures.length > 0) throw new TeamConvergeFailedError(report.businesses, report.created, failures);
    return report;
  }

  /** Adopts every live role holder of one business that has no member row yet. */
  convergeBusiness(ctx: OperationContext, businessId: BusinessId): Promise<AdoptionResult> {
    const scope = { businessId };
    return this.ports.transaction.run(ctx, scope, async (transactional) =>
      this.adoptIn(transactional, scope, await this.ports.holders.administratorIdsOf(transactional, scope)),
    );
  }

  /**
   * Makes these administrators active members of the business, unless they already have a row; an id that names no
   * live administrator of the business is left out. Joins the transaction `ctx` carries (tenancy's, at provisioning).
   */
  adoptAdministrators(
    ctx: OperationContext,
    scope: TenantScope,
    administratorIds: readonly number[],
  ): Promise<AdoptionResult> {
    return this.ports.transaction.run(ctx, scope, (transactional) =>
      this.adoptIn(transactional, scope, administratorIds),
    );
  }

  private async convergeOne(
    ctx: OperationContext,
    businessId: BusinessId,
    report: { created: number; skipped: number },
    failures: MemberConvergeFailure[],
  ): Promise<void> {
    try {
      const { created, skipped } = await this.convergeBusiness(ctx, businessId);
      report.created += created;
      report.skipped += skipped;
    } catch (error: unknown) {
      failures.push({ businessId, reason: reasonOf(error) });
    }
  }

  private async adoptIn(
    ctx: OperationContext,
    scope: TenantScope,
    administratorIds: readonly number[],
  ): Promise<AdoptionResult> {
    if (administratorIds.length === 0) return { created: 0, skipped: 0 };
    let created = 0;
    let skipped = 0;
    for (const profile of await this.ports.profiles.profilesOf(ctx, scope, administratorIds)) {
      const outcome = await this.adoptOne(ctx, scope, profile);
      if (outcome === 'created') created += 1;
      if (outcome === 'skipped') skipped += 1;
    }
    return { created, skipped };
  }

  private async adoptOne(
    ctx: OperationContext,
    scope: TenantScope,
    profile: AdministratorProfile,
  ): Promise<'created' | 'skipped' | 'present'> {
    const { members, ids, clock } = this.ports;
    if ((await members.findByAdministratorId(ctx, scope, profile.administratorId)) !== undefined) return 'present';
    if ((await members.findLiveByEmailKey(ctx, scope, emailKeyOf(profile.email))) !== undefined) return 'skipped';
    await members.insert(
      ctx,
      scope,
      adoptedMember({ id: ids.next(), businessId: scope.businessId, profile, now: clock.now() }),
    );
    return 'created';
  }
}
