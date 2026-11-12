import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, toast } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { MEMBERS_QUERY_KEY } from '../constants';
import type { TeamMemberDto } from '../dto';
import { formatDzd, useUiLanguage } from '../labels';
import { displayNameOf } from '../member-view-model';
import { payMember } from '../queries';
import { ErrorAlert, FormFooter } from './form-footer';

interface PaySalaryDialogProps {
  readonly member: TeamMemberDto | null;
  readonly onClose: () => void;
}

function usePay(memberId: string, onClose: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => payMember(memberId, key),
    onSuccess: async () => {
      toast.success(i18n._('team.paid'));
      await queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      onClose();
    },
  });
}

/**
 * One key per opening of the dialog: a double click, or a retry after a lost answer, books one payment (D212). The
 * server pays the base salary it reads under a lock, so the amount shown is a preview.
 */
function PayForm({ member, onClose }: { readonly member: TeamMemberDto; readonly onClose: () => void }): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const [key] = useState(() => crypto.randomUUID());
  const pay = usePay(member.id, onClose);
  const amount = formatDzd(member.baseSalary ?? 0, language);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('team.pay-title', { name: displayNameOf(member) })}</DialogTitle>
        <DialogDescription>{i18n._('team.pay-body', { amount })}</DialogDescription>
      </DialogHeader>
      <p className="text-muted-foreground text-xs">{i18n._('team.pay-placeholder-note')}</p>
      <ErrorAlert error={pay.error} />
      <FormFooter
        submitId="team.pay-confirm"
        disabled={pay.isPending}
        onCancel={onClose}
        onSubmit={() => {
          pay.mutate(key);
        }}
      />
    </>
  );
}

/** "Pay salary": records one payment of the member's base salary; the ledger books it later (P6.S4). */
export function PaySalaryDialog({ member, onClose }: PaySalaryDialogProps): ReactNode {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-team-dialog sm:max-w-md">
        {member !== null && <PayForm key={member.id} member={member} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
