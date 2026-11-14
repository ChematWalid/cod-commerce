import { OPTION_VALUE_SEPARATOR, SKU_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { VARIANT_PRICE_TEST_ID, VARIANT_ROW_TEST_ID } from '../constants';
import type { VariantDraft } from '../model/editor-form';
import type { SectionProps } from './section-props';

/** The select value for "the product's image": an option needs a non-empty value. */
const NO_IMAGE = 'none';

interface VariantsTableProps extends SectionProps {
  readonly previews: ReadonlyMap<string, string>;
  /** True when unsaved option changes will rebuild the matrix on save. */
  readonly optionsChanged: boolean;
}

interface RowProps {
  readonly row: VariantDraft;
  readonly table: VariantsTableProps;
  readonly onRow: (change: Partial<VariantDraft>) => void;
}

/** The variant's own image among the product's images, or none (it then shows the product's). */
function ImageCell({ row, table, onRow }: RowProps): ReactNode {
  const { i18n } = useLingui();
  const preview = row.featuredAssetId === null ? undefined : table.previews.get(row.featuredAssetId);
  return (
    <Select
      value={row.featuredAssetId ?? NO_IMAGE}
      disabled={table.disabled}
      onValueChange={(value) => {
        onRow({ featuredAssetId: value === null || value === NO_IMAGE ? null : value });
      }}
    >
      <SelectTrigger className="w-20" aria-label={i18n._('catalog.variant-image')}>
        <SelectValue>
          {preview === undefined ? (
            <span aria-hidden className="cod-catalog-thumb bg-muted inline-block" />
          ) : (
            <img src={preview} alt="" className="cod-catalog-thumb object-cover" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_IMAGE}>{i18n._('catalog.variant-no-image')}</SelectItem>
        {table.form.assetIds.map((assetId) => (
          <SelectItem key={assetId} value={assetId}>
            <img src={table.previews.get(assetId)} alt="" className="cod-catalog-thumb object-cover" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A text cell of the row: left-to-right, labelled with the variant's options for screen readers. */
function RowInput(props: RowProps & { readonly field: 'sku' | 'price'; readonly labelId: string }): ReactNode {
  const { i18n } = useLingui();
  const { row, table, onRow, field } = props;
  const name = row.optionValues.join(OPTION_VALUE_SEPARATOR);
  return (
    <Input
      dir="ltr"
      {...(field === 'price'
        ? { inputMode: 'numeric' as const, 'data-testid': VARIANT_PRICE_TEST_ID }
        : { maxLength: SKU_MAX })}
      aria-label={i18n._(props.labelId, { name })}
      value={row[field]}
      disabled={table.disabled}
      onChange={(event) => {
        onRow({ [field]: event.target.value });
      }}
    />
  );
}

function VariantRow(props: RowProps): ReactNode {
  const { i18n } = useLingui();
  const { row, table, onRow } = props;
  const name = row.optionValues.join(OPTION_VALUE_SEPARATOR);
  return (
    <TableRow data-testid={VARIANT_ROW_TEST_ID}>
      <TableCell>
        <ImageCell {...props} />
      </TableCell>
      <TableCell className="[overflow-wrap:anywhere]">{name}</TableCell>
      <TableCell>
        <RowInput {...props} field="sku" labelId="catalog.variant-sku" />
      </TableCell>
      <TableCell>
        <RowInput {...props} field="price" labelId="catalog.variant-price" />
      </TableCell>
      <TableCell>
        <Checkbox
          aria-label={i18n._('catalog.variant-hidden', { name })}
          checked={row.isHidden}
          disabled={table.disabled}
          onCheckedChange={(on) => {
            onRow({ isHidden: on });
          }}
        />
      </TableCell>
    </TableRow>
  );
}

/**
 * The live variants: image, options, SKU, custom price and hidden (AC1). Edits go by variant id; the matrix itself is
 * rebuilt by the server when the options change (D2124).
 */
export function VariantsTable(props: VariantsTableProps): ReactNode {
  const { i18n } = useLingui();
  const { form, errors, onChange } = props;
  const onRow = (id: string) => (change: Partial<VariantDraft>) => {
    onChange({ variants: form.variants.map((row) => (row.id === id ? { ...row, ...change } : row)) });
  };
  return (
    <div className="grid gap-2 overflow-x-auto">
      {props.optionsChanged && (
        <p role="status" className="text-muted-foreground text-xs">
          {i18n._('catalog.variants-rebuilt')}
        </p>
      )}
      {errors.variants !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errors.variants)}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{i18n._('catalog.variant-image')}</TableHead>
            <TableHead className="text-start">{i18n._('catalog.variant-options')}</TableHead>
            <TableHead className="text-start">{i18n._('catalog.editor-sku')}</TableHead>
            <TableHead className="text-start">{i18n._('catalog.variant-custom-price')}</TableHead>
            <TableHead className="text-start">{i18n._('catalog.variant-hidden-column')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {form.variants.map((row) => (
            <VariantRow key={row.id} row={row} table={props} onRow={onRow(row.id)} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
