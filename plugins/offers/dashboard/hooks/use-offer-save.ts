import { storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@vendure/dashboard';
import { OFFER_QUERY_KEY, OFFERS_QUERY_KEY, offerPathOf } from '../constants';
import type { OfferViewDto } from '../dto';
import { createOffer, publishOffer, updateOffer } from '../editor-queries';
import { editorFormErrors, type OfferEditorForm, type OfferFormErrors, publishErrorsOf } from '../model/editor-form';
import { isEmptyPatch, offerPatchOf, toOfferInput } from '../model/editor-patch';
import { listErrorMessageId } from '../model/list-view';
import type { StoreScope } from '../queries';

export interface OfferSaveTarget {
  /** The offer as last saved, or null for a new one. */
  readonly offer: OfferViewDto | null;
  /** The form as last saved: an update sends only what differs from it. */
  readonly saved: OfferEditorForm;
  /** The store segment of the editor's URL, so a new offer opens in the same store. */
  readonly storeAlias: string;
  readonly scope: StoreScope | null;
  readonly onInvalid: (errors: OfferFormErrors) => void;
  readonly onSaved: (offer: OfferViewDto) => void;
}

/** What the footer asked: save the draft, or save it and take it live. */
export interface SaveRequest {
  readonly form: OfferEditorForm;
  readonly publish: boolean;
}

type SaveOutcome =
  | { readonly kind: 'invalid'; readonly errors: OfferFormErrors }
  | {
      readonly kind: 'saved';
      readonly offer: OfferViewDto;
      readonly published: boolean;
      readonly publishError?: unknown;
    };

type SavedOutcome = Extract<SaveOutcome, { readonly kind: 'saved' }>;

/** A create, an update of what changed, or the saved offer itself when nothing changed. */
async function saveDraft(target: OfferSaveTarget, form: OfferEditorForm): Promise<OfferViewDto> {
  if (target.offer === null) return createOffer(target.scope, toOfferInput(form));
  const patch = offerPatchOf(target.saved, form, target.offer.version);
  return isEmptyPatch(patch) ? target.offer : updateOffer(target.scope, target.offer.id, patch);
}

/** Saves, then publishes when asked; a refused publish keeps the saved draft and reports why. */
async function send(target: OfferSaveTarget, { form, publish }: SaveRequest): Promise<SaveOutcome> {
  const errors = editorFormErrors(form);
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };
  const offer = await saveDraft(target, form);
  if (!publish) return { kind: 'saved', offer, published: false };
  try {
    return { kind: 'saved', offer: await publishOffer(target.scope, offer.id), published: true };
  } catch (publishError: unknown) {
    return { kind: 'saved', offer, published: false, publishError };
  }
}

/**
 * The editor's Save as draft and Publish. A refused form shows its fields without a request; a refused publish shows
 * its problems on the fields (D2510); a created offer opens in its own editor; the list is refreshed after a save.
 */
export function useOfferSave(target: OfferSaveTarget) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reportPublish = (error: unknown): void => {
    const fields = publishErrorsOf(error);
    if (fields !== null) target.onInvalid(fields);
    toast.error(i18n._(listErrorMessageId(error)));
  };
  const afterSave = async ({ offer, published, publishError }: SavedOutcome): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: OFFER_QUERY_KEY });
    if (target.offer === null) await navigate({ to: storePathFor(offerPathOf(offer.id), target.storeAlias) });
    else target.onSaved(offer);
    if (publishError !== undefined) reportPublish(publishError);
    else toast.success(i18n._(published ? 'offers.editor-published' : 'offers.editor-saved'));
  };
  return useMutation({
    mutationFn: (request: SaveRequest) => send(target, request),
    onSuccess: async (outcome) => {
      if (outcome.kind === 'saved') {
        await afterSave(outcome);
        return;
      }
      target.onInvalid(outcome.errors);
      toast.error(i18n._('offers.editor-fix-errors'));
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
  });
}
