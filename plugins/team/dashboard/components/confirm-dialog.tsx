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
import { CANCEL_MESSAGE_ID } from '../constants';

/** What a confirmation says: catalogue ids and the values they name. */
export interface ConfirmCopy {
  readonly titleId: string;
  readonly bodyId: string;
  readonly confirmId: string;
  readonly values: Readonly<Record<string, string>>;
  readonly destructive: boolean;
}

interface ConfirmDialogProps {
  readonly copy: ConfirmCopy | null;
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/** Asks before an action that cannot simply be undone; `copy: null` keeps it closed. */
export function ConfirmDialog({ copy, pending, onConfirm, onClose }: ConfirmDialogProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <AlertDialog
      open={copy !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy === null ? null : i18n._(copy.titleId, copy.values)}</AlertDialogTitle>
          <AlertDialogDescription>{copy === null ? null : i18n._(copy.bodyId, copy.values)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._(CANCEL_MESSAGE_ID)}</AlertDialogCancel>
          <Button
            variant={copy?.destructive === true ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {copy === null ? null : i18n._(copy.confirmId)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
