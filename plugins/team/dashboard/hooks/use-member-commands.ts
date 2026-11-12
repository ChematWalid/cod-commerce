import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import type { ConfirmCopy } from '../components/confirm-dialog';
import { MEMBERS_QUERY_KEY } from '../constants';
import type { TeamMemberDto } from '../dto';
import { errorMessageId } from '../error-messages';
import { displayNameOf, type MemberAction } from '../member-view-model';
import {
  deactivateMember,
  reactivateMember,
  removeMember,
  resendInvitation,
  revokeInvitation,
  setMemberReceiving,
} from '../queries';

/** The menu actions that run a single mutation, with or without asking first. */
export type MemberCommand = Extract<
  MemberAction,
  'resend' | 'revoke' | 'stop-receiving' | 'resume-receiving' | 'deactivate' | 'reactivate' | 'remove'
>;

interface CommandSpec {
  readonly run: (id: string) => Promise<unknown>;
  readonly doneId: string;
  /** Asked first: the action takes away access or an invitation. */
  readonly confirm: boolean;
}

const COMMANDS: Readonly<Record<MemberCommand, CommandSpec>> = {
  resend: { run: resendInvitation, doneId: 'team.resent', confirm: false },
  revoke: { run: revokeInvitation, doneId: 'team.revoked', confirm: true },
  'stop-receiving': { run: (id) => setMemberReceiving(id, false), doneId: 'team.saved', confirm: false },
  'resume-receiving': { run: (id) => setMemberReceiving(id, true), doneId: 'team.saved', confirm: false },
  deactivate: { run: deactivateMember, doneId: 'team.deactivated', confirm: true },
  reactivate: { run: reactivateMember, doneId: 'team.reactivated', confirm: true },
  remove: { run: removeMember, doneId: 'team.removed', confirm: true },
};

export const isMemberCommand = (action: MemberAction): action is MemberCommand => action in COMMANDS;

export const needsConfirmation = (command: MemberCommand): boolean => COMMANDS[command].confirm;

/** The wording of a confirmation: `team.confirm-<command>-title`, `-body` and the action's own label. */
export function confirmCopyOf(command: MemberCommand, member: TeamMemberDto): ConfirmCopy {
  return {
    titleId: `team.confirm-${command}-title`,
    bodyId: `team.confirm-${command}-body`,
    confirmId: `team.action-${command}`,
    values: { name: displayNameOf(member) },
    destructive: command !== 'reactivate',
  };
}

/** Runs a member command, then refreshes the list; a refusal is shown as its translated message. */
export function useMemberCommand(onSettled: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ command, member }: { readonly command: MemberCommand; readonly member: TeamMemberDto }) =>
      COMMANDS[command].run(member.id),
    onSuccess: async (_answer, { command }) => {
      toast.success(i18n._(COMMANDS[command].doneId));
      await queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageId(error)));
    },
    onSettled,
  });
}
