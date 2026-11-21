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
import type { OfferRowDto } from '../dto';
import { ROW_ACTION_LABEL_IDS } from '../model/list-view';

/** The commands a merchant confirms first: an archived offer cannot be edited again, a deleted draft is gone. */
export type ConfirmedCommand = 'archive' | 'delete';

const TEXTS: Readonly<Record<ConfirmedCommand, { readonly titleId: string; readonly bodyId: string }>> = {
  archive: { titleId: 'offers.archive-title', bodyId: 'offers.archive-body' },
  delete: { titleId: 'offers.delete-title', bodyId: 'offers.delete-body' },
};

/** What is being confirmed: the command and its offer. */
export interface PendingConfirmation {
  readonly command: ConfirmedCommand;
  readonly offer: OfferRowDto;
}

interface ConfirmCommandDialogProps {
  /** `null` keeps it closed. */
  readonly pending: PendingConfirmation | null;
  readonly busy: boolean;
  readonly onConfirm: (pending: PendingConfirmation) => void;
  readonly onClose: () => void;
}

/** Asks before an offer is archived or deleted. */
export function ConfirmCommandDialog({ pending, busy, onConfirm, onClose }: ConfirmCommandDialogProps): ReactNode {
  const { i18n } = useLingui();
  const texts = TEXTS[pending?.command ?? 'delete'];
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._(texts.titleId)}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._(texts.bodyId, { name: pending?.offer.title ?? '' })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('offers.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (pending !== null) onConfirm(pending);
            }}
          >
            {i18n._(ROW_ACTION_LABEL_IDS[pending?.command ?? 'delete'])}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
