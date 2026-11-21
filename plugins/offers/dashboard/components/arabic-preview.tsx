import type { OfferPreview, PreviewScenario, QuoteLine } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Badge } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { ARABIC_PREVIEW_TEST_ID } from '../constants';
import { formatWhole } from '../model/list-view';
import { nextTierText, PREVIEW_COPY } from '../model/preview-copy';
import { warningMessageIdOf } from '../model/preview-warnings';
import { LtrRun } from './ltr-run';

/** The order form's language: amounts are grouped as in Algeria, in Latin digits. */
const PREVIEW_LANGUAGE = 'ar';

/** An amount in dinars, kept in reading order inside the Arabic text. */
function Money({ amount }: { readonly amount: number }): ReactNode {
  return (
    <span>
      <LtrRun>{formatWhole(amount, PREVIEW_LANGUAGE)}</LtrRun> {PREVIEW_COPY.currency}
    </span>
  );
}

/** A gift or add-on line's tag; a plain line has none. */
function LineTag({ line }: { readonly line: QuoteLine }): ReactNode {
  if (line.giftOf !== undefined) return <Badge variant="success">{PREVIEW_COPY.gift}</Badge>;
  if (line.addonOf !== undefined) return <Badge variant="outline">{PREVIEW_COPY.addon}</Badge>;
  return null;
}

/** One line as the engine priced it: quantity, unit price (the list price struck through when lower), its amount. */
function PreviewLine({ line }: { readonly line: QuoteLine }): ReactNode {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2">
        <LineTag line={line} />
        {PREVIEW_COPY.quantity}: <LtrRun>{formatWhole(line.quantity, PREVIEW_LANGUAGE)}</LtrRun>
        {' · '}
        {PREVIEW_COPY.unitPrice}: <Money amount={line.unitPrice} />
        {line.unitPrice < line.originalPrice && (
          <s className="text-muted-foreground">
            <Money amount={line.originalPrice} />
          </s>
        )}
      </span>
      <Money amount={line.totalPrice} />
    </li>
  );
}

function ScenarioTotals({ scenario }: { readonly scenario: PreviewScenario }): ReactNode {
  const { quote } = scenario;
  return (
    <div className="grid gap-1 border-t pt-2 text-sm">
      <div className="flex justify-between gap-2">
        <span>{PREVIEW_COPY.delivery}</span>
        {quote.delivery.waived ? <Badge>{PREVIEW_COPY.freeDelivery}</Badge> : <Money amount={quote.delivery.price} />}
      </div>
      {quote.savings > 0 && (
        <div className="text-primary flex justify-between gap-2">
          <span>{PREVIEW_COPY.saving}</span>
          <Money amount={quote.savings} />
        </div>
      )}
      <div className="flex justify-between gap-2 font-medium">
        <span>{PREVIEW_COPY.total}</span>
        <Money amount={quote.total} />
      </div>
      {quote.nudge !== null && (
        <p className="text-muted-foreground text-xs">
          {nextTierText(formatWhole(quote.nudge.units, PREVIEW_LANGUAGE))}
        </p>
      )}
    </div>
  );
}

/** One synthetic cart of the preview, as the order form would show it. */
function ScenarioCard({ scenario }: { readonly scenario: PreviewScenario }): ReactNode {
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <ul className="grid gap-1">
        {scenario.quote.lines.map((line) => (
          <PreviewLine key={line.key} line={line} />
        ))}
      </ul>
      <ScenarioTotals scenario={scenario} />
    </div>
  );
}

export interface ArabicPreviewProps {
  readonly preview?: OfferPreview | undefined;
  readonly error?: string | undefined;
  readonly loading: boolean;
}

/** The merchant's notes on the preview, in the dashboard's language: a refusal, or the configuration warnings. */
function PreviewNotes({ preview, error, loading }: ArabicPreviewProps): ReactNode {
  const { i18n } = useLingui();
  if (error !== undefined)
    return (
      <p role="alert" className="text-destructive text-sm">
        {i18n._(error)}
      </p>
    );
  if (preview === undefined)
    return (
      <p className="text-muted-foreground text-sm">{i18n._(loading ? 'offers.loading' : 'offers.preview-waiting')}</p>
    );
  return preview.warnings.map((warning) => (
    <p key={warning} role="status" className="text-sm">
      {i18n._(warningMessageIdOf(warning))}
    </p>
  ));
}

/**
 * The live order-form preview (D2516): the server's priced scenarios rendered in Arabic, right to left. Formatting
 * only; every amount comes from the engine (ADR 0017).
 */
export function ArabicPreview(props: ArabicPreviewProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3" data-testid={ARABIC_PREVIEW_TEST_ID}>
      <p className="text-muted-foreground text-xs">{i18n._('offers.preview-hint')}</p>
      <PreviewNotes {...props} />
      {props.preview !== undefined && (
        <div lang="ar" dir="rtl" className="grid gap-3">
          {props.preview.scenarios.map((scenario) => (
            <ScenarioCard key={`${String(scenario.pieces)}-${String(scenario.addonAccepted)}`} scenario={scenario} />
          ))}
        </div>
      )}
    </div>
  );
}
