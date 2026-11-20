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
import type { StoreCollectionDto } from '../dto';

interface DeleteDialogProps {
  readonly collection: StoreCollectionDto | null;
  readonly pending: boolean;
  readonly onConfirm: (collection: StoreCollectionDto) => void;
  readonly onClose: () => void;
}

/** Asks before a collection is deleted (its products stay in the store); `collection: null` keeps it closed. */
export function DeleteDialog({ collection, pending, onConfirm, onClose }: DeleteDialogProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <AlertDialog
      open={collection !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('collections.delete-heading')}</AlertDialogTitle>
          <AlertDialogDescription>
            {i18n._('collections.delete-body', { name: collection?.title ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('collections.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (collection !== null) onConfirm(collection);
            }}
          >
            {i18n._('collections.action-delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
