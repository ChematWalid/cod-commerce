import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { CSV_EXPORT_TEST_ID, CSV_IMPORT_OPEN_TEST_ID } from '../constants';
import type { FeeGroupDto } from '../dto';
import { useCsvExport } from '../hooks/use-csv-transfer';
import { CsvImportDialog } from './csv-import-dialog';

interface CsvCardProps {
  readonly scope: StoreScope | null;
  readonly groupId: string;
  /** Whether the caller may import (the edit key); exporting needs only the view key the page asks for. */
  readonly canImport: boolean;
  /** Whether the form holds edits not saved yet, which an import would not see. */
  readonly unsaved: boolean;
  readonly onApplied: (group: FeeGroupDto) => void;
}

/** The Export button, and Import for a caller who may import; Import waits for unsaved edits to be saved. */
function CsvButtons(props: CsvCardProps & { readonly onImport: () => void }): ReactNode {
  const { i18n } = useLingui();
  const exporting = useCsvExport({ scope: props.scope, groupId: props.groupId });
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        data-testid={CSV_EXPORT_TEST_ID}
        disabled={exporting.isPending}
        onClick={() => {
          exporting.mutate();
        }}
      >
        {i18n._('delivery-pricing.csv-export')}
      </Button>
      {props.canImport && (
        <Button
          variant="outline"
          data-testid={CSV_IMPORT_OPEN_TEST_ID}
          disabled={props.unsaved}
          onClick={props.onImport}
        >
          {i18n._('delivery-pricing.csv-import')}
        </Button>
      )}
    </div>
  );
}

/**
 * Export and Import of a saved pricing option as CSV (D3142). Like the bulk tools, an import works on the saved
 * prices, so it waits until the form has no unsaved edits.
 */
export function CsvCard(props: CsvCardProps): ReactNode {
  const { i18n } = useLingui();
  const [importing, setImporting] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{i18n._('delivery-pricing.csv-intro')}</p>
      <CsvButtons
        {...props}
        onImport={() => {
          setImporting(true);
        }}
      />
      {props.canImport && props.unsaved && (
        <p className="text-muted-foreground text-xs">{i18n._('delivery-pricing.csv-save-first')}</p>
      )}
      {importing && (
        <CsvImportDialog
          scope={props.scope}
          groupId={props.groupId}
          onApplied={props.onApplied}
          onClose={() => {
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}
