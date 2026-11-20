import { ACTIVE_STORE_ALIAS, StoreScopedPage, type SwitchableStoreView } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useParams } from '@tanstack/react-router';
import { ActionBarItem, Button, Page, PageActionBar, PageTitle } from '@vendure/dashboard';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { EditorBlocks } from '../components/editor-blocks';
import { ModeSwitchConfirm } from '../components/mode-switch-confirm';
import {
  COLLECTION_EDITOR_PAGE_ID,
  COLLECTION_EDITOR_TEST_ID,
  COLLECTION_SAVE_TEST_ID,
  CREATE_COLLECTIONS_KEY,
  EDIT_COLLECTIONS_KEY,
  VIEW_COLLECTIONS_KEY,
} from '../constants';
import type { StoreCollectionDto } from '../dto';
import { useCollectionSave } from '../hooks/use-collection-save';
import { useHeldPermissions } from '../hooks/use-held-permissions';
import { useStoreScope } from '../hooks/use-store-scope';
import {
  type CollectionForm,
  type CollectionFormErrors,
  collectionFormOf,
  emptyCollectionForm,
  needsModeConfirmation,
} from '../model/editor-form';
import { errorMessageIdOf } from '../model/list-view';
import type { ManualProduct } from '../model/manual-order';
import type { StoreScope } from '../model/store-query';
import { useCollectionProducts, useStoreCollection } from '../queries';

const SAVE_ACTION_ID = 'collections-save';

interface EditorProps {
  readonly store: SwitchableStoreView | undefined;
  readonly scope: StoreScope | null;
  readonly collection: StoreCollectionDto | null;
  readonly members: readonly ManualProduct[];
}

/** The form, what was last saved (null before a new collection's first save), the refused fields and the question. */
function useEditorState(props: EditorProps) {
  const initial = useMemo(
    () => (props.collection === null ? emptyCollectionForm() : collectionFormOf(props.collection, props.members)),
    [props.collection, props.members],
  );
  const [form, setForm] = useState<CollectionForm>(initial);
  const [saved, setSaved] = useState<CollectionForm | null>(props.collection === null ? null : initial);
  const [errors, setErrors] = useState<CollectionFormErrors>({});
  const [confirming, setConfirming] = useState(false);
  return { form, setForm, saved, setSaved, errors, setErrors, confirming, setConfirming };
}

type EditorState = ReturnType<typeof useEditorState>;

/** An automatic collection's members change with its rule and the products: a fresh read replaces the shown ones. */
function useFreshMembers(state: EditorState, members: readonly ManualProduct[]): void {
  const { setForm, setSaved } = state;
  useEffect(() => {
    setSaved((saved) => (saved?.mode === 'automatic' ? { ...saved, products: members } : saved));
    setForm((form) => (form.mode === 'automatic' ? { ...form, products: members } : form));
  }, [members, setForm, setSaved]);
}

/** Everything the editor does: its state, what the caller may do, and the save with its question (D2339). */
function useEditorController(props: EditorProps) {
  const state = useEditorState(props);
  useFreshMembers(state, props.members);
  const held = useHeldPermissions(props.scope);
  const save = useCollectionSave({
    collectionId: props.collection?.id ?? null,
    storeAlias: props.store?.id ?? ACTIVE_STORE_ALIAS,
    scope: props.scope,
    saved: state.saved,
    onInvalid: state.setErrors,
    onSaved: (collection) => {
      const next = collectionFormOf(collection, state.form.products);
      state.setForm(next);
      state.setSaved(next);
      state.setErrors({});
    },
  });
  const submit = (): void => {
    state.setConfirming(false);
    save.mutate(state.form);
  };
  return {
    state,
    held,
    canSave: held.has(props.collection === null ? CREATE_COLLECTIONS_KEY : EDIT_COLLECTIONS_KEY),
    pending: save.isPending,
    submit,
    onSave: needsModeConfirmation(state.saved, state.form)
      ? () => {
          state.setConfirming(true);
        }
      : submit,
  };
}

function EditorPage(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const editor = useEditorController(props);
  const { state } = editor;
  return (
    <Page pageId={COLLECTION_EDITOR_PAGE_ID}>
      <PageTitle>{props.collection?.title ?? i18n._('collections.new-heading')}</PageTitle>
      <PageActionBar>
        <ActionBarItem itemId={SAVE_ACTION_ID}>
          <Button
            data-testid={COLLECTION_SAVE_TEST_ID}
            disabled={!editor.canSave || editor.pending}
            onClick={editor.onSave}
          >
            {i18n._('collections.save')}
          </Button>
        </ActionBarItem>
      </PageActionBar>
      <EditorBlocks
        form={state.form}
        errors={state.errors}
        disabled={!editor.canSave}
        onChange={(change) => {
          state.setForm((form) => ({ ...form, ...change }));
        }}
        scope={props.scope}
        collectionId={props.collection?.id ?? null}
        held={editor.held}
        savedImage={props.collection?.featuredAsset ?? null}
      />
      <ModeSwitchConfirm
        open={state.confirming}
        onConfirm={editor.submit}
        onClose={() => {
          state.setConfirming(false);
        }}
      />
    </Page>
  );
}

/** Loads the collection of the URL and its products in the URL's store; not found when the store has no such one. */
function ExistingCollection(props: Pick<EditorProps, 'store' | 'scope'> & { readonly collectionId: string }) {
  const { i18n } = useLingui();
  const collection = useStoreCollection(props.scope, props.collectionId);
  const products = useCollectionProducts(props.scope, props.collectionId);
  const failed = collection.isError ? collection.error : products.error;
  if (failed !== null) return <p role="alert">{i18n._(errorMessageIdOf(failed))}</p>;
  if (!collection.isSuccess || !products.isSuccess) return <p>{i18n._('collections.loading')}</p>;
  if (collection.data === null) return <p role="alert">{i18n._('collections.not-found')}</p>;
  return (
    <EditorPage
      key={collection.data.id}
      store={props.store}
      scope={props.scope}
      collection={collection.data}
      members={products.data.items}
    />
  );
}

function CollectionEditor({
  store,
  collectionId,
}: {
  readonly store: SwitchableStoreView | undefined;
  readonly collectionId: string | null;
}) {
  const scope = useStoreScope(store);
  return (
    <div data-testid={COLLECTION_EDITOR_TEST_ID} data-store-id={store?.id}>
      {collectionId === null ? (
        <EditorPage store={store} scope={scope} collection={null} members={[]} />
      ) : (
        <ExistingCollection store={store} scope={scope} collectionId={collectionId} />
      )}
    </div>
  );
}

/** `/stores/$storeId/collections/new`: needs the create key on the URL's store. */
export function NewCollectionPage(): ReactNode {
  return (
    <StoreScopedPage permission={CREATE_COLLECTIONS_KEY}>
      {({ store }) => <CollectionEditor store={store} collectionId={null} />}
    </StoreScopedPage>
  );
}

/** `/stores/$storeId/collections/$collectionId`: the view key opens it read-only, the edit key lets it save. */
export function EditCollectionPage(): ReactNode {
  const params: { readonly collectionId?: string } = useParams({ strict: false });
  return (
    <StoreScopedPage permission={VIEW_COLLECTIONS_KEY}>
      {({ store }) => <CollectionEditor store={store} collectionId={params.collectionId ?? null} />}
    </StoreScopedPage>
  );
}
