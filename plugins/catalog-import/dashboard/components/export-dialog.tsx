import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { CatalogProductListPageEntity, ExportScope, ImportFormat } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Progress } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { EXPORT_DIALOG_TEST_ID, EXPORT_DOWNLOAD_TEST_ID, EXPORT_SUBMIT_TEST_ID } from '../constants';
import { useFailureToast } from '../hooks/use-catalog-import';
import { type ExportForm, defaultExportForm, exportRequestOf } from '../model/export-form';
import { codeMessageId } from '../model/import-errors';
import { jobSettled } from '../model/wizard';
import { type CatalogExportDto, exportProducts, useExportJob } from '../queries';
import { ChoiceSelect } from './choice-select';
import { openDownload } from './open-download';

interface ExportDialogProps {
  readonly scope: StoreScope | null;
  readonly entity: CatalogProductListPageEntity;
  readonly onClose: () => void;
}

/** Which products and which format, as the Orders export dialog asks them. */
function ExportChoices(props: {
  readonly form: ExportForm;
  readonly selected: number;
  readonly disabled: boolean;
  readonly onChange: (form: ExportForm) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const scopes: readonly { value: ExportScope; label: string }[] = [
    { value: 'selected', label: i18n._('catalog-import.export-scope-selected', { count: props.selected }) },
    { value: 'filtered', label: i18n._('catalog-import.export-scope-filtered') },
  ];
  const formats: readonly { value: ImportFormat; label: string }[] = [
    { value: 'xlsx', label: i18n._('catalog-import.format-xlsx') },
    { value: 'csv', label: i18n._('catalog-import.format-csv') },
  ];
  return (
    <div className="grid gap-4">
      <ChoiceSelect
        label={i18n._('catalog-import.export-scope')}
        value={props.form.scope}
        choices={scopes}
        disabled={props.disabled}
        onChange={(scope) => {
          props.onChange({ ...props.form, scope });
        }}
      />
      <ChoiceSelect
        label={i18n._('catalog-import.export-format')}
        value={props.form.format}
        choices={formats}
        disabled={props.disabled}
        onChange={(format) => {
          props.onChange({ ...props.form, format });
        }}
      />
    </div>
  );
}

/** The export's progress, then its file, or why it failed. */
function ExportStatus({ job }: { readonly job: CatalogExportDto }): ReactNode {
  const { i18n } = useLingui();
  if (job.status === 'failed')
    return (
      <p role="alert" className="text-destructive text-sm">
        {i18n._(codeMessageId(job.errorCode ?? ''))}
      </p>
    );
  if (!jobSettled(job.status) || job.downloadUrl === null) return <Progress value={job.progress} />;
  const url = job.downloadUrl;
  return (
    <div className="grid gap-2 text-sm">
      <p>{i18n._('catalog-import.export-ready', { count: job.rowCount })}</p>
      {job.skippedPacks > 0 && (
        <p className="text-muted-foreground">
          {i18n._('catalog-import.export-skipped-packs', { count: job.skippedPacks })}
        </p>
      )}
      <div>
        <Button
          data-testid={EXPORT_DOWNLOAD_TEST_ID}
          data-row-count={job.rowCount}
          onClick={() => {
            openDownload(url);
          }}
        >
          {i18n._('catalog-import.download')}
        </Button>
      </div>
    </div>
  );
}

/** The dialog's choices, the request they make, and the export once started (read again until it is done). */
function useExport({ scope, entity }: Pick<ExportDialogProps, 'scope' | 'entity'>) {
  const onFailure = useFailureToast();
  const [form, setForm] = useState<ExportForm>(() => defaultExportForm(entity));
  const [exportId, setExportId] = useState<string | null>(null);
  const polled = useExportJob(scope, exportId).data;
  const request = exportRequestOf(form, entity);
  const start = useMutation({
    mutationFn: async () => {
      if (!request.ok) throw new Error(request.messageId);
      return exportProducts(scope, request.input);
    },
    onSuccess: (job) => {
      setExportId(job.exportId);
    },
    onError: onFailure,
  });
  return { form, setForm, request, start, job: polled ?? start.data };
}

/**
 * Export of the ticked products or of every product the list's filter finds, as Excel or CSV (D2211). Up to the sync
 * limit the file is ready at once; above, the job is read until it is done.
 */
export function ExportDialog({ scope, entity, onClose }: ExportDialogProps): ReactNode {
  const { i18n } = useLingui();
  const { form, setForm, request, start, job } = useExport({ scope, entity });
  const onStart = (): void => {
    start.mutate();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent data-testid={EXPORT_DIALOG_TEST_ID}>
        <DialogHeader>
          <DialogTitle>{i18n._('catalog-import.export-title')}</DialogTitle>
        </DialogHeader>
        <ExportChoices
          form={form}
          selected={entity.selectedIds.length}
          disabled={job !== undefined}
          onChange={setForm}
        />
        {!request.ok && <p className="text-muted-foreground text-sm">{i18n._(request.messageId)}</p>}
        {job !== undefined && <ExportStatus job={job} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {i18n._('catalog-import.close')}
          </Button>
          {job === undefined && (
            <Button data-testid={EXPORT_SUBMIT_TEST_ID} disabled={!request.ok || start.isPending} onClick={onStart}>
              {i18n._('catalog-import.export-start')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
