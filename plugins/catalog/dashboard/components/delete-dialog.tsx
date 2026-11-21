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
import type { CatalogProductRowDto } from '../dto';

interface DeleteDialogProps {
  readonly product: CatalogProductRowDto | null;
  readonly pending: boolean;
  readonly onConfirm: (product: CatalogProductRowDto) => void;
  readonly onClose: () => void;
}

/** Asks before a product is deleted; `product: null` keeps it closed. */
export function DeleteDialog({ product, pending, onConfirm, onClose }: DeleteDialogProps): ReactNode {
  const { i18n } = useLingui();
  const values = { name: product?.title ?? '' };
  return (
    <AlertDialog
      open={product !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('catalog.delete-title')}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._('catalog.delete-body', values)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._('catalog.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (product !== null) onConfirm(product);
            }}
          >
            {i18n._('catalog.action-delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
