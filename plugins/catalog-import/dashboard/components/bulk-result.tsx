import type { BulkEditChangedField } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { BULK_RESULT_TEST_ID } from '../constants';
import { codeMessageId, UNKNOWN_REASON_MESSAGE_ID } from '../model/import-errors';
import type { BulkPhase } from '../model/bulk-form';
import type { BulkEditProductResultDto } from '../queries';

const CHANGED_FIELD_LABEL_IDS = {
  status: 'catalog-import.changed-status',
  brand: 'catalog-import.changed-brand',
  tags: 'catalog-import.changed-tags',
  price: 'catalog-import.changed-price',
} as const satisfies Record<BulkEditChangedField, string>;

const changedFieldLabelId = (field: string): string =>
  field in CHANGED_FIELD_LABEL_IDS ? CHANGED_FIELD_LABEL_IDS[field as BulkEditChangedField] : UNKNOWN_REASON_MESSAGE_ID;

/** What one product's line says: its refusal, the fields that change, or that nothing changes. */
function outcomeOf(result: BulkEditProductResultDto, translate: (id: string) => string): string {
  if (!result.ok) return translate(codeMessageId(result.error ?? ''));
  if (result.changedFields.length === 0) return translate('catalog-import.bulk-unchanged');
  return result.changedFields.map((field) => translate(changedFieldLabelId(field))).join(', ');
}

/** The product as its line names it: its title, or "Product <id>" when the store has no such product (issue 261). */
function productNameOf(
  result: BulkEditProductResultDto,
  translate: (id: string, values: Record<string, unknown>) => string,
): string {
  return result.productTitle ?? translate('catalog-import.bulk-product-unnamed', { id: result.productId });
}

/**
 * The bulk edit's answer per product (D2213): after the dry run what would change, after applying what changed; a
 * refused product says why and the others still change.
 */
export function BulkResult(props: {
  readonly phase: BulkPhase;
  readonly results: readonly BulkEditProductResultDto[];
}): ReactNode {
  const { i18n } = useLingui();
  const translate = (id: string, values: Record<string, unknown> = {}): string => i18n._(id, values);
  const refused = props.results.filter((result) => !result.ok).length;
  return (
    <div data-testid={BULK_RESULT_TEST_ID} data-phase={props.phase} className="grid gap-2 text-sm">
      <p className="font-medium">
        {i18n._(props.phase === 'applied' ? 'catalog-import.bulk-applied' : 'catalog-import.bulk-dry-run', {
          count: props.results.length - refused,
          refused,
        })}
      </p>
      <ul className="grid max-h-60 gap-1 overflow-y-auto">
        {props.results.map((result) => (
          <li key={result.productId} className={result.ok ? undefined : 'text-destructive'}>
            {/* The title is the merchant's text in any script: isolated, so its digits keep their place (issue 261). */}
            <bdi>{productNameOf(result, translate)}</bdi>
            {i18n._('catalog-import.bulk-product-line', { outcome: outcomeOf(result, translate) })}
          </li>
        ))}
      </ul>
    </div>
  );
}
