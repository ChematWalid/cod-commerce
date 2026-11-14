import { ACTIVE_STORE_ALIAS, StoreScopedPage, type SwitchableStoreView } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_PRODUCT_EDITOR_PAGE_ID } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useParams } from '@tanstack/react-router';
import { ActionBarItem, Button, Page, PageActionBar, PageTitle } from '@vendure/dashboard';
import { type ReactNode, useMemo, useState } from 'react';
import { EditorBlocks, type EditorBlocksProps } from '../components/editor-blocks';
import { ResetDialog } from '../components/reset-dialog';
import {
  CREATE_PRODUCTS_KEY,
  EDIT_PRODUCTS_KEY,
  EDITOR_SAVE_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
  VIEW_PRODUCTS_KEY,
} from '../constants';
import type { CatalogProductDto } from '../dto';
import { useCatalogProduct, useMediaLibrary } from '../editor-queries';
import { useEditorSave } from '../hooks/use-editor-save';
import { useStoreScope } from '../hooks/use-store-scope';
import { type EditorForm, type EditorFormErrors, editorFormOf, emptyEditorForm } from '../model/editor-form';
import { listErrorMessageId } from '../model/list-view';
import { resetsVariants } from '../model/options-draft';
import { isStoreSwitched } from '../model/store-bound-fetch';
import { type StoreScope, useHeldPermissions } from '../queries';

const SAVE_ACTION_ID = 'catalog-save';
const PREVIEW_ACTION_ID = 'catalog-preview';

interface EditorProps {
  readonly store: SwitchableStoreView | undefined;
  readonly scope: StoreScope | null;
  readonly productId: string | null;
  readonly product: CatalogProductDto | null;
}

/** The form, what was last saved, the refused fields, the last save's warnings and the reset question. */
function useEditorState(product: CatalogProductDto | null) {
  const initial = useMemo(() => (product === null ? emptyEditorForm() : editorFormOf(product)), [product]);
  const [form, setForm] = useState<EditorForm>(initial);
  const [saved, setSaved] = useState<EditorForm>(initial);
  const [errors, setErrors] = useState<EditorFormErrors>({});
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const onChange = (change: Partial<EditorForm>): void => {
    setForm((current) => ({ ...current, ...change }));
  };
  return {
    form,
    saved,
    errors,
    warnings,
    confirming,
    setForm,
    setSaved,
    setErrors,
    setWarnings,
    setConfirming,
    onChange,
  };
}

/** The library's previews by asset id, for the product's and the variants' images. */
function usePreviews(scope: StoreScope | null): ReadonlyMap<string, string> {
  const library = useMediaLibrary(scope).data;
  return useMemo(() => new Map((library ?? []).map((media) => [media.assetId, media.previewUrl])), [library]);
}

/** Everything the editor page shows and does: its state, what the caller may do, and the save with its question. */
function useEditorController(props: EditorProps) {
  const state = useEditorState(props.product);
  const held = useHeldPermissions(props.scope);
  const save = useEditorSave({
    productId: props.productId,
    storeAlias: props.store?.id ?? ACTIVE_STORE_ALIAS,
    saved: state.saved,
    onInvalid: state.setErrors,
    onSaved: (answer) => {
      const next = editorFormOf(answer.product);
      state.setForm(next);
      state.setSaved(next);
      state.setErrors({});
      state.setWarnings(answer.warnings);
    },
  });
  const submit = (): void => {
    state.setConfirming(false);
    save.mutate(state.form);
  };
  const askFirst = props.productId !== null && resetsVariants(state.saved.options, state.form.options);
  return {
    state,
    held,
    canSave: held.has(props.productId === null ? CREATE_PRODUCTS_KEY : EDIT_PRODUCTS_KEY),
    pending: save.isPending,
    optionsChanged: JSON.stringify(state.saved.options) !== JSON.stringify(state.form.options),
    submit,
    onSave: askFirst
      ? () => {
          state.setConfirming(true);
        }
      : submit,
  };
}

