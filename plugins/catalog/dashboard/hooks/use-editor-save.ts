import { storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@vendure/dashboard';
import { PRODUCT_QUERY_KEY, PRODUCTS_QUERY_KEY, productPathOf } from '../constants';
import type { CatalogProductSaveDto } from '../dto';
import { createCatalogProduct, updateCatalogProduct } from '../editor-queries';
import { type EditorForm, type EditorFormErrors, submitEditor } from '../model/editor-form';
import { createInputOf, isEmptyPatch, patchOf } from '../model/editor-patch';
import { listErrorMessageId } from '../model/list-view';
import type { StoreScope } from '../queries';

export interface EditorSaveTarget {
  /** The product edited, or null for a new one. */
  readonly productId: string | null;
  /** The store segment of the editor's URL, so a new product opens in the same store. */
  readonly storeAlias: string;
  /** The store the editor is open for: a save is refused unsent while requests go to another one. */
  readonly scope: StoreScope | null;
  /** The form as last saved: an update sends only what differs from it. */
  readonly saved: EditorForm;
  readonly onInvalid: (errors: EditorFormErrors) => void;
  readonly onSaved: (answer: CatalogProductSaveDto) => void;
}

/** The server call of a save: a create, an update of what changed, or nothing when nothing changed. */
function sendOf(target: EditorSaveTarget) {
  return async (form: EditorForm): Promise<CatalogProductSaveDto | null> => {
    if (target.productId === null) return createCatalogProduct(target.scope, createInputOf(form));
    const patch = patchOf(target.saved, form);
    return isEmptyPatch(patch) ? null : updateCatalogProduct(target.scope, target.productId, patch);
  };
}

/**
 * Saves the editor's form. A refused form shows its fields without a request; a created product opens in its own
 * editor; the list is refreshed after every save; a server refusal shows its translated code.
 */
export function useEditorSave(target: EditorSaveTarget) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const afterSave = async (answer: CatalogProductSaveDto): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEY });
    toast.success(i18n._(target.productId === null ? 'catalog.editor-created' : 'catalog.editor-saved'));
    for (const code of answer.warnings) toast.warning(i18n._(code));
    if (target.productId === null)
      await navigate({ to: storePathFor(productPathOf(answer.product.id), target.storeAlias) });
    else target.onSaved(answer);
  };
  return useMutation({
    mutationFn: (form: EditorForm) => submitEditor(form, sendOf(target)),
    onSuccess: async (outcome) => {
      if (outcome.kind === 'invalid') {
        target.onInvalid(outcome.errors);
        toast.error(i18n._('catalog.editor-fix-errors'));
        return;
      }
      if (outcome.answer === null) toast.info(i18n._('catalog.editor-no-changes'));
      else await afterSave(outcome.answer);
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
  });
}
