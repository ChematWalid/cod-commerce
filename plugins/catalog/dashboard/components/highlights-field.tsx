import { MAX_PRODUCT_HIGHLIGHTS } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { useCatalogHighlights } from '../editor-queries';
import { CheckList } from './check-list';
import { LtrRun } from './ltr-run';
import type { ScopedSectionProps } from './section-props';

/** The store's selling points this product shows, at most six (AC3); a seventh cannot be ticked. */
export function HighlightsField({ form, errors, disabled, onChange, scope }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  const highlights = useCatalogHighlights(scope).data ?? [];
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-xs">
        <LtrRun>{`${String(form.highlightIds.length)} / ${String(MAX_PRODUCT_HIGHLIGHTS)}`}</LtrRun>
      </p>
      {highlights.length === 0 ? (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.editor-no-highlights')}</p>
      ) : (
        <CheckList
          items={highlights.map((highlight) => ({ id: highlight.id, label: highlight.text }))}
          selected={form.highlightIds}
          disabled={disabled}
          canAddMore={form.highlightIds.length < MAX_PRODUCT_HIGHLIGHTS}
          onChange={(highlightIds) => {
            onChange({ highlightIds });
          }}
        />
      )}
      {errors.highlightIds !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errors.highlightIds)}
        </p>
      )}
    </div>
  );
}
