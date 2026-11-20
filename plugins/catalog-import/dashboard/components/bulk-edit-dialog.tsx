import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { BULK_DIALOG_TEST_ID, BULK_SUBMIT_TEST_ID } from '../constants';
import { useFailureToast, useProductsChanged } from '../hooks/use-catalog-import';
import { type BulkForm, type BulkPhase, bulkRequestOf, emptyBulkForm, nextBulkPhase } from '../model/bulk-form';
import { bulkEditProducts, type BulkEditProductResultDto } from '../queries';
import { BulkFields } from './bulk-fields';
import { BulkResult } from './bulk-result';

interface BulkEditDialogProps {
  readonly scope: StoreScope | null;
  readonly productIds: readonly string[];
  readonly onClose: () => void;
}

const SUBMIT_LABEL_IDS = {
  edit: 'catalog-import.bulk-dry-run-start',
  reviewed: 'catalog-import.bulk-apply',
  applied: 'catalog-import.close',
} as const satisfies Record<BulkPhase, string>;

/** The form, the phase and the last answer; a changed form needs a new dry run. */
function useBulkEdit(props: BulkEditDialogProps) {
  const onFailure = useFailureToast();
  const productsChanged = useProductsChanged();
  const [form, setForm] = useState<BulkForm>(emptyBulkForm);
  const [phase, setPhase] = useState<BulkPhase>('edit');
  const [results, setResults] = useState<readonly BulkEditProductResultDto[] | null>(null);
  const request = bulkRequestOf(form, props.productIds, phase);
  const send = useMutation({
    mutationFn: async () => {
      if (!request.ok) throw new Error(request.messageId);
      return bulkEditProducts(props.scope, request.input);
    },
    onSuccess: async (answer) => {
      setResults(answer);
      setPhase(nextBulkPhase(phase));
      if (phase === 'reviewed') await productsChanged();
    },
    onError: onFailure,
  });
  const onChange = (change: Partial<BulkForm>): void => {
    setForm((current) => ({ ...current, ...change }));
    setPhase('edit');
    setResults(null);
  };
  return { form, phase, results, request, send, onChange };
}

type BulkEdit = ReturnType<typeof useBulkEdit>;

/** Cancel while editing; the button that runs the dry run, applies it, then closes the dialog. */
function BulkFooter({ bulk, onClose }: { readonly bulk: BulkEdit; readonly onClose: () => void }): ReactNode {
  const { i18n } = useLingui();
  const applied = bulk.phase === 'applied';
  return (
    <DialogFooter>
      {!applied && (
        <Button variant="outline" onClick={onClose}>
          {i18n._('catalog-import.cancel')}
        </Button>
      )}
      <Button
        data-testid={BULK_SUBMIT_TEST_ID}
        data-phase={bulk.phase}
        disabled={!applied && (!bulk.request.ok || bulk.send.isPending)}
        onClick={() => {
          if (applied) onClose();
          else bulk.send.mutate();
        }}
      >
        {i18n._(SUBMIT_LABEL_IDS[bulk.phase])}
      </Button>
    </DialogFooter>
  );
}

/**
 * "Bulk edit" of the ticked products (D2213): status, brand, tags and price; a dry run shows what would change, then
 * the merchant applies it. Presentation only: the server checks and writes every product (ADR 0017).
 */
export function BulkEditDialog(props: BulkEditDialogProps): ReactNode {
  const { i18n } = useLingui();
  const bulk = useBulkEdit(props);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent data-testid={BULK_DIALOG_TEST_ID}>
        <DialogHeader>
          <DialogTitle>{i18n._('catalog-import.bulk-title', { count: props.productIds.length })}</DialogTitle>
        </DialogHeader>
        <BulkFields scope={props.scope} form={bulk.form} disabled={bulk.phase === 'applied'} onChange={bulk.onChange} />
        {!bulk.request.ok && bulk.phase !== 'applied' && (
          <p className="text-muted-foreground text-sm">{i18n._(bulk.request.messageId)}</p>
        )}
        {bulk.results !== null && <BulkResult phase={bulk.phase} results={bulk.results} />}
        <BulkFooter bulk={bulk} onClose={props.onClose} />
      </DialogContent>
    </Dialog>
  );
}
