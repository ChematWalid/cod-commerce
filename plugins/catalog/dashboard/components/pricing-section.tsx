import { BARCODE_MAX, SKU_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { EDITOR_PRICE_TEST_ID, EDITOR_SKU_TEST_ID } from '../constants';
import { isPackForm, pricingReadOnly } from '../model/editor-pack';
import { FormTextField } from './form-text-field';
import type { SectionProps } from './section-props';

interface PricingSectionProps extends SectionProps {
  /** Warning codes of the last save: they did not block it (AC3). */
  readonly warnings: readonly string[];
}

/** The notes under the prices: who prices a pack, what they mean with options, and the warnings of the last save. */
function PricingNotes({ form, warnings }: PricingSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      {isPackForm(form) && (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-pack-pricing-hint')}</p>
      )}
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

/**
 * Price, old price, SKU and barcode. Without options they are the product's one variant; with options they are what
 * new variants start from (D2124). Read-only for a pack, whose prices catalog-packs computes (D2201 c).
 */
export function PricingSection(props: PricingSectionProps): ReactNode {
  const { i18n } = useLingui();
  const currency = i18n._('catalog.currency');
  const section = { ...props, disabled: pricingReadOnly(props.form, props.disabled) };
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField
          section={section}
          field="price"
          labelId="catalog.editor-price"
          data-testid={EDITOR_PRICE_TEST_ID}
          inputMode="numeric"
          suffix={currency}
        />
        <FormTextField
          section={section}
          field="oldPrice"
          labelId="catalog.editor-old-price"
          inputMode="numeric"
          suffix={currency}
        />
        <FormTextField
          section={section}
          field="sku"
          labelId="catalog.editor-sku"
          data-testid={EDITOR_SKU_TEST_ID}
          maxLength={SKU_MAX}
        />
        <FormTextField section={section} field="barcode" labelId="catalog.editor-barcode" maxLength={BARCODE_MAX} />
      </div>
      <PricingNotes {...section} />
    </div>
  );
}
