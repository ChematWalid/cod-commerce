import type { ProductDiscountConfig, ProductDiscountScope } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { JSX } from 'react';
import { DEFAULT_PRODUCT_DISCOUNT_CONFIG } from '../../model/default-configs';
import { readConfig } from '../../model/kind-editors';
import { CheckRow } from '../check-row';
import { ChoiceGroup } from '../choice-group';
import type { KindEditorProps } from '../kind-editor-slot';
import { DiscountFields } from './discount-fields';
import { RolePicker } from './role-picker';

/** What a discount covers; collections wait for the collections session (the picker shows them disabled, D2523). */
export const SCOPE_IDS: Readonly<Record<ProductDiscountScope, string>> = {
  all: 'offers.field-applies-all',
  targets: 'offers.field-applies-targets',
};

interface ProductDiscountFieldsProps {
  readonly editor: KindEditorProps;
  readonly defaults: ProductDiscountConfig;
}

/** The fields of a product discount, shared by the automatic card and the discount-codes card. */
export function ProductDiscountFields({ editor, defaults }: ProductDiscountFieldsProps): JSX.Element {
  const { i18n } = useLingui();
  const config = readConfig<ProductDiscountConfig>(editor.config, defaults);
  return (
    <div className="grid gap-4">
      <ChoiceGroup
        legendId="offers.field-applies-to"
        value={config.appliesTo}
        labelIds={SCOPE_IDS}
        disabled={editor.disabled}
        onChange={(appliesTo) => {
          editor.onConfig({ ...config, appliesTo });
        }}
      />
      {config.appliesTo === 'targets' && <RolePicker editor={editor} role="buy" legendId="offers.editor-targets" />}
      <DiscountFields
        value={config}
        capLabelId="offers.field-cap"
        disabled={editor.disabled}
        onChange={(value) => {
          editor.onConfig({ ...config, ...value });
        }}
      />
      <CheckRow
        label={i18n._('offers.field-countdown')}
        checked={config.showCountdown}
        disabled={editor.disabled}
        onToggle={(showCountdown) => {
          editor.onConfig({ ...config, showCountdown });
        }}
      />
    </div>
  );
}

/** An automatic product discount: a percent or an amount off each piece, capped, with an optional countdown. */
export function ProductDiscountEditor(props: KindEditorProps): JSX.Element {
  return <ProductDiscountFields editor={props} defaults={DEFAULT_PRODUCT_DISCOUNT_CONFIG} />;
}
