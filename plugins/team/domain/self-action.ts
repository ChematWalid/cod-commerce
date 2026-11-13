import { SelfActionError } from './errors';
import type { TeamMember } from './team-member';

/**
 * Refuses an action an actor may not take on its own member row: pay, edit salary or commissions (D212).
 *
 * @throws {SelfActionError} when the member is the actor's own account.
 */
export function assertNotSelf(actorAdministratorId: number, member: Pick<TeamMember, 'administratorId'>): void {
  if (member.administratorId === actorAdministratorId) throw new SelfActionError();
}
