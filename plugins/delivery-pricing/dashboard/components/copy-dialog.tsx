import { FEE_GROUP_NAME_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { COPY_CONFIRM_TEST_ID, COPY_DIALOG_TEST_ID, COPY_NAME_TEST_ID } from '../constants';
import type { FeeGroupSummaryDto } from '../dto';
import { copyNameOf } from '../model/price-tools';

interface CopyDialogProps {
  readonly group: FeeGroupSummaryDto;
  readonly pending: boolean;
  readonly onConfirm: (name: string) => void;
  readonly onClose: () => void;
}

/** "Copy" a pricing option (D3140): asks the copy's name, starting from "Copy of <name>"; the server copies the rest. */
export function CopyDialog({ group, pending, onConfirm, onClose }: CopyDialogProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const [name, setName] = useState(() =>
    copyNameOf(group.name, (source) => i18n._('delivery-pricing.copy-name', { name: source })),
  );
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid={COPY_DIALOG_TEST_ID}>
        <DialogHeader>
          <DialogTitle>{i18n._('delivery-pricing.copy-heading')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          <Label htmlFor={id}>{i18n._('delivery-pricing.copy-name-label')}</Label>
          <Input
            id={id}
            data-testid={COPY_NAME_TEST_ID}
            maxLength={FEE_GROUP_NAME_MAX}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {i18n._('delivery-pricing.cancel')}
          </Button>
          <Button
            type="button"
            data-testid={COPY_CONFIRM_TEST_ID}
            disabled={pending || name.trim() === ''}
            onClick={() => {
              onConfirm(name);
            }}
          >
            {i18n._('delivery-pricing.action-copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
