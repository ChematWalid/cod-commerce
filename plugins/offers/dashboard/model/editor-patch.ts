import type { OfferInput } from '@cod/shared';
import { instantOfAlgeriaInput } from './algeria-time';
import { type LabelDraft, type OfferEditorForm, startInstantOf, usageLimitOf } from './editor-form';

/** The offer as the API takes it, every key present: `null` is "none" (a clearable field) and is left out of a create. */
type FullOfferInput = Required<{
  [K in keyof OfferInput]: Exclude<OfferInput[K], undefined>;
}>;

/** `updateOffer`'s arguments: the changed fields and the version they were made on (D2535(b)). */
export interface OfferPatch {
  readonly input: Partial<OfferInput>;
  readonly version: number;
}

/** The typed languages of the label, trimmed; a blank one is left out. */
function labelOf(label: LabelDraft): FullOfferInput['label'] {
  return Object.fromEntries(
    Object.entries(label)
      .map(([language, text]) => [language, text.trim()] as const)
      .filter(([, text]) => text !== ''),
  );
}

/** A value the form already checked (`editorFormErrors`): an unreadable one counts as none. */
const orNull = <T>(value: T | null | undefined): T | null => value ?? null;

function fullInputOf(form: OfferEditorForm): FullOfferInput {
  return {
    kind: form.kind,
    method: form.method,
    title: form.title.trim(),
    label: labelOf(form.label),
    config: form.config,
    combinesWith: form.combinesWith,
    eligibility: form.eligibility,
    totalUsageLimit: orNull(usageLimitOf(form.totalUsageLimit)),
    perBuyerLimit: orNull(usageLimitOf(form.perBuyerLimit)),
    startsAt: orNull(startInstantOf(form)),
    endsAt: orNull(instantOfAlgeriaInput(form.endsAt)),
    targets: form.targets.map(({ role, refType, refId }) => ({ role, refType, refId })),
  };
}

/** "Create an offer" (or preview one) from the form: every set field; a field left blank is not sent (the default). */
export function toOfferInput(form: OfferEditorForm): OfferInput {
  const full = fullInputOf(form);
  return Object.fromEntries(
    Object.entries(full).filter(([, value]) => value !== null && value !== undefined),
  ) as OfferInput;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * "Edit an offer": the fields that differ from what was saved, with the version they were made on so a concurrent
 * edit answers `offers.offer-conflict`. A cleared limit or date is sent as `null`, which clears it (D2535(c)).
 */
export function offerPatchOf(saved: OfferEditorForm, form: OfferEditorForm, version: number): OfferPatch {
  const before: Readonly<Record<string, unknown>> = fullInputOf(saved);
  const input = Object.fromEntries(
    Object.entries(fullInputOf(form)).filter(([key, value]) => !same(value, before[key])),
  ) as Partial<OfferInput>;
  return { input, version };
}

export const isEmptyPatch = (patch: OfferPatch): boolean => Object.keys(patch.input).length === 0;
