import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { PREVIEW_COUNT_TEST_ID } from '../constants';
import { usePreviewMatches } from '../hooks/use-preview-matches';
import { errorMessageIdOf } from '../model/list-view';
import type { PreviewState } from '../model/preview-request';
import { ignoredRowCountOf, type RuleDraft } from '../model/rule-draft';
import type { StoreScope } from '../model/store-query';
import { ProductRows } from './product-rows';

/** The count line: what the latest answer says, or why there is none yet. */
function PreviewCount({ state }: { readonly state: PreviewState }): ReactNode {
  const { i18n } = useLingui();
  if (state.kind === 'failed') return <p role="alert">{i18n._(errorMessageIdOf(state.error))}</p>;
  const count = state.kind === 'answered' ? state.page.totalItems : undefined;
  return (
    <p
      data-testid={PREVIEW_COUNT_TEST_ID}
      data-state={state.kind}
      data-count={count}
      aria-live="polite"
      className="text-sm font-medium"
    >
      {state.kind === 'idle' && i18n._('collections.preview-incomplete')}
      {state.kind === 'pending' && i18n._('collections.preview-loading')}
      {count !== undefined && i18n._('collections.preview-count', { count })}
    </p>
  );
}

/** How many rows the preview left out, so a count for fewer rows is never read as the rule's (an All rule broadens). */
function IgnoredRows({ rule }: { readonly rule: RuleDraft | null }): ReactNode {
  const { i18n } = useLingui();
  const count = ignoredRowCountOf(rule);
  if (count === 0) return null;
  return <p className="text-muted-foreground text-sm">{i18n._('collections.preview-ignored', { count })}</p>;
}

/** "N products match" and the first matches of the unsaved rule, newest first; nothing is saved (AC4, D2331). */
export function PreviewPanel({ scope, rule }: { readonly scope: StoreScope | null; readonly rule: RuleDraft | null }) {
  const { i18n } = useLingui();
  const state = usePreviewMatches(scope, rule);
  return (
    <section className="grid gap-2" aria-label={i18n._('collections.preview-heading')}>
      <p className="text-sm font-medium">{i18n._('collections.preview-heading')}</p>
      <PreviewCount state={state} />
      <IgnoredRows rule={rule} />
      {state.kind === 'answered' && (
        <ProductRows products={state.page.items} editable={false} onReorder={() => undefined} />
      )}
    </section>
  );
}
