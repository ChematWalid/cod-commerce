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
import { type CollectionSaveAnswer, type CollectionWrites, saveCollection } from '../model/collection-writes';
import {
  type CollectionForm,
  type CollectionFormErrors,
  fieldErrorsOfCode,
  submitCollection,
} from '../model/editor-form';
import { errorMessageIdOf, serverCodeOf } from '../model/list-view';
import type { StoreScope } from '../model/store-query';

export interface CollectionSaveTarget {
  /** The collection edited, or null while a new one is not created yet. */
  readonly collectionId: string | null;
  /** Whether the editor was opened for a new collection: its first full save opens the collection's own editor. */
  readonly opensCreated: boolean;
  /** The store segment of the editor's URL, so a new collection opens in the same store. */
  readonly storeAlias: string;
  /** The store the editor is open for: a save is refused unsent while requests go to another one. */
  readonly scope: StoreScope | null;
  /** The form as last saved: an update sends only what differs from it. */
  readonly saved: CollectionForm | null;
  readonly onInvalid: (errors: CollectionFormErrors) => void;
  /** An update was stored; `sent` is the form that went out, which may differ from the one shown now. */
  readonly onSaved: (collection: StoreCollectionDto, sent: CollectionForm) => void;
  /** The collection was created but its products were refused: the editor goes on editing the created one. */
  readonly onCreatedWithoutProducts: (collection: StoreCollectionDto) => void;
}

const writesOf = (scope: StoreScope | null): CollectionWrites => ({
  create: (input) => createStoreCollection(scope, input),
  update: (collectionId, input) => updateStoreCollection(scope, collectionId, input),
  setProducts: (collectionId, productIds) => setStoreCollectionProducts(scope, collectionId, productIds),
});

const REFRESHED_QUERY_KEYS = [COLLECTIONS_QUERY_KEY, COLLECTION_QUERY_KEY, COLLECTION_PRODUCTS_QUERY_KEY] as const;

/** What happens after a stored save: refresh, tell, and open a new collection's own editor (or take the saved form). */
function useAfterSave(target: CollectionSaveTarget) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refresh = async (): Promise<void> => {
    for (const queryKey of REFRESHED_QUERY_KEYS) await queryClient.invalidateQueries({ queryKey });
  };
  const refused = (error: unknown): void => {
    target.onInvalid(fieldErrorsOfCode(serverCodeOf(error)));
    toast.error(i18n._(errorMessageIdOf(error)));
  };
  return async (answer: CollectionSaveAnswer, sent: CollectionForm): Promise<void> => {
    await refresh();
    if (answer.kind === 'created-without-products') {
      target.onCreatedWithoutProducts(answer.collection);
      refused(answer.error);
      return;
    }
    toast.success(i18n._(target.opensCreated ? 'collections.created' : 'collections.saved'));
    if (target.opensCreated)
      await navigate({ to: storePathFor(collectionPathOf(answer.collection.id), target.storeAlias) });
    else target.onSaved(answer.collection, sent);
  };
}

/**
 * Saves the editor's form. A refused form shows its fields without a request; a created collection opens in its own
 * editor; the list and the collection are refreshed after every save; a server refusal shows under its field (when it
 * has one) and as a translated message. A create whose products are refused keeps the editor on the created
 * collection, so the next save only sets the products.
 */
export function useCollectionSave(target: CollectionSaveTarget) {
  const { i18n } = useLingui();
  const afterSave = useAfterSave(target);
  const base = { collectionId: target.collectionId, saved: target.saved };
  return useMutation({
    mutationFn: (form: CollectionForm) =>
      submitCollection(form, (valid) => saveCollection(writesOf(target.scope), base, valid)),
    onSuccess: async (outcome, sent) => {
      if (outcome.kind === 'invalid') {
        target.onInvalid(outcome.errors);
        toast.error(i18n._('collections.fix-errors'));
        return;
      }
      if (outcome.answer === null) toast.info(i18n._('collections.no-changes'));
      else await afterSave(outcome.answer, sent);
    },
    onError: (error: unknown) => {
      target.onInvalid(fieldErrorsOfCode(serverCodeOf(error)));
      toast.error(i18n._(errorMessageIdOf(error)));
    },
  });
}
