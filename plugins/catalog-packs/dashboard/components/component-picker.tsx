import { type StoreScope, TextField } from '@cod/plugin-merchant-shell/shell-api';
import { PACK_MAX_QUANTITY } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { PACK_COMPONENT_ROW_TEST_ID, PACK_PICKER_OPTION_TEST_ID, PACK_PICKER_SEARCH_TEST_ID } from '../constants';
import {
  type PickableProduct,
  pickableProducts,
  typedQuantity,
  withComponent,
  withComponentChange,
  withoutComponent,
} from '../model/pack-components';
import { type PackComponentDraft, packFieldDisabled } from '../model/pack-form';
import { usePackCandidates } from '../queries';
import type { PackFormProps } from './pack-modes';

/** The variant choice that pins none: the buyer picks one when ordering. */
const ANY_VARIANT = 'any';

interface PickerProps extends PackFormProps {
  readonly scope: StoreScope | null;
  readonly productId: string;
  /** Products the block has read, by id: the components' titles and variants. */
  readonly known: ReadonlyMap<string, PickableProduct>;
  readonly onKnown: (product: PickableProduct) => void;
}

interface RowProps {
  readonly line: PackComponentDraft;
  readonly product: PickableProduct | undefined;
  readonly variantDisabled: boolean;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<Pick<PackComponentDraft, 'variantId' | 'quantity'>>) => void;
  readonly onRemove: () => void;
}

/** A component's variant: any (the buyer's choice) or one pinned. */
function VariantSelect({ line, product, variantDisabled, onChange }: RowProps): ReactNode {
  const { i18n } = useLingui();
  const variants = product?.variants ?? [];
  const chosen = variants.find((variant) => variant.id === line.variantId);
  return (
    <Select
      value={line.variantId ?? ANY_VARIANT}
      disabled={variantDisabled || variants.length < 2}
      onValueChange={(value) => {
        onChange({ variantId: value === null || value === ANY_VARIANT ? null : value });
      }}
    >
      <SelectTrigger className="w-full sm:w-48" aria-label={i18n._('packs.component-variant')}>
        <SelectValue>{chosen?.name ?? i18n._('packs.any-variant')}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_VARIANT}>{i18n._('packs.any-variant')}</SelectItem>
        {variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id}>
            {variant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A line's quantity as typed: the field may be cleared and retyped; it shows the line's count again on blur. */
function QuantityInput({ line, disabled, onChange }: RowProps): ReactNode {
  const { i18n } = useLingui();
  const [text, setText] = useState(String(line.quantity));
  return (
    <Input
      type="number"
      min={1}
      max={PACK_MAX_QUANTITY}
      className="w-20"
      aria-label={i18n._('packs.component-quantity')}
      value={text}
      disabled={disabled}
      onChange={(event) => {
        setText(event.target.value);
        const quantity = typedQuantity(event.target.value);
        if (quantity !== undefined) onChange({ quantity });
      }}
      onBlur={() => {
        setText(String(typedQuantity(text) ?? line.quantity));
      }}
    />
  );
}

/** One component line: its title, variant, quantity and a remove button. */
function ComponentRow(props: RowProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <li data-testid={PACK_COMPONENT_ROW_TEST_ID} className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 truncate">{props.product?.title ?? props.line.title}</span>
      <VariantSelect {...props} />
      <QuantityInput {...props} />
      <Button type="button" variant="outline" disabled={props.disabled} onClick={props.onRemove}>
        {i18n._('packs.remove-component')}
      </Button>
    </li>
  );
}

/** The store's products matching the search that the pack may take, each with an Add button. */
function Candidates(props: PickerProps & { readonly search: string }): ReactNode {
  const { i18n } = useLingui();
  const candidates = usePackCandidates(props.scope, props.search).data ?? [];
  const offered = pickableProducts(candidates, props.productId, props.form);
  if (offered.length === 0) return <p className="text-muted-foreground text-sm">{i18n._('packs.no-candidates')}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {offered.map((product) => (
        <li key={product.id}>
          <Button
            type="button"
            variant="secondary"
            data-testid={PACK_PICKER_OPTION_TEST_ID}
            disabled={props.disabled}
            onClick={() => {
              props.onKnown(product);
              props.onChange({ components: withComponent(props.form, product).components });
            }}
          >
            {`+ ${product.title}`}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Why the component lines are refused, if they are. */
function ComponentsError({ errorId }: { readonly errorId: string | undefined }): ReactNode {
  const { i18n } = useLingui();
  if (errorId === undefined) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {i18n._(errorId)}
    </p>
  );
}

/** The pack's component lines and a search to add products of the store (no pack, not this one). */
export function ComponentPicker(props: PickerProps): ReactNode {
  const { i18n } = useLingui();
  const [search, setSearch] = useState('');
  const { form, disabled, onChange } = props;
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {form.components.map((line, index) => (
          <ComponentRow
            // A stored pack may repeat a product with another pinned variant (D2202), so the id alone is not unique.
            key={`${String(index)}:${line.productId}:${line.variantId ?? ANY_VARIANT}`}
            line={line}
            product={props.known.get(line.productId)}
            disabled={disabled}
            variantDisabled={packFieldDisabled(form, 'componentVariant', disabled)}
            onChange={(change) => {
              onChange({ components: withComponentChange(form, index, change).components });
            }}
            onRemove={() => {
              onChange({ components: withoutComponent(form, index).components });
            }}
          />
        ))}
      </ul>
      <ComponentsError errorId={props.errors.components} />
      <TextField
        label={i18n._('packs.picker-search')}
        data-testid={PACK_PICKER_SEARCH_TEST_ID}
        value={search}
        disabled={disabled}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      <Candidates {...props} search={search} />
    </div>
  );
}
