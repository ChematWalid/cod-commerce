import type { ReactNode } from 'react';
import type { RoleOptionDto, TeamMemberDto } from '../dto';
import { confirmCopyOf, type MemberCommand, useMemberCommand } from '../hooks/use-member-commands';
import { ConfirmDialog } from './confirm-dialog';
import { EditMemberDialog } from './edit-member-dialog';
import { InviteDialog } from './invite-dialog';
import { MemberDetailsDialog } from './member-details-dialog';
import { PaySalaryDialog } from './pay-salary-dialog';
import { SetLimitDialog } from './set-limit-dialog';

/** The one dialog open on the team page, and the member it is about. */
export type TeamDialogState =
  | { readonly kind: 'none' }
  | { readonly kind: 'invite' }
  | { readonly kind: 'details' | 'edit' | 'limit' | 'pay'; readonly member: TeamMemberDto }
  | { readonly kind: 'confirm'; readonly command: MemberCommand; readonly member: TeamMemberDto };

interface TeamDialogsProps {
  readonly state: TeamDialogState;
  readonly held: ReadonlySet<string>;
  readonly roleOptions: readonly RoleOptionDto[];
  readonly onClose: () => void;
}

const memberFor = (state: TeamDialogState, kind: TeamDialogState['kind']): TeamMemberDto | null =>
  state.kind === kind && 'member' in state ? state.member : null;

function ConfirmCommand({ state, onClose }: Pick<TeamDialogsProps, 'state' | 'onClose'>): ReactNode {
  const command = useMemberCommand(onClose);
  const confirming = state.kind === 'confirm' ? state : null;
  return (
    <ConfirmDialog
      copy={confirming === null ? null : confirmCopyOf(confirming.command, confirming.member)}
      pending={command.isPending}
      onClose={onClose}
      onConfirm={() => {
        if (confirming !== null) command.mutate({ command: confirming.command, member: confirming.member });
      }}
    />
  );
}

/** Every dialog of the team page; at most one is open, as `state` says. */
export function TeamDialogs({ state, held, roleOptions, onClose }: TeamDialogsProps): ReactNode {
  return (
    <>
      <InviteDialog open={state.kind === 'invite'} held={held} onClose={onClose} />
      <MemberDetailsDialog member={memberFor(state, 'details')} roleOptions={roleOptions} onClose={onClose} />
      <EditMemberDialog member={memberFor(state, 'edit')} held={held} onClose={onClose} />
      <SetLimitDialog member={memberFor(state, 'limit')} onClose={onClose} />
      <PaySalaryDialog member={memberFor(state, 'pay')} onClose={onClose} />
      <ConfirmCommand state={state} onClose={onClose} />
    </>
  );
}
