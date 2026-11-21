import type { OfferInput, OfferPreviewInput } from '@cod/shared';
import type { OfferEditorForm } from './editor-form';
import { toOfferInput } from './editor-patch';

/**
 * The name a preview sends while the title is blank: the preview never shows it, but the offer input requires one.
 * Not a message: the preview's own copy says what the buyer sees.
 */
const UNTITLED_PREVIEW_NAME = '-';

/** Fields the preview ignores (D2534(c)): left out so a half-typed date or limit never refuses the preview. */
const IGNORED_BY_PREVIEW = ['totalUsageLimit', 'perBuyerLimit', 'startsAt', 'endsAt'] as const;

/** The product whose price the preview uses as its sample: the first product the offer is bought on. */
export function sampleProductIdOf(form: OfferEditorForm): string | null {
  return form.targets.find((target) => target.role === 'buy' && target.refType === 'product')?.refId ?? null;
}

function previewOfferOf(form: OfferEditorForm): OfferInput {
  const ignored: ReadonlySet<string> = new Set(IGNORED_BY_PREVIEW);
  const input = Object.fromEntries(Object.entries(toOfferInput(form)).filter(([key]) => !ignored.has(key)));
  const title = form.title.trim();
  return { ...(input as OfferInput), title: title === '' ? UNTITLED_PREVIEW_NAME : title };
}

/**
 * `previewOffer`'s input for the form (D2516): the draft without schedule or limits, priced at the sample product's
 * price when it is known, else at the server's sample price.
 */
export function previewInputOf(form: OfferEditorForm, samplePrice: number | null): OfferPreviewInput {
  return { offer: previewOfferOf(form), ...(samplePrice === null ? {} : { samplePrice }) };
}
