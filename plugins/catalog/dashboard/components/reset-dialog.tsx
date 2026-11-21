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
import { RESET_CONFIRM_TEST_ID } from '../constants';

interface ResetDialogProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/** Asks before a save that adds, removes or reorders an option and so replaces every variant (D2124). */
export function ResetDialog({ open, onConfirm, onClose }: ResetDialogProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('catalog.reset-heading')}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._('catalog.reset-body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('catalog.cancel')}</AlertDialogCancel>
          <Button data-testid={RESET_CONFIRM_TEST_ID} onClick={onConfirm}>
            {i18n._('catalog.reset-confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
