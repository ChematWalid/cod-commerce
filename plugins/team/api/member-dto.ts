import type { TeamMemberView } from '../domain/team-member';

/** A member as both API surfaces send it: the administrator id as decimal text (D68). */
export interface TeamMemberDto extends Omit<TeamMemberView, 'administratorId'> {
  readonly administratorId: string | null;
}

/** The wire form of a member view. */
export function toTeamMemberDto(view: TeamMemberView): TeamMemberDto {
  return { ...view, administratorId: view.administratorId === null ? null : String(view.administratorId) };
}
