import { MAX_OPEN_ORDERS_LIMIT } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, toast } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { MEMBERS_QUERY_KEY } from '../constants';
import type { TeamMemberDto } from '../dto';
import { displayNameOf } from '../member-view-model';
import { orderLimitOf } from '../order-limit';
import { setMemberLimit } from '../queries';
import { ErrorAlert, FormFooter } from './form-footer';
import { FieldFrame } from './grant-fields';

interface SetLimitDialogProps {
  readonly member: TeamMemberDto | null;
  readonly onClose: () => void;
}

function useSetLimit(memberId: string, onClose: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (max: number | null) => setMemberLimit(memberId, max),
    onSuccess: async () => {
      toast.success(i18n._('team.saved'));
      await queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      onClose();
    },
  });
}

function LimitForm({ member, onClose }: { readonly member: TeamMemberDto; readonly onClose: () => void }): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const [text, setText] = useState(member.maxOpenOrders === null ? '' : String(member.maxOpenOrders));
  const save = useSetLimit(member.id, onClose);
  const reading = orderLimitOf(text);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('team.limit-title', { name: displayNameOf(member) })}</DialogTitle>
        <DialogDescription>{i18n._('team.limit-help', { max: String(MAX_OPEN_ORDERS_LIMIT) })}</DialogDescription>
      </DialogHeader>
      <FieldFrame
        label={i18n._('team.field-limit')}
        htmlFor={id}
        errorId={reading.valid ? undefined : 'team.limit-error'}
      >
        <Input
          id={id}
          inputMode="numeric"
          dir="ltr"
          value={text}
          aria-invalid={!reading.valid}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </FieldFrame>
      <ErrorAlert error={save.error} />
      <FormFooter
        submitId="team.save"
        disabled={!reading.valid || save.isPending}
        onCancel={onClose}
        onSubmit={() => {
          if (reading.valid) save.mutate(reading.maxOpenOrders);
        }}
      />
    </>
  );
}

/** "Set limit": the most open orders the member may hold at once; an empty field means no limit. */
export function SetLimitDialog({ member, onClose }: SetLimitDialogProps): ReactNode {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-team-dialog sm:max-w-md">
        {member !== null && <LimitForm key={member.id} member={member} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
