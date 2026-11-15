import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, toast } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PACK_PREVIEW_TEST_ID, PACK_PRICE_TEST_ID } from '../constants';
import { packFailureMessageId } from '../hooks/use-pack-save';
import { formatDzd } from '../model/format-dzd';
import { type PackForm, packFormErrors, packInputOf } from '../model/pack-form';
import { type CatalogPackPreviewDto, previewCatalogPack } from '../queries';
import { LtrRun } from './ltr-run';

interface PackPreviewProps {
  readonly scope: StoreScope | null;
  readonly form: PackForm;
  readonly disabled: boolean;
  /** The price stored on the pack product, as catalog-packs last computed it. */
  readonly storedPrice: number;
}

/** An amount in whole DZD in the display language, kept left-to-right. */
function Amount({ amount }: { readonly amount: number }): ReactNode {
  const { i18n } = useLingui();
  const language = i18n.locale.split(/[-_]/)[0] ?? i18n.locale;
  return <LtrRun>{`${formatDzd(amount, language)} ${i18n._('packs.currency')}`}</LtrRun>;
}

/** What the server computed for the form as it stands. */
function PreviewAnswer({ preview }: { readonly preview: CatalogPackPreviewDto }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1 text-sm">
      <p>
        {i18n._('packs.preview-price')} <Amount amount={preview.price} />
      </p>
      <p>
        {i18n._('packs.preview-weight')} <LtrRun>{`${String(preview.weightGrams)} ${i18n._('packs.grams')}`}</LtrRun>
      </p>
      {preview.sharedValues.map((shared) => (
        <p key={shared.value}>
          {shared.value}: <Amount amount={shared.price} />
        </p>
      ))}
    </div>
  );
}

/** The stored price, and a preview of the form's price and weight computed by the server without saving. */
export function PackPreview({ scope, form, disabled, storedPrice }: PackPreviewProps): ReactNode {
  const { i18n } = useLingui();
  const preview = useMutation({
    mutationFn: () => previewCatalogPack(scope, packInputOf(form)),
    onError: (error: unknown) => {
      toast.error(i18n._(packFailureMessageId(error)));
    },
  });
  const valid = Object.keys(packFormErrors(form)).length === 0;
  return (
    <div className="grid gap-2">
      <p data-testid={PACK_PRICE_TEST_ID}>
        {i18n._('packs.stored-price')} <Amount amount={storedPrice} />
      </p>
      <div>
        <Button
          type="button"
          variant="outline"
          data-testid={PACK_PREVIEW_TEST_ID}
          disabled={disabled || !valid || preview.isPending}
          onClick={() => {
            preview.mutate();
          }}
        >
          {i18n._('packs.preview')}
        </Button>
      </div>
      {preview.data !== undefined && <PreviewAnswer preview={preview.data} />}
    </div>
  );
}
