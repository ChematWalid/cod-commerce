import type { BusinessId, TenantScope } from '@cod/shared';
import type { AdministratorProfile } from '../../domain/administrator-profile';
import type { AccessHoldersPort } from '../../domain/ports/access-holders.port';
import type { AdministratorProfilesPort } from '../../domain/ports/administrator-profiles.port';
import type { BusinessDirectoryPort } from '../../domain/ports/business-directory.port';
import type { ClockPort } from '../../domain/ports/clock.port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import { newId } from '../support/builders';

/** An administrator of a business in the fake world. */
export interface FakeAdministrator extends AdministratorProfile {
  readonly businessId: BusinessId;
  /** Holds at least one rbac role assignment. */
  readonly holdsRole: boolean;
  readonly deleted?: boolean;
}

/** Businesses and their administrators, behind the three read ports the converge uses. */
export class FakeTeamWorld implements BusinessDirectoryPort, AccessHoldersPort, AdministratorProfilesPort {
  readonly pageCalls: (BusinessId | undefined)[] = [];

  constructor(
    readonly businessIds: readonly BusinessId[],
    readonly administrators: FakeAdministrator[],
  ) {}

  page(_ctx: OperationContext, afterId: BusinessId | undefined, limit: number): Promise<readonly BusinessId[]> {
    this.pageCalls.push(afterId);
    const sorted = [...this.businessIds].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    const after = sorted.filter((id) => afterId === undefined || BigInt(id) > BigInt(afterId));
    return Promise.resolve(after.slice(0, limit));
  }

  administratorIdsOf(_ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    return Promise.resolve(
      this.liveOf(scope)
        .filter((administrator) => administrator.holdsRole)
        .map((administrator) => administrator.administratorId),
    );
  }

  profilesOf(
    _ctx: OperationContext,
    scope: TenantScope,
    administratorIds: readonly number[],
  ): Promise<readonly AdministratorProfile[]> {
    const live = this.liveOf(scope);
    return Promise.resolve(
      administratorIds.flatMap((id) => {
        const found = live.find((administrator) => administrator.administratorId === id);
        if (found === undefined) return [];
        const { administratorId, email, firstName, lastName } = found;
        return [{ administratorId, email, firstName, lastName }];
      }),
    );
  }

  private liveOf(scope: TenantScope): readonly FakeAdministrator[] {
    return this.administrators.filter(
      (administrator) => administrator.businessId === scope.businessId && administrator.deleted !== true,
    );
  }
}

/** Runs the work at once, on the caller's context, and counts the scopes it ran for. */
export class InlineTransaction implements TransactionPort {
  readonly scopes: TenantScope[] = [];

  run<T>(ctx: OperationContext, scope: TenantScope, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    this.scopes.push(scope);
    return work(ctx);
  }
}

/** Always the same instant. */
export const fixedClock = (now: Date): ClockPort => ({ now: () => now });

/** Ids from the shared builder sequence, unique for the whole run. */
export const builderIds: IdGeneratorPort = { next: newId };
