import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { ImportFormat } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Label } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { IMPORT_FILE_ACCEPT, IMPORT_FILE_INPUT_TEST_ID, IMPORT_UPLOAD_TEST_ID } from '../constants';
import { useFailureToast } from '../hooks/use-catalog-import';
import { uploadFormatOf } from '../model/wizard';
import { type CatalogImportDto, uploadAndAnalyze } from '../queries';

interface UploadStepProps {
  readonly scope: StoreScope | null;
  readonly onAnalyzed: (job: CatalogImportDto) => void;
}

/** The chosen file and the format its name says, `null` until a file is chosen. */
interface ChosenFile {
  readonly file: File;
  readonly format: ImportFormat | null;
}

/** The labelled file input, and why a chosen file cannot be imported. */
function FilePicker({
  chosen,
  onChosen,
}: {
  readonly chosen: ChosenFile | null;
  readonly onChosen: (chosen: ChosenFile | null) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{i18n._('catalog-import.upload-file')}</Label>
        <Input
          id={id}
          type="file"
          accept={IMPORT_FILE_ACCEPT}
          data-testid={IMPORT_FILE_INPUT_TEST_ID}
          onChange={(event) => {
            const file = event.target.files?.[0];
            onChosen(file === undefined ? null : { file, format: uploadFormatOf(file.name) });
          }}
        />
      </div>
      {chosen !== null && chosen.format === null && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._('catalog-import.file-type')}
        </p>
      )}
    </>
  );
}

/** Step 1: pick an Excel or CSV file; it is sent straight to the object store, then analyzed (D2208, D2210). */
export function UploadStep({ scope, onAnalyzed }: UploadStepProps): ReactNode {
  const { i18n } = useLingui();
  const onFailure = useFailureToast();
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const upload = useMutation({
    mutationFn: ({ file, format }: { readonly file: File; readonly format: ImportFormat }) =>
      uploadAndAnalyze(scope, file, format),
    onSuccess: onAnalyzed,
    onError: onFailure,
  });
  const format = chosen?.format ?? null;
  return (
    <div className="grid max-w-xl gap-4">
      <p className="text-muted-foreground text-sm">{i18n._('catalog-import.upload-hint')}</p>
      <FilePicker chosen={chosen} onChosen={setChosen} />
      <div>
        <Button
          data-testid={IMPORT_UPLOAD_TEST_ID}
          disabled={chosen === null || format === null || upload.isPending}
          onClick={() => {
            if (chosen !== null && format !== null) upload.mutate({ file: chosen.file, format });
          }}
        >
          {i18n._(upload.isPending ? 'catalog-import.uploading' : 'catalog-import.upload-analyze')}
        </Button>
      </div>
    </div>
  );
}
