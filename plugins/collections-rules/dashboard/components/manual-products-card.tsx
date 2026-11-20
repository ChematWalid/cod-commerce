import { COLLECTION_MODES, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, toast } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { ADD_PRODUCTS_TEST_ID, COLLECTION_MODE_TEST_ID } from '../constants';
import { MODE_LABEL_IDS } from '../model/list-view';
import { type ManualProduct, withProducts } from '../model/manual-order';
import { AddProductsDialog } from './add-products-dialog';
import type { ScopedCardProps } from './card-props';
import { FieldError } from './field-error';
import { ProductRows } from './product-rows';

/** Manual or automatic (D2302); the save asks before a saved manual list is replaced (D2339). */
function ModeSwitch({ form, disabled, onChange }: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div role="group" data-testid={COLLECTION_MODE_TEST_ID} className="flex flex-wrap gap-2">
      {COLLECTION_MODES.map((mode) => (
        <Button
          key={mode}
          type="button"
          size="sm"
          variant={form.mode === mode ? 'default' : 'outline'}
          aria-pressed={form.mode === mode}
          data-mode={mode}
          disabled={disabled}
          onClick={() => {
            onChange({ mode });
          }}
        >
          {i18n._(MODE_LABEL_IDS[mode])}
        </Button>
      ))}
    </div>
  );
}

/** The hand-ordered list: reorder by drag or arrow keys, remove, and add from the store's products. */
function ManualList(props: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  const [adding, setAdding] = useState(false);
  const change = (products: readonly ManualProduct[]): void => {
    props.onChange({ products });
  };
  return (
    <div className="grid gap-3">
      <ProductRows products={props.form.products} editable={!props.disabled} onReorder={change} />
      <div>
        <Button
          type="button"
          variant="outline"
          data-testid={ADD_PRODUCTS_TEST_ID}
          disabled={props.disabled || props.scope === null}
          onClick={() => {
            setAdding(true);
          }}
        >
          {i18n._('collections.add-products')}
        </Button>
      </div>
      {adding && (
        <AddProductsDialog
          scope={props.scope}
          present={props.form.products}
          onConfirm={(added) => {
            const next = withProducts(props.form.products, added);
            change(next.products);
            if (next.dropped > 0) toast.error(i18n._(COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS));
            setAdding(false);
          }}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/** The current members of an automatic collection, read-only: its conditions decide them. */
function AutomaticMembers({ form }: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{i18n._('collections.automatic-hint')}</p>
      <ProductRows products={form.products} editable={false} onReorder={() => undefined} />
    </div>
  );
}

/** The Products card: the mode, then the hand-ordered list or the rule's current members. */
export function ManualProductsCard(props: ScopedCardProps): ReactNode {
  return (
    <div className="grid gap-4">
      <ModeSwitch {...props} />
      {props.form.mode === 'manual' ? <ManualList {...props} /> : <AutomaticMembers {...props} />}
      <FieldError messageId={props.errors.products ?? props.errors.rule} />
    </div>
  );
}
