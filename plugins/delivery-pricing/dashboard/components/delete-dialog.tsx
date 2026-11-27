import { useLingui } from '@lingui/react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { FeeGroupSummaryDto } from '../dto';

/** Unicode isolates, so a name in the other script keeps its own direction inside the sentence. */
const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

interface DeleteDialogProps {
  readonly group: FeeGroupSummaryDto | null;
  readonly pending: boolean;
  readonly onConfirm: (group: FeeGroupSummaryDto) => void;
  readonly onClose: () => void;
}

/** Asks before a pricing option is deleted; `group: null` keeps it closed. */
export function DeleteDialog({ group, pending, onConfirm, onClose }: DeleteDialogProps): ReactNode {
  const { i18n } = useLingui();
  const name = `${FIRST_STRONG_ISOLATE}${group?.name ?? ''}${POP_DIRECTIONAL_ISOLATE}`;
  return (
    <AlertDialog
      open={group !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('delivery-pricing.delete-heading')}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._('delivery-pricing.delete-body', { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('delivery-pricing.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (group !== null) onConfirm(group);
            }}
          >
            {i18n._('delivery-pricing.action-delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
