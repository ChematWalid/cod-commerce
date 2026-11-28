import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { CSV_DOWNLOAD_TYPE } from '../constants';
import type { CsvFileDto, FeeGroupDto } from '../dto';
import { exportFeeGroupCsv, importFeeGroupCsv } from '../queries';
import { failureMessageIdOf, useRefreshAll } from './use-pricing-writes';

const NOT_FOUND_MESSAGE_ID = 'delivery-pricing.not-found';

interface CsvOptions {
  readonly scope: StoreScope | null;
  readonly groupId: string;
}

/** Saves the export as the server named it; the text keeps its byte order mark, so Excel reads it as UTF-8. */
function download(file: CsvFileDto): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: CSV_DOWNLOAD_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.click();
  // Revoking in the same tick can cancel the download in Safari.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** "Export" (D3142): downloads the pricing option as CSV. */
export function useCsvExport({ scope, groupId }: CsvOptions) {
  const { i18n } = useLingui();
  return useMutation({
    mutationFn: () => exportFeeGroupCsv(scope, groupId),
    onSuccess: (file) => {
      if (file === null) toast.error(i18n._(NOT_FOUND_MESSAGE_ID));
      else download(file);
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
  });
}

/** The import's preview (a dry run, D3142): what the file would change and which rows it refuses; writes nothing. */
export function useCsvPreview({ scope, groupId }: CsvOptions) {
  const { i18n } = useLingui();
  return useMutation({
    mutationFn: (file: File) => importFeeGroupCsv(scope, groupId, { file, dryRun: true }),
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
  });
}

/** The import's apply (D3142); `onApplied` receives the option as the server wrote it. */
export function useCsvApply({ scope, groupId, onApplied }: CsvOptions & { onApplied: (group: FeeGroupDto) => void }) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (file: File) => importFeeGroupCsv(scope, groupId, { file, dryRun: false }),
    onSuccess: async (result) => {
      toast.success(i18n._('delivery-pricing.csv-applied'));
      await refresh();
      if (result.group !== null) onApplied(result.group);
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
  });
}
