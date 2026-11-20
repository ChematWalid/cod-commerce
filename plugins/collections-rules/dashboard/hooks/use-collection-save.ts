import { storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@vendure/dashboard';
import { createStoreCollection, setStoreCollectionProducts, updateStoreCollection } from '../commands';
import {
  COLLECTION_PRODUCTS_QUERY_KEY,
  COLLECTION_QUERY_KEY,
  COLLECTIONS_QUERY_KEY,
  collectionPathOf,
} from '../constants';
import type { StoreCollectionDto } from '../dto';
import {
  type CollectionForm,
  type CollectionFormErrors,
  createInputOf,
  fieldErrorsOfCode,
  isEmptyUpdate,
  productIdsToSet,
  submitCollection,
  updateInputOf,
} from '../model/editor-form';
import { errorMessageIdOf, serverCodeOf } from '../model/list-view';
import type { StoreScope } from '../model/store-query';

export interface CollectionSaveTarget {
  /** The collection edited, or null for a new one. */
  readonly collectionId: string | null;
  /** The store segment of the editor's URL, so a new collection opens in the same store. */
  readonly storeAlias: string;
  /** The store the editor is open for: a save is refused unsent while requests go to another one. */
  readonly scope: StoreScope | null;
  /** The form as last saved: an update sends only what differs from it. */
  readonly saved: CollectionForm | null;
  readonly onInvalid: (errors: CollectionFormErrors) => void;
  readonly onSaved: (collection: StoreCollectionDto) => void;
}

/** A new collection, then its hand-ordered products when it is manual and has some. */
async function createWith(target: CollectionSaveTarget, form: CollectionForm): Promise<StoreCollectionDto> {
  const created = await createStoreCollection(target.scope, createInputOf(form));
  const productIds = productIdsToSet(null, form);
  return productIds === null ? created : setStoreCollectionProducts(target.scope, created.id, productIds);
}

/**
 * The changed fields, then the products when their order changed. The update goes first: a switch to manual must be
 * stored before a manual list can be set. Null when nothing changed.
 */
async function updateWith(
  target: CollectionSaveTarget & { readonly collectionId: string; readonly saved: CollectionForm },
  form: CollectionForm,
): Promise<StoreCollectionDto | null> {
  const input = updateInputOf(target.saved, form);
  const productIds = productIdsToSet(target.saved, form);
  if (isEmptyUpdate(input) && productIds === null) return null;
  const updated = isEmptyUpdate(input) ? null : await updateStoreCollection(target.scope, target.collectionId, input);
  if (productIds === null) return updated;
  return setStoreCollectionProducts(target.scope, target.collectionId, productIds);
}

function sendOf(target: CollectionSaveTarget) {
  return (form: CollectionForm): Promise<StoreCollectionDto | null> => {
    const { collectionId, saved } = target;
    if (collectionId === null || saved === null) return createWith(target, form);
    return updateWith({ ...target, collectionId, saved }, form);
  };
}

/**
 * Saves the editor's form. A refused form shows its fields without a request; a created collection opens in its own
 * editor; the list and the collection are refreshed after every save; a server refusal shows under its field (when it
 * has one) and as a translated message.
 */
export function useCollectionSave(target: CollectionSaveTarget) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const afterSave = async (collection: StoreCollectionDto): Promise<void> => {
    for (const queryKey of [COLLECTIONS_QUERY_KEY, COLLECTION_QUERY_KEY, COLLECTION_PRODUCTS_QUERY_KEY])
      await queryClient.invalidateQueries({ queryKey });
    toast.success(i18n._(target.collectionId === null ? 'collections.created' : 'collections.saved'));
    if (target.collectionId === null)
      await navigate({ to: storePathFor(collectionPathOf(collection.id), target.storeAlias) });
    else target.onSaved(collection);
  };
  return useMutation({
    mutationFn: (form: CollectionForm) => submitCollection(form, sendOf(target)),
    onSuccess: async (outcome) => {
      if (outcome.kind === 'invalid') {
        target.onInvalid(outcome.errors);
        toast.error(i18n._('collections.fix-errors'));
        return;
      }
      if (outcome.answer === null) toast.info(i18n._('collections.no-changes'));
      else await afterSave(outcome.answer);
    },
    onError: (error: unknown) => {
      target.onInvalid(fieldErrorsOfCode(serverCodeOf(error)));
      toast.error(i18n._(errorMessageIdOf(error)));
    },
  });
}
