import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, Progress } from '@vendure/dashboard';
import { type ReactNode, useEffect } from 'react';
import { IMPORT_CONFIRM_TEST_ID, IMPORT_CREATED_TEST_ID, IMPORT_RESULT_TEST_ID } from '../constants';
import { useFailureToast, useProductsChanged } from '../hooks/use-catalog-import';
import { codeMessageId } from '../model/import-errors';
import { confirmAllowed, type ImportSummary, jobSettled } from '../model/wizard';
import { type CatalogImportDto, confirmImport, useImportJob } from '../queries';
import { ImportSummaryView } from './import-steps';
import { openDownload } from './open-download';

interface ConfirmStepProps {
  readonly scope: StoreScope | null;
  readonly importId: string;
  readonly summary: ImportSummary | null;
  readonly confirmed: boolean;
  readonly onBack: () => void;
  readonly onConfirmed: () => void;
}

/** The finished import: rows created, updated and failed, and the error report of the failed ones. */
function ImportResult({ job }: { readonly job: CatalogImportDto }): ReactNode {
  const { i18n } = useLingui();
  if (job.status === 'failed')
    return (
      <p role="alert" className="text-destructive text-sm">
        {i18n._(codeMessageId(job.errorCode ?? ''))}
      </p>
    );
  const result = job.result ?? { created: 0, updated: 0, failed: 0 };
  return (
    <div data-testid={IMPORT_RESULT_TEST_ID} className="grid gap-3">
      <p className="font-medium">{i18n._('catalog-import.result-done')}</p>
      <ul className="grid gap-1 text-sm">
        <li data-testid={IMPORT_CREATED_TEST_ID} data-count={result.created}>
          {i18n._('catalog-import.result-created', { count: result.created })}
        </li>
        <li>{i18n._('catalog-import.result-updated', { count: result.updated })}</li>
        <li>{i18n._('catalog-import.result-failed', { count: result.failed })}</li>
      </ul>
      {job.errorReportUrl !== null && (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              if (job.errorReportUrl !== null) openDownload(job.errorReportUrl);
            }}
          >
            {i18n._('catalog-import.error-report')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The running import's progress, then its result; the product caches refresh once it is done. */
function ImportProgress({ scope, importId }: Pick<ConfirmStepProps, 'scope' | 'importId'>): ReactNode {
  const { i18n } = useLingui();
  const job = useImportJob(scope, importId).data;
  const settled = jobSettled(job?.status);
  const productsChanged = useProductsChanged();
  useEffect(() => {
    if (settled) void productsChanged();
  }, [settled, productsChanged]);
  if (job !== undefined && settled) return <ImportResult job={job} />;
  return (
    <div className="grid max-w-md gap-2">
      <p className="text-sm">{i18n._('catalog-import.running')}</p>
      <Progress value={job?.progress ?? 0} />
    </div>
  );
}

/** Step 4: the counts once more, then the write itself; once confirmed there is no way back. */
export function ConfirmStep(props: ConfirmStepProps): ReactNode {
  const { i18n } = useLingui();
  const onFailure = useFailureToast();
  const confirm = useMutation({
    mutationFn: () => confirmImport(props.scope, props.importId),
    onSuccess: props.onConfirmed,
    onError: onFailure,
  });
  if (props.confirmed) return <ImportProgress scope={props.scope} importId={props.importId} />;
  const allowed = confirmAllowed(props.summary);
  return (
    <div className="grid gap-4">
      <ImportSummaryView summary={props.summary} />
      {!allowed && <p className="text-muted-foreground text-sm">{i18n._('catalog-import.nothing-to-import')}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={props.onBack}>
          {i18n._('catalog-import.back')}
        </Button>
        <Button
          data-testid={IMPORT_CONFIRM_TEST_ID}
          disabled={!allowed || confirm.isPending}
          onClick={() => {
            confirm.mutate();
          }}
        >
          {i18n._('catalog-import.confirm')}
        </Button>
      </div>
    </div>
  );
}
