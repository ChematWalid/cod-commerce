import {
  ACTIVE_STORE_ALIAS,
  StoreScopedPage,
  type SwitchableStoreView,
  storePathFor,
} from '@cod/plugin-merchant-shell/shell-api';
import type { OfferAppType } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Page, PageTitle } from '@vendure/dashboard';
import { type ReactNode, useMemo, useState } from 'react';
import { EditorBlocks } from '../components/editor-blocks';
import { CREATE_OFFERS_KEY, OFFER_EDITOR_TEST_ID, OFFERS_PATH, VIEW_OFFERS_KEY } from '../constants';
import type { OfferViewDto } from '../dto';
import { useOffer } from '../editor-queries';
import { usePreview } from '../hooks/use-offer-preview';
import { useOfferSave } from '../hooks/use-offer-save';
import { useStoreScope } from '../hooks/use-store-scope';
import {
  appTypeIdOf,
  editorSearchOf,
  emptyOfferForm,
  type OfferEditorForm,
  type OfferFormErrors,
  offerFormOf,
} from '../model/editor-form';
import { editorAccessOf } from '../model/editor-access';
import { editorLoadViewOf } from '../model/editor-load';
import { type StoreScope, useHeldPermissions, useOfferAppTypes } from '../queries';

/** The page's id for the dashboard's page extensions. */
const OFFER_EDITOR_PAGE_ID = 'offers-editor-page';

interface EditorProps {
  readonly storeAlias: string;
  readonly scope: StoreScope | null;
  /** The offer as loaded, or null for a new one. */
  readonly offer: OfferViewDto | null;
  readonly initial: OfferEditorForm;
}

/** The form, what was last saved (and its version), and the refused fields. */
function useEditorState(props: EditorProps) {
  const [offer, setOffer] = useState(props.offer);
  const [form, setForm] = useState(props.initial);
  const [saved, setSaved] = useState(props.initial);
  const [errors, setErrors] = useState<OfferFormErrors>({});
  const onChange = (change: Partial<OfferEditorForm>): void => {
    setForm((current) => ({ ...current, ...change }));
  };
  const onSaved = (next: OfferViewDto): void => {
    const nextForm = offerFormOf(next, form.appTypeId);
    setOffer(next);
    setForm(nextForm);
    setSaved(nextForm);
    setErrors({});
  };
  const discard = (): void => {
    setForm(saved);
    setErrors({});
  };
  return { offer, form, saved, errors, setErrors, onChange, onSaved, discard };
}

/** Everything the editor page shows and does: its state, what the caller may do, the save and the preview. */
function useEditorController(props: EditorProps) {
  const state = useEditorState(props);
  const navigate = useNavigate();
  const held = useHeldPermissions(props.scope);
  const save = useOfferSave({
    offer: state.offer,
    saved: state.saved,
    storeAlias: props.storeAlias,
    scope: props.scope,
    onInvalid: state.setErrors,
    onSaved: state.onSaved,
  });
  const access = editorAccessOf(state.offer, held);
  const onDiscard = (): void => {
    if (state.offer === null) void navigate({ to: storePathFor(OFFERS_PATH, props.storeAlias) });
    else state.discard();
  };
  return { state, save, ...access, onDiscard, preview: usePreview(props.scope, state.form) };
}

function EditorPage(props: EditorProps): ReactNode {
  const { i18n } = useLingui();
  const editor = useEditorController(props);
  const { state } = editor;
  return (
    <Page pageId={OFFER_EDITOR_PAGE_ID}>
      <PageTitle>{state.offer?.title ?? i18n._('offers.editor-new-heading')}</PageTitle>
      <EditorBlocks
        form={state.form}
        errors={state.errors}
        disabled={!editor.canSave}
        onChange={state.onChange}
        scope={props.scope}
        offerId={state.offer?.id ?? null}
        preview={editor.preview}
        footer={{
          isDraft: editor.isDraft,
          disabled: !editor.canSave,
          busy: editor.save.isPending,
          onDiscard: editor.onDiscard,
          onSave: () => {
            editor.save.mutate({ form: state.form, publish: false });
          },
          onPublish: () => {
            editor.save.mutate({ form: state.form, publish: true });
          },
        }}
      />
    </Page>
  );
}

