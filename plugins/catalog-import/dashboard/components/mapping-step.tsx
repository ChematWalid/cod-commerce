import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { IMPORT_FIELD_KEYS, type ImportFieldKey } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import { type ReactNode, useMemo, useState } from 'react';
import { IMPORT_MAPPING_NEXT_TEST_ID } from '../constants';
import { useFailureToast } from '../hooks/use-catalog-import';
import { rowReasonMessageId } from '../model/import-errors';
import { type ColumnMapping, type ImportColumn, importFieldKeyOf, mappingOf, withColumnField } from '../model/wizard';
import { type ImportPreviewDto, previewImport } from '../queries';
import { type Choice, ChoiceSelect } from './choice-select';

/** The message id naming each spreadsheet column (D2209). */
export const FIELD_LABEL_IDS = {
  product_key: 'catalog-import.field-product-key',
  name: 'catalog-import.field-name',
  description: 'catalog-import.field-description',
  status: 'catalog-import.field-status',
  type: 'catalog-import.field-type',
  price: 'catalog-import.field-price',
  old_price: 'catalog-import.field-old-price',
  weight: 'catalog-import.field-weight',
  brand: 'catalog-import.field-brand',
  tags: 'catalog-import.field-tags',
  collections: 'catalog-import.field-collections',
  option1_name: 'catalog-import.field-option1-name',
  option1_value: 'catalog-import.field-option1-value',
  option2_name: 'catalog-import.field-option2-name',
  option2_value: 'catalog-import.field-option2-value',
  option3_name: 'catalog-import.field-option3-name',
  option3_value: 'catalog-import.field-option3-value',
  variant_sku: 'catalog-import.field-variant-sku',
  barcode: 'catalog-import.field-barcode',
  image_urls: 'catalog-import.field-image-urls',
} as const satisfies Record<ImportFieldKey, string>;

/** The select's value for an ignored column (no field key is empty). */
const IGNORED = '';

interface MappingStepProps {
  readonly scope: StoreScope | null;
  readonly importId: string;
  readonly columns: readonly ImportColumn[];
  readonly onBack: () => void;
  readonly onPreviewed: (preview: ImportPreviewDto) => void;
}

/** The field choices, translated, the first one ignoring the column. */
function useFieldChoices(): readonly Choice<string>[] {
  const { i18n } = useLingui();
  return useMemo(
    () => [
      { value: IGNORED, label: i18n._('catalog-import.field-ignored') },
      ...IMPORT_FIELD_KEYS.map((key) => ({ value: key, label: i18n._(FIELD_LABEL_IDS[key]) })),
    ],
    [i18n],
  );
}

/** One column of the file: its header, the field it fills and the server's warning. */
function ColumnRow(props: {
  readonly column: ImportColumn;
  readonly field: ImportFieldKey | null;
  readonly choices: readonly Choice<string>[];
  readonly onField: (field: ImportFieldKey | null) => void;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableRow>
      <TableCell className="font-medium">{props.column.header}</TableCell>
      <TableCell>
        <ChoiceSelect
          label={i18n._('catalog-import.mapping-field-of', { header: props.column.header })}
          value={props.field ?? IGNORED}
          choices={props.choices}
          onChange={(value) => {
            props.onField(importFieldKeyOf(value));
          }}
        />
        {props.column.warning !== null && props.field === null && (
          <p className="text-muted-foreground mt-1 text-xs">{i18n._(rowReasonMessageId(props.column.warning))}</p>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Each column of the file and the field it fills. */
function MappingTable(props: {
  readonly columns: readonly ImportColumn[];
  readonly mapping: readonly ColumnMapping[];
  readonly onMapping: (update: (current: readonly ColumnMapping[]) => readonly ColumnMapping[]) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const choices = useFieldChoices();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{i18n._('catalog-import.mapping-header')}</TableHead>
          <TableHead>{i18n._('catalog-import.mapping-field')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.columns.map((column) => (
          <ColumnRow
            key={column.column}
            column={column}
            field={props.mapping.find((entry) => entry.column === column.column)?.field ?? null}
            choices={choices}
            onField={(field) => {
              props.onMapping((current) => withColumnField(current, column.column, field));
            }}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/** Step 2: the field each column fills, as the server guessed it from the headers; the merchant may change it. */
export function MappingStep(props: MappingStepProps): ReactNode {
  const { i18n } = useLingui();
  const onFailure = useFailureToast();
  const [mapping, setMapping] = useState<readonly ColumnMapping[]>(() => mappingOf(props.columns));
  const preview = useMutation({
    mutationFn: () => previewImport(props.scope, props.importId, mapping),
    onSuccess: props.onPreviewed,
    onError: onFailure,
  });
  return (
    <div className="grid gap-4">
      <MappingTable columns={props.columns} mapping={mapping} onMapping={setMapping} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={props.onBack}>
          {i18n._('catalog-import.back')}
        </Button>
        <Button
          data-testid={IMPORT_MAPPING_NEXT_TEST_ID}
          disabled={preview.isPending}
          onClick={() => {
            preview.mutate();
          }}
        >
          {i18n._('catalog-import.mapping-next')}
        </Button>
      </div>
    </div>
  );
}
