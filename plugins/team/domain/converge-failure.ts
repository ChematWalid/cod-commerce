import type { BusinessId } from '@cod/shared';

/** The most failures the error message lists; the caller logs every one from `failures`. */
const REPORTED_FAILURES = 20;

/** One business the member converge could not finish, and why. */
export interface MemberConvergeFailure {
  readonly businessId: BusinessId;
  readonly reason: string;
}

/** Some businesses failed to converge their members; every other business was committed, and the next run retries. */
export class TeamConvergeFailedError extends Error {
  constructor(
    readonly businesses: number,
    readonly created: number,
    readonly failures: readonly MemberConvergeFailure[],
  ) {
    const listed = failures.slice(0, REPORTED_FAILURES).map(({ businessId, reason }) => `${businessId}: ${reason}`);
    const omitted = failures.length - listed.length;
    const more = omitted > 0 ? `; and ${String(omitted)} more` : '';
    super(
      `${String(failures.length)} of ${String(businesses)} businesses failed to converge their members: ${listed.join('; ')}${more}`,
    );
    this.name = 'TeamConvergeFailedError';
  }
}