function Notice({ messageId, alert = false }: { readonly messageId: string; readonly alert?: boolean }): ReactNode {
  const { i18n } = useLingui();
  return <p role={alert ? 'alert' : undefined}>{i18n._(messageId)}</p>;
}

/** The app types once loaded; otherwise the notice shown while they load or when they failed. */
type AppTypesState =
  | { readonly loaded: true; readonly appTypes: readonly OfferAppType[] }
  | { readonly loaded: false; readonly notice: ReactNode };

function useAppTypes(scope: StoreScope | null): AppTypesState {
  const appTypes = useOfferAppTypes(scope);
  if (appTypes.isError) return { loaded: false, notice: <Notice alert messageId="offers.error-generic" /> };
  if (appTypes.data === undefined) return { loaded: false, notice: <Notice messageId="offers.loading" /> };
  return { loaded: true, appTypes: appTypes.data };
}

/** A new offer of the link's app type, bought on the link's product when there is one (D2523, D2524). */
function NewOffer({ storeAlias, scope }: Pick<EditorProps, 'storeAlias' | 'scope'>): ReactNode {
  const search = editorSearchOf(useSearch({ strict: false }));
  const types = useAppTypes(scope);
  const appType = types.loaded ? types.appTypes.find((type) => type.id === search.type) : undefined;
  const initial = useMemo(
    () => (appType === undefined ? null : emptyOfferForm(appType, search.productId)),
    [appType, search.productId],
  );
  if (!types.loaded) return types.notice;
  if (initial === null) return <Notice alert messageId="offers.editor-unknown-type" />;
  return <EditorPage key={initial.appTypeId} storeAlias={storeAlias} scope={scope} offer={null} initial={initial} />;
}

/** The offer of the URL in the URL's store; not found when the store has no such offer. */
function ExistingOffer(props: Pick<EditorProps, 'storeAlias' | 'scope'> & { readonly offerId: string }): ReactNode {
  const view = editorLoadViewOf(useOffer(props.scope, props.offerId));
  const types = useAppTypes(props.scope);
  if (view.kind === 'loading') return <Notice messageId="offers.loading" />;
  if (view.kind === 'error') return <Notice alert messageId={view.messageId} />;
  if (view.kind === 'not-found') return <Notice alert messageId="offers.offer-not-found" />;
  if (!types.loaded) return types.notice;
  const initial = offerFormOf(view.offer, appTypeIdOf(view.offer, types.appTypes));
  return (
    <>
      {view.refetchErrorId !== undefined && <Notice alert messageId={view.refetchErrorId} />}
      <EditorPage key={view.offer.id} {...props} offer={view.offer} initial={initial} />
    </>
  );
}

function OfferEditor(props: { readonly store: SwitchableStoreView | undefined; readonly offerId: string | null }) {
  const scope = useStoreScope(props.store);
  const storeAlias = props.store?.id ?? ACTIVE_STORE_ALIAS;
  return (
    <div data-testid={OFFER_EDITOR_TEST_ID} data-store-id={props.store?.id}>
      {props.offerId === null ? (
        <NewOffer storeAlias={storeAlias} scope={scope} />
      ) : (
        <ExistingOffer storeAlias={storeAlias} scope={scope} offerId={props.offerId} />
      )}
    </div>
  );
}

/** `/stores/$storeId/offers/new?type=&productId=`: needs the create key on the URL's store (D2523). */
export function NewOfferPage(): ReactNode {
  return (
    <StoreScopedPage permission={CREATE_OFFERS_KEY}>
      {({ store }) => <OfferEditor store={store} offerId={null} />}
    </StoreScopedPage>
  );
}

/** `/stores/$storeId/offers/$offerId`: the view key opens it read-only, the edit key lets it save. */
export function EditOfferPage(): ReactNode {
  const params: { readonly offerId?: string } = useParams({ strict: false });
  return (
    <StoreScopedPage permission={VIEW_OFFERS_KEY}>
      {({ store }) => <OfferEditor store={store} offerId={params.offerId ?? null} />}
    </StoreScopedPage>
  );
}