/** Save, disabled without the key or while a save runs; Preview waits for the storefront (P3.S2). */
function SaveButton(props: { readonly disabled: boolean; readonly onSave: () => void }): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button data-testid={EDITOR_SAVE_TEST_ID} disabled={props.disabled} onClick={props.onSave}>
      {i18n._('catalog.editor-save')}
    </Button>
  );
}

function PreviewButton(): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button variant="outline" disabled title={i18n._('catalog.preview-hint')}>
      {i18n._('catalog.action-preview')}
    </Button>
  );
}

type EditorController = ReturnType<typeof useEditorController>;

/** What the editor's cards get from the page. */
function blocksPropsOf(
  props: EditorProps,
  editor: EditorController,
  previews: ReadonlyMap<string, string>,
): EditorBlocksProps {
  const { state } = editor;
  return {
    form: state.form,
    errors: state.errors,
    onChange: state.onChange,
    warnings: state.warnings,
    disabled: !editor.canSave,
    optionsChanged: editor.optionsChanged,
    scope: props.scope,
    productId: props.productId,
    held: editor.held,
    previews,
  };
}

function EditorPage(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const editor = useEditorController(props);
  const previews = usePreviews(props.scope);
  const { state } = editor;
  return (
    <Page pageId={CATALOG_PRODUCT_EDITOR_PAGE_ID}>
      <PageTitle>{props.product?.title ?? i18n._('catalog.editor-new-heading')}</PageTitle>
      <PageActionBar>
        <ActionBarItem itemId={PREVIEW_ACTION_ID}>
          <PreviewButton />
        </ActionBarItem>
        <ActionBarItem itemId={SAVE_ACTION_ID}>
          <SaveButton disabled={!editor.canSave || editor.pending} onSave={editor.onSave} />
        </ActionBarItem>
      </PageActionBar>
      <EditorBlocks {...blocksPropsOf(props, editor, previews)} />
      <ResetDialog
        open={state.confirming}
        onConfirm={editor.submit}
        onClose={() => {
          state.setConfirming(false);
        }}
      />
    </Page>
  );
}

/** Loads the product of the URL in the URL's store, then opens it; not found when the store has no such product. */
function ExistingProduct(props: Omit<EditorProps, 'product'> & { readonly productId: string }): ReactNode {
  const { i18n } = useLingui();
  const answer = useCatalogProduct(props.scope, props.productId);
  if (answer.isError && !isStoreSwitched(answer.error))
    return <p role="alert">{i18n._(listErrorMessageId(answer.error))}</p>;
  if (!answer.isSuccess || answer.isPlaceholderData) return <p>{i18n._('catalog.loading')}</p>;
  if (answer.data === null) return <p role="alert">{i18n._('catalog.product-not-found')}</p>;
  return <EditorPage key={answer.data.id} {...props} product={answer.data} />;
}

function ProductEditor({ store, productId }: Pick<EditorProps, 'store' | 'productId'>): ReactNode {
  const scope = useStoreScope(store);
  return (
    <div data-testid={PRODUCT_EDITOR_TEST_ID} data-store-id={store?.id}>
      {productId === null ? (
        <EditorPage store={store} scope={scope} productId={null} product={null} />
      ) : (
        <ExistingProduct store={store} scope={scope} productId={productId} />
      )}
    </div>
  );
}

/** `/stores/$storeId/products/new`: needs the create key on the URL's store (D2110). */
export function NewProductPage(): ReactNode {
  return (
    <StoreScopedPage permission={CREATE_PRODUCTS_KEY}>
      {({ store }) => <ProductEditor store={store} productId={null} />}
    </StoreScopedPage>
  );
}

/** `/stores/$storeId/products/$productId`: the view key opens it read-only, the edit key lets it save. */
export function EditProductPage(): ReactNode {
  const params: { readonly productId?: string } = useParams({ strict: false });
  return (
    <StoreScopedPage permission={VIEW_PRODUCTS_KEY}>
      {({ store }) => <ProductEditor store={store} productId={params.productId ?? null} />}
    </StoreScopedPage>
  );
}
