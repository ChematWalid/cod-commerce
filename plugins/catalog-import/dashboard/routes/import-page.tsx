import {
  type ShellPageProps,
  type StoreScope,
  StoreScopedPage,
  useStoreScope,
} from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { FullWidthPageBlock, Page, PageLayout, PageTitle } from '@vendure/dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ConfirmStep } from '../components/confirm-step';
import { ImportSteps } from '../components/import-steps';
import { MappingStep } from '../components/mapping-step';
import { PreviewStep } from '../components/preview-step';
import { UploadStep } from '../components/upload-step';
import { CATALOG_IMPORT_PAGE_TEST_ID, CREATE_PRODUCTS_KEY, IMPORT_PREVIEW_QUERY_KEY } from '../constants';
import {
  type ColumnMapping,
  initialWizard,
  previousStep,
  withAnalyzed,
  withConfirmed,
  withPreviewed,
  withReviewed,
  type WizardState,
} from '../model/wizard';
import type { CatalogImportDto, ImportPreviewDto } from '../queries';

/** The import page's own page id and block id. */
const IMPORT_PAGE_ID = 'catalog-import-page';
const IMPORT_BLOCK_ID = 'catalog-import-wizard';

/**
 * The wizard's state, what the server answered along the way and the mapping last sent (kept for Back). A new preview
 * drops the cached preview pages, which were planned with the earlier mapping.
 */
function useWizard() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<WizardState>(initialWizard);
  const [analyzed, setAnalyzed] = useState<CatalogImportDto | null>(null);
  const [preview, setPreview] = useState<ImportPreviewDto | null>(null);
  const [mapping, setMapping] = useState<readonly ColumnMapping[] | null>(null);
  const back = (): void => {
    setState((current) => previousStep(current) ?? current);
  };
  return {
    state,
    analyzed,
    preview,
    mapping,
    back,
    onAnalyzed: (job: CatalogImportDto) => {
      setAnalyzed(job);
      setMapping(null);
      setState((current) => withAnalyzed(current, job.importId));
    },
    onPreviewed: (answer: ImportPreviewDto, sent: readonly ColumnMapping[]) => {
      queryClient.removeQueries({ queryKey: IMPORT_PREVIEW_QUERY_KEY });
      setPreview(answer);
      setMapping(sent);
      setState(withPreviewed);
    },
    onReviewed: () => {
      setState(withReviewed);
    },
    onConfirmed: () => {
      setState(withConfirmed);
    },
  };
}

type Wizard = ReturnType<typeof useWizard>;

/** The panel of a step past the upload, once the server answered what it needs. */
function StepPanel({ scope, wizard }: { readonly scope: StoreScope | null; readonly wizard: Wizard }): ReactNode {
  const { state, analyzed, preview } = wizard;
  const importId = state.importId;
  if (importId === null) return null;
  if (state.step === 'mapping' && analyzed !== null)
    return (
      <MappingStep
        key={importId}
        scope={scope}
        importId={importId}
        columns={analyzed.columns}
        sent={wizard.mapping}
        onBack={wizard.back}
        onPreviewed={wizard.onPreviewed}
      />
    );
  if (state.step === 'preview' && preview !== null)
    return (
      <PreviewStep scope={scope} importId={importId} first={preview} onBack={wizard.back} onNext={wizard.onReviewed} />
    );
  if (state.step !== 'confirm') return null;
  return (
    <ConfirmStep
      scope={scope}
      importId={importId}
      summary={preview?.summary ?? null}
      confirmed={state.confirmed}
      onBack={wizard.back}
      onConfirmed={wizard.onConfirmed}
    />
  );
}

/** The step bar and the current step's panel. */
function WizardPanel({ scope }: { readonly scope: StoreScope | null }): ReactNode {
  const wizard = useWizard();
  return (
    <div className="grid gap-6">
      <ImportSteps step={wizard.state.step} />
      {wizard.state.step === 'upload' ? (
        <UploadStep scope={scope} onAnalyzed={wizard.onAnalyzed} />
      ) : (
        <StepPanel scope={scope} wizard={wizard} />
      )}
    </div>
  );
}

/** The wizard in its page, for the URL's store. */
function ImportProducts({ store }: ShellPageProps): ReactNode {
  const { i18n } = useLingui();
  const scope = useStoreScope(store);
  return (
    <Page pageId={IMPORT_PAGE_ID}>
      <PageTitle>{i18n._('catalog-import.page-title')}</PageTitle>
      <PageLayout>
        <FullWidthPageBlock blockId={IMPORT_BLOCK_ID}>
          <div data-testid={CATALOG_IMPORT_PAGE_TEST_ID} data-store-id={store?.id}>
            <WizardPanel key={store?.id} scope={scope} />
          </div>
        </FullWidthPageBlock>
      </PageLayout>
    </Page>
  );
}

/**
 * `/stores/$storeId/products/import`: upload → mapping → preview → confirm (D2210), for holders of the create key on
 * the URL's store. Presentation only: the server parses, plans and writes every row (ADR 0017).
 */
export function ImportPage(): ReactNode {
  return <StoreScopedPage permission={CREATE_PRODUCTS_KEY}>{(props) => <ImportProducts {...props} />}</StoreScopedPage>;
}
