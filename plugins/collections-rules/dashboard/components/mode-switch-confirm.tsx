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
import { MODE_SWITCH_CONFIRM_TEST_ID } from '../constants';

interface ModeSwitchConfirmProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/** Asks before a saved manual collection turns automatic: its hand-picked list and order are replaced (D2339). */
export function ModeSwitchConfirm({ open, onConfirm, onClose }: ModeSwitchConfirmProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent data-testid={MODE_SWITCH_CONFIRM_TEST_ID}>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('collections.mode-confirm-heading')}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._('collections.mode-confirm-body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('collections.cancel')}</AlertDialogCancel>
          <Button onClick={onConfirm}>{i18n._('collections.mode-confirm-save')}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
