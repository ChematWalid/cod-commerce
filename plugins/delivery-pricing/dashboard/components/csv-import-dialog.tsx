import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { CSV_APPLY_TEST_ID, CSV_IMPORT_DIALOG_TEST_ID, CSV_IMPORT_FILE_TEST_ID } from '../constants';
import type { FeeGroupDto } from '../dto';
import { useCsvApply, useCsvPreview } from '../hooks/use-csv-transfer';
import { canApplyCsv } from '../model/csv-preview';
import { CsvPreview } from './csv-preview-table';

/** What a CSV file the browser accepts in the picker; the server reads the bytes, never the claimed type. */
const CSV_ACCEPT = '.csv,text/csv';

interface CsvImportDialogProps {
  readonly scope: StoreScope | null;
  readonly groupId: string;
  readonly onApplied: (group: FeeGroupDto) => void;
  readonly onClose: () => void;
}

/** Picks the file; choosing one previews it at once. */
function FilePicker({ disabled, onFile }: { readonly disabled: boolean; readonly onFile: (file: File) => void }) {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{i18n._('delivery-pricing.csv-file-label')}</Label>
      <Input
        id={id}
        type="file"
        accept={CSV_ACCEPT}
        data-testid={CSV_IMPORT_FILE_TEST_ID}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file);
        }}
      />
    </div>
  );
}

/** The chosen file, its preview and its apply; choosing a file previews it at once. */
function useCsvImportFlow({ scope, groupId, onApplied, onClose }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const preview = useCsvPreview({ scope, groupId });
  const apply = useCsvApply({
    scope,
    groupId,
    onApplied: (group) => {
      onApplied(group);
      onClose();
    },
  });
  const choose = (chosen: File): void => {
    setFile(chosen);
    preview.mutate(chosen);
  };
  const result = preview.data ?? null;
  const onApply =
    file !== null && canApplyCsv(result)
      ? () => {
          apply.mutate(file);
        }
      : null;
  return { choose, result, previewing: preview.isPending, busy: preview.isPending || apply.isPending, onApply };
}

/** Cancel and Apply; Apply needs a preview with changes and no refused row. */
function ImportFooter(props: {
  readonly busy: boolean;
  readonly onApply: (() => void) | null;
  readonly onClose: () => void;
}) {
  const { i18n } = useLingui();
  const { onApply } = props;
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={props.onClose}>
        {i18n._('delivery-pricing.cancel')}
      </Button>
      <Button
        type="button"
        data-testid={CSV_APPLY_TEST_ID}
        disabled={props.busy || onApply === null}
        onClick={() => {
          onApply?.();
        }}
      >
        {i18n._('delivery-pricing.csv-apply')}
      </Button>
    </DialogFooter>
  );
}

/**
 * "Import" (D3142): a chosen file is previewed first (a dry run that writes nothing), listing the rows it would change
 * and those it refuses; Apply writes it in one go, and only a preview with changes and no refused row can be applied.
 */
export function CsvImportDialog(props: CsvImportDialogProps): ReactNode {
  const { i18n } = useLingui();
  const flow = useCsvImportFlow(props);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <DialogContent data-testid={CSV_IMPORT_DIALOG_TEST_ID} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{i18n._('delivery-pricing.csv-import-heading')}</DialogTitle>
          <DialogDescription>{i18n._('delivery-pricing.csv-import-body')}</DialogDescription>
        </DialogHeader>
        <FilePicker disabled={flow.busy} onFile={flow.choose} />
        {flow.previewing && <p className="text-sm">{i18n._('delivery-pricing.loading')}</p>}
        {flow.result !== null && !flow.previewing && <CsvPreview result={flow.result} />}
        <ImportFooter busy={flow.busy} onApply={flow.onApply} onClose={props.onClose} />
      </DialogContent>
    </Dialog>
  );
}
