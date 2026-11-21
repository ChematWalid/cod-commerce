import type { Audience, CombinationClass, DeliveryMethod, OfferMethod, PreviewQuote } from '@cod/shared';
import type { OfferEditorForm } from './editor-form';
import { kindSummaryOf, type SummaryLine, summaryLine as line } from './kind-summaries';

export type { SummaryLine } from './kind-summaries';

/** The parts of a preview the summary quotes: each scenario's pieces, total and saving, as the server priced them. */
export interface SummaryPreview {
  readonly scenarios: readonly {
    readonly pieces: number;
    readonly quote: Pick<PreviewQuote, 'total' | 'savings'>;
  }[];
}

const METHOD_IDS: Readonly<Record<OfferMethod, string>> = {
  automatic: 'offers.summary-method-automatic',
  codes: 'offers.summary-method-codes',
};
const AUDIENCE_IDS: Readonly<Record<Audience, string>> = {
  everyone: 'offers.summary-audience-everyone',
  first: 'offers.summary-audience-first',
  returning: 'offers.summary-audience-returning',
};
const DELIVERY_METHOD_IDS: Readonly<Record<DeliveryMethod, string>> = {
  home: 'offers.summary-delivery-home',
  desk: 'offers.summary-delivery-desk',
};
const COMBINES_IDS: Readonly<Record<CombinationClass, string>> = {
  order: 'offers.summary-combines-order',
  product: 'offers.summary-combines-product',
  delivery: 'offers.summary-combines-delivery',
};

/** Where the offer applies: every channel or some, and only when narrowed, its wilayas and its one delivery method. */
function eligibilityLines({ eligibility }: OfferEditorForm): SummaryLine[] {
  const { channels, wilayas, deliveryMethods } = eligibility;
  const [onlyMethod] = deliveryMethods;
  return [
    channels.length === 0
      ? line('offers.summary-channels-all')
      : line('offers.summary-channels-some', { count: channels.length }),
    ...(wilayas.length === 0 ? [] : [line('offers.summary-wilayas-some', { count: wilayas.length })]),
    ...(deliveryMethods.length === 1 && onlyMethod !== undefined ? [line(DELIVERY_METHOD_IDS[onlyMethod])] : []),
  ];
}

/** A typed Algeria-time date as the merchant reads it (`2026-12-01 09:00`). */
const dateTextOf = (input: string): string => input.replace('T', ' ');

function dateLines(form: OfferEditorForm): SummaryLine[] {
  return [
    form.startMode === 'publish'
      ? line('offers.summary-start-publish')
      : line('offers.summary-start-date', { date: dateTextOf(form.startsAt) }),
    form.endsAt === ''
      ? line('offers.summary-end-none')
      : line('offers.summary-end-date', { date: dateTextOf(form.endsAt) }),
  ];
}

function limitLines(form: OfferEditorForm): SummaryLine[] {
  const total = form.totalUsageLimit.trim();
  const perBuyer = form.perBuyerLimit.trim();
  return [
    ...(total === '' ? [] : [line('offers.summary-limit-total', { count: total })]),
    ...(perBuyer === '' ? [] : [line('offers.summary-limit-buyer', { count: perBuyer })]),
  ];
}

function combinesLines({ combinesWith }: OfferEditorForm): SummaryLine[] {
  const classes = (Object.keys(COMBINES_IDS) as CombinationClass[]).filter((each) => combinesWith[each]);
  return classes.length === 0
    ? [line('offers.summary-combines-none')]
    : classes.map((each) => line(COMBINES_IDS[each]));
}

/** The scenario that saves most, quoted as the server priced it; none when no scenario saves. */
function sampleLines(preview: SummaryPreview | undefined): SummaryLine[] {
  const best = (preview?.scenarios ?? []).reduce<SummaryPreview['scenarios'][number] | undefined>(
    (kept, scenario) => (scenario.quote.savings > (kept?.quote.savings ?? 0) ? scenario : kept),
    undefined,
  );
  if (best === undefined) return [];
  return [line('offers.summary-sample', { pieces: best.pieces, total: best.quote.total, saving: best.quote.savings })];
}

/**
 * The summary card's sentences (D2523): one or more per group of the form, composed from catalogue templates and
 * the form's own values. Amounts the buyer pays come from the server's preview only, never from arithmetic here.
 */
export function summaryOf(form: OfferEditorForm, preview: SummaryPreview | undefined): SummaryLine[] {
  return [
    ...kindSummaryOf(form),
    line(METHOD_IDS[form.method]),
    line(AUDIENCE_IDS[form.eligibility.audience]),
    ...eligibilityLines(form),
    ...dateLines(form),
    ...limitLines(form),
    ...combinesLines(form),
    ...sampleLines(preview),
  ];
}
