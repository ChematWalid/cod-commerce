import { BARCODE_MAX, SKU_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { EDITOR_PRICE_TEST_ID, EDITOR_SKU_TEST_ID } from '../constants';
import { FormTextField } from './form-text-field';
import type { SectionProps } from './section-props';

interface PricingSectionProps extends SectionProps {
  /** Warning codes of the last save: they did not block it (AC3). */
  readonly warnings: readonly string[];
}

/**
 * Price, old price, SKU and barcode. Without options they are the product's one variant; with options they are what
 * new variants start from (D2124).
 */
/** The notes under the prices: what they mean with options, and the warnings of the last save. */
function PricingNotes({ form, warnings }: PricingSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      {form.options.length > 0 && (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-price-hint')}</p>
      )}
      {warnings.map((code) => (
        <p key={code} role="status" className="text-warning text-sm">
          {i18n._(code)}
        </p>
      ))}
    </>
  );
}

export function PricingSection(props: PricingSectionProps): ReactNode {
  const { i18n } = useLingui();
  const currency = i18n._('catalog.currency');
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField
          section={props}
          field="price"
          labelId="catalog.editor-price"
          data-testid={EDITOR_PRICE_TEST_ID}
          inputMode="numeric"
          suffix={currency}
        />
        <FormTextField
          section={props}
          field="oldPrice"
          labelId="catalog.editor-old-price"
          inputMode="numeric"
          suffix={currency}
        />
        <FormTextField
          section={props}
          field="sku"
          labelId="catalog.editor-sku"
          data-testid={EDITOR_SKU_TEST_ID}
          maxLength={SKU_MAX}
        />
        <FormTextField section={props} field="barcode" labelId="catalog.editor-barcode" maxLength={BARCODE_MAX} />
      </div>
      <PricingNotes {...props} />
    </div>
  );
}
