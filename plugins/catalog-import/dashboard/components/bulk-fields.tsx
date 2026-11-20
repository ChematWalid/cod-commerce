import { type StoreScope, TextField } from '@cod/plugin-merchant-shell/shell-api';
import { BULK_EDIT_PRICE_MODES, type BulkEditPriceMode, PRODUCT_STATUSES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { BULK_STATUS_TEST_ID } from '../constants';
import { type BulkForm, type BulkStatus, CLEAR_BRAND, KEEP } from '../model/bulk-form';
import { type NamedDto, useBulkTaxonomy } from '../queries';
import { type Choice, ChoiceSelect } from './choice-select';

const STATUS_LABEL_IDS = {
  active: 'catalog-import.status-active',
  hidden: 'catalog-import.status-hidden',
  draft: 'catalog-import.status-draft',
} as const satisfies Record<BulkStatus, string>;

const PRICE_MODE_LABEL_IDS = {
  percent: 'catalog-import.price-percent',
  amount: 'catalog-import.price-amount',
  fixed: 'catalog-import.price-fixed',
} as const satisfies Record<BulkEditPriceMode, string>;

interface BulkFieldsProps {
  readonly scope: StoreScope | null;
  readonly form: BulkForm;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<BulkForm>) => void;
}

/** "Keep as is" first, then the named choices. */
const withKeep = (keepLabel: string, choices: readonly Choice<string>[]): readonly Choice<string>[] => [
  { value: KEEP, label: keepLabel },
  ...choices,
];

const namedChoices = (items: readonly NamedDto[]): readonly Choice<string>[] =>
  items.map(({ id, name }) => ({ value: id, label: name }));

/** The brand and the tag to add or to remove, among the store's own. */
function TaxonomyFields({ scope, form, disabled, onChange }: BulkFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const { brands, tags } = useBulkTaxonomy(scope);
  const keep = i18n._('catalog-import.keep');
  const tagChoices = withKeep(keep, namedChoices(tags));
  return (
    <>
      <ChoiceSelect
        label={i18n._('catalog-import.field-brand')}
        value={form.brandId}
        choices={withKeep(keep, [
          { value: CLEAR_BRAND, label: i18n._('catalog-import.brand-clear') },
          ...namedChoices(brands),
        ])}
        disabled={disabled}
        onChange={(brandId) => {
          onChange({ brandId });
        }}
      />
      <ChoiceSelect
        label={i18n._('catalog-import.tag-add')}
        value={form.addTagId}
        choices={tagChoices}
        disabled={disabled}
        onChange={(addTagId) => {
          onChange({ addTagId });
        }}
      />
      <ChoiceSelect
        label={i18n._('catalog-import.tag-remove')}
        value={form.removeTagId}
        choices={tagChoices}
        disabled={disabled}
        onChange={(removeTagId) => {
          onChange({ removeTagId });
        }}
      />
    </>
  );
}

/** The price change: how, then by how much (a percentage, a signed amount or a fixed price in DZD). */
function PriceFields({ form, disabled, onChange }: Omit<BulkFieldsProps, 'scope'>): ReactNode {
  const { i18n } = useLingui();
  const modes: readonly Choice<BulkEditPriceMode | typeof KEEP>[] = [
    { value: KEEP, label: i18n._('catalog-import.keep') },
    ...BULK_EDIT_PRICE_MODES.map((mode) => ({ value: mode, label: i18n._(PRICE_MODE_LABEL_IDS[mode]) })),
  ];
  return (
    <>
      <ChoiceSelect
        label={i18n._('catalog-import.field-price')}
        value={form.priceMode}
        choices={modes}
        disabled={disabled}
        onChange={(priceMode) => {
          onChange({ priceMode });
        }}
      />
      {form.priceMode !== KEEP && (
        <TextField
          label={i18n._('catalog-import.price-value')}
          inputMode="decimal"
          value={form.priceValue}
          disabled={disabled}
          suffix={form.priceMode === 'percent' ? '%' : i18n._('catalog-import.currency')}
          onChange={(event) => {
            onChange({ priceValue: event.target.value });
          }}
        />
      )}
    </>
  );
}

/** The bulk edit's fields; each left on "Keep as is" is not sent. */
export function BulkFields(props: BulkFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const statuses: readonly Choice<BulkStatus | typeof KEEP>[] = [
    { value: KEEP, label: i18n._('catalog-import.keep') },
    ...PRODUCT_STATUSES.map((status) => ({ value: status, label: i18n._(STATUS_LABEL_IDS[status]) })),
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceSelect
        label={i18n._('catalog-import.field-status')}
        value={props.form.status}
        choices={statuses}
        disabled={props.disabled}
        testId={BULK_STATUS_TEST_ID}
        onChange={(status) => {
          props.onChange({ status });
        }}
      />
      <PriceFields form={props.form} disabled={props.disabled} onChange={props.onChange} />
      <TaxonomyFields {...props} />
    </div>
  );
}
