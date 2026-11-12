import type { UpdateMemberInput } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, toast } from '@vendure/dashboard';
import { type ReactNode, useMemo, useState } from 'react';
import { LOADING_MESSAGE_ID, MEMBERS_QUERY_KEY } from '../constants';
import type { TeamMemberDto } from '../dto';
import { useGrantOptions } from '../hooks/use-grant-options';
import { grantErrorsOf, type MemberGrantDraft, memberUpdateInputOf } from '../invite-form-validation';
import { displayNameOf } from '../member-view-model';
import { updateMember } from '../queries';
import { ErrorAlert, FormFooter } from './form-footer';
import { GrantFields } from './grant-fields';

interface EditMemberDialogProps {
  readonly member: TeamMemberDto | null;
  readonly held: ReadonlySet<string>;
  readonly onClose: () => void;
}

/** The member's current grant and pay terms as the form edits them. */
function draftOf(member: TeamMemberDto): MemberGrantDraft {
  return {
    roleIds: member.roles.map((role) => role.id),
    storeAccess: member.storeAccess,
    storeIds: member.storeIds,
    baseSalary: member.baseSalary === null ? '' : String(member.baseSalary),
    commissionConfigIds: member.commissionConfigIds,
  };
}

function useUpdate(memberId: string, onClose: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemberInput) => updateMember(memberId, input),
    onSuccess: async () => {
      toast.success(i18n._('team.saved'));
      await queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      onClose();
    },
  });
}

function EditForm({ member, held, onClose }: EditMemberDialogProps & { readonly member: TeamMemberDto }): ReactNode {
  const { i18n } = useLingui();
  const initial = useMemo(() => draftOf(member), [member]);
  const [draft, setDraft] = useState(initial);
  const grant = useGrantOptions(true, held);
  const update = useUpdate(member.id, onClose);
  const input = memberUpdateInputOf(initial, draft);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('team.edit-title', { name: displayNameOf(member) })}</DialogTitle>
      </DialogHeader>
      <div className="cod-team-dialog-body grid gap-4">
        {grant.loading && <p>{i18n._(LOADING_MESSAGE_ID)}</p>}
        <GrantFields
          draft={draft}
          errors={grantErrorsOf(draft)}
          options={grant.options}
          onChange={(change) => {
            setDraft({ ...draft, ...change });
          }}
        />
      </div>
      <ErrorAlert error={update.error ?? grant.error} />
      <FormFooter
        submitId="team.save"
        disabled={input === null || update.isPending}
        onCancel={onClose}
        onSubmit={() => {
          if (input !== null) update.mutate(input);
        }}
      />
    </>
  );
}

/** "Edit": roles and stores (rbac decides, D204), base salary and commission structures of an active member. */
export function EditMemberDialog({ member, held, onClose }: EditMemberDialogProps): ReactNode {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-team-dialog sm:max-w-lg">
        {member !== null && <EditForm key={member.id} member={member} held={held} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
