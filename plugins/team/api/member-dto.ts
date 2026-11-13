import type { TeamMemberDetails } from '../domain/member-details';
import type { MemberListPage } from '../domain/member-listing';
import type { SalaryPaymentView } from '../domain/salary-payment';
import type { TeamMemberView } from '../domain/team-member';

/** A member as both API surfaces send it: the administrator id as decimal text (D68). */
export interface TeamMemberDto extends Omit<TeamMemberView, 'administratorId'> {
  readonly administratorId: string | null;
}

/** The wire form of a member view. */
export function toTeamMemberDto(view: TeamMemberView): TeamMemberDto {
  return { ...view, administratorId: view.administratorId === null ? null : String(view.administratorId) };
}

/** A member's details as both API surfaces send them: the administrator id as decimal text (D68). */
export interface TeamMemberDetailsDto extends Omit<TeamMemberDetails, 'administratorId'> {
  readonly administratorId: string | null;
}

/** One page of the members list as both API surfaces send it. */
export interface TeamMemberPageDto extends Omit<MemberListPage<TeamMemberDetails>, 'items'> {
  readonly items: readonly TeamMemberDetailsDto[];
}

/** The wire form of a member's details. */
export function toTeamMemberDetailsDto(details: TeamMemberDetails): TeamMemberDetailsDto {
  return { ...details, administratorId: details.administratorId === null ? null : String(details.administratorId) };
}

/** The wire form of a page of the members list. */
export function toTeamMemberPageDto(page: MemberListPage<TeamMemberDetails>): TeamMemberPageDto {
  return { ...page, items: page.items.map(toTeamMemberDetailsDto) };
}

/** A salary payment as both API surfaces send it: the payer's administrator id as decimal text (D68). */
export interface SalaryPaymentDto extends Omit<SalaryPaymentView, 'paidByAdministratorId'> {
  readonly paidByAdministratorId: string;
}

/** The wire form of a salary payment. */
export function toSalaryPaymentDto(payment: SalaryPaymentView): SalaryPaymentDto {
  return { ...payment, paidByAdministratorId: String(payment.paidByAdministratorId) };
}
