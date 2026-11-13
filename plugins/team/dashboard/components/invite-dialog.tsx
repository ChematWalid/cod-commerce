import type { InviteMemberInput } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Input, toast } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { LOADING_MESSAGE_ID, MEMBERS_QUERY_KEY } from '../constants';
import { useGrantOptions } from '../hooks/use-grant-options';
import { emptyInviteDraft, type InviteDraft, inviteErrorsOf, inviteInputOf } from '../invite-form-validation';
import { emailLocaleOf, useUiLanguage } from '../labels';
import { inviteMember } from '../queries';
import { ErrorAlert, FormFooter } from './form-footer';
import { FieldFrame, GrantFields } from './grant-fields';

interface InviteDialogProps {
  readonly open: boolean;
  readonly held: ReadonlySet<string>;
  readonly onClose: () => void;
}

function useInvite(onClose: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(input),
    onSuccess: async () => {
      toast.success(i18n._('team.invited'));
      await queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      onClose();
    },
  });
}

function EmailField(props: {
  readonly value: string;
  readonly errorId?: string;
  readonly onChange: (v: string) => void;
}) {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <FieldFrame label={i18n._('team.invite-field-email')} htmlFor={id} errorId={props.errorId}>
      <Input
        id={id}
        type="email"
        dir="ltr"
        autoComplete="off"
        value={props.value}
        aria-invalid={props.errorId !== undefined}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </FieldFrame>
  );
}

/** The draft and the errors to show: none until the person has changed something, so a fresh form is not red. */
function useInviteDraft() {
  const [draft, setDraft] = useState<InviteDraft>(emptyInviteDraft);
  const [dirty, setDirty] = useState(false);
  const patch = (change: Partial<InviteDraft>): void => {
    setDraft({ ...draft, ...change });
    setDirty(true);
  };
  return { draft, errors: dirty ? inviteErrorsOf(draft) : {}, patch };
}

function InviteForm({ held, onClose }: Omit<InviteDialogProps, 'open'>): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const { draft, errors, patch } = useInviteDraft();
  const grant = useGrantOptions(true, held);
  const invite = useInvite(onClose);
  const input = inviteInputOf(draft, emailLocaleOf(language));
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('team.invite-title')}</DialogTitle>
      </DialogHeader>
      <div className="cod-team-dialog-body grid gap-4">
        {grant.loading && <p>{i18n._(LOADING_MESSAGE_ID)}</p>}
        <EmailField
          value={draft.email}
          errorId={errors.email}
          onChange={(email) => {
            patch({ email });
          }}
        />
        <GrantFields draft={draft} errors={errors} options={grant.options} onChange={patch} />
      </div>
      <ErrorAlert error={invite.error ?? grant.error} />
      <FormFooter
        submitId="team.invite-submit"
        disabled={input === null || invite.isPending}
        onCancel={onClose}
        onSubmit={() => {
          if (input !== null) invite.mutate(input);
        }}
      />
    </>
  );
}

/** "Invite Team Member": the address, the grant the invitee gets on accept, and the pay terms (brief step 6). */
export function InviteDialog({ open, held, onClose }: InviteDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-team-dialog sm:max-w-lg">
        {open && <InviteForm held={held} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
